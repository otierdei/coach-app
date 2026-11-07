/* Coach docs in D1 (phase 2, 07.11.2026). Mirrors the Apps Script doc logic exactly, so the app can switch
   backends without noticing:
     readAll / read            -> {version, updatedAt, data} per doc (versions carried over from Drive on import)
     write {doc, data, baseVersion}
                               -> {ok, version, updatedAt} or {ok:false, conflict:true, current}
     inbox {file, doc, mode, data, by, baseVersion}
                               -> change files of the scheduled tasks (mode set | patch | merge, as applyInbox in Code.gs).
                                  Each file is applied once (table applied), so a retried forward is harmless.
     import {docs, force}      -> one time load from Drive; keeps a newer D1 copy unless force
     noticeSeen {id}           -> marks one notice as seen (patch, never overwrites other notices)
   Every write is a compare and swap on the version, so two writers can never lose each other's change. */

export const DOCS = ["profile", "log", "health", "schedule", "briefing", "habits", "tasks", "monthly", "notices"];
const isObj = x => x && typeof x === "object" && !Array.isArray(x);

export function mergeDeep(base, patch) {
  if (!isObj(base) || !isObj(patch)) return patch;
  const out = JSON.parse(JSON.stringify(base));
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (isObj(v) && v.__delete__ === true) { delete out[k]; continue; }
    out[k] = isObj(v) && isObj(out[k]) ? mergeDeep(out[k], v) : v;
  }
  return out;
}
// same as patchById_ in Code.gs: top level keys; arrays of {id} are merged item by item, anything else as mergeDeep
export function patchById(base, patch) {
  const out = isObj(base) ? JSON.parse(JSON.stringify(base)) : {};
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    // an array into a missing key starts the list (Code.gs only merges by id into an existing array; for the new
    // notices doc the first item must not need a special case)
    if (Array.isArray(v) && out[k] === undefined && v.every(x => isObj(x) && x.id != null)) out[k] = [];
    const byId = Array.isArray(v) && Array.isArray(out[k]) && v.every(x => isObj(x) && x.id != null);
    if (!byId) { out[k] = isObj(v) && isObj(out[k]) ? mergeDeep(out[k], v) : v; continue; }
    for (const item of v) {
      const i = out[k].findIndex(o => isObj(o) && o.id === item.id);
      if (item.__delete__ === true) { if (i >= 0) out[k].splice(i, 1); continue; }
      if (i >= 0) out[k][i] = mergeDeep(out[k][i], item); else out[k].push(item);
    }
  }
  return out;
}

function checkDoc(name) { if (!DOCS.includes(name)) throw new Error("unknown doc " + name); }
const rowToRec = r => r ? { version: r.version, updatedAt: r.updated_at, data: JSON.parse(r.data) } : null;

export async function readDoc(env, name) {
  checkDoc(name);
  return rowToRec(await env.DB.prepare("SELECT version, updated_at, data FROM docs WHERE name = ?").bind(name).first());
}
export async function readAll(env) {
  const { results } = await env.DB.prepare("SELECT name, version, updated_at, data FROM docs").all();
  const out = {};
  for (const r of results) out[r.name] = rowToRec(r);
  return out;
}
// compare and swap: returns the new record, or null if someone else wrote first
async function cas(env, name, curVersion, data, by) {
  const rec = { version: curVersion + 1, updatedAt: new Date().toISOString(), by, data };
  const body = JSON.stringify(data);
  const r = curVersion === 0
    ? await env.DB.prepare("INSERT OR IGNORE INTO docs (name, version, updated_at, by, data) VALUES (?, 1, ?, ?, ?)").bind(name, rec.updatedAt, by, body).run()
    : await env.DB.prepare("UPDATE docs SET version = ?, updated_at = ?, by = ?, data = ? WHERE name = ? AND version = ?").bind(rec.version, rec.updatedAt, by, body, name, curVersion).run();
  return r.meta.changes === 1 ? rec : null;
}

export async function writeDoc(env, name, data, baseVersion) {
  checkDoc(name);
  if (!isObj(data)) throw new Error("data must be an object");
  const cur = (await readDoc(env, name)) || { version: 0, updatedAt: null, data: null };
  const base = baseVersion === undefined || baseVersion === null ? cur.version : Number(baseVersion);
  if (base !== cur.version) return { ok: false, conflict: true, current: cur };
  const rec = await cas(env, name, cur.version, data, "app");
  if (!rec) return { ok: false, conflict: true, current: await readDoc(env, name) };
  return { ok: true, version: rec.version, updatedAt: rec.updatedAt };
}

export async function applyChange(env, ch) {
  const name = ch.doc;
  checkDoc(name);
  if (!isObj(ch.data)) throw new Error("data must be an object");
  if (ch.file) {
    const done = await env.DB.prepare("SELECT version FROM applied WHERE file = ?").bind(String(ch.file)).first();
    if (done) return { ok: true, doc: name, version: done.version, duplicate: true, before: null, after: null };
  }
  for (let tries = 0; tries < 6; tries++) {
    const cur = (await readDoc(env, name)) || { version: 0, data: {} };
    const data = ch.mode === "set" ? ch.data : ch.mode === "patch" ? patchById(cur.data || {}, ch.data) : mergeDeep(cur.data || {}, ch.data);
    const rec = await cas(env, name, cur.version, data, String(ch.by || "task").slice(0, 60));
    if (!rec) continue;
    if (ch.file) await env.DB.prepare("INSERT OR IGNORE INTO applied (file, doc, version, ts) VALUES (?, ?, ?, ?)").bind(String(ch.file), name, rec.version, rec.updatedAt).run();
    return { ok: true, doc: name, version: rec.version, before: cur.data || {}, after: data };
  }
  throw new Error("busy, try again");
}

export async function importDocs(env, docs, force) {
  const out = {};
  for (const [name, rec] of Object.entries(docs || {})) {
    checkDoc(name);
    if (!rec || typeof rec.version !== "number" || !isObj(rec.data)) { out[name] = "skipped: bad record"; continue; }
    const cur = await readDoc(env, name);
    if (cur && !force && cur.version >= rec.version) { out[name] = "kept D1 version " + cur.version; continue; }
    await env.DB.prepare(`INSERT INTO docs (name, version, updated_at, by, data) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at, by = excluded.by, data = excluded.data`)
      .bind(name, rec.version, rec.updatedAt || null, "import", JSON.stringify(rec.data)).run();
    out[name] = "imported version " + rec.version;
  }
  return out;
}

/* Notices: {items:[{id, source, title, summary, body?, link?, createdAt, seenAt?}]}.
   New ids (not in the doc before) get one push that opens the app at that notice. */
export function newNotices(before, after) {
  const had = new Set(((before && before.items) || []).map(o => o && o.id));
  return ((after && after.items) || []).filter(o => isObj(o) && o.id != null && !had.has(o.id) && !o.seenAt);
}
export function briefingPushText(data) {
  const lines = (data.lines || []).map(l => String(l).replace(/\s*\[(Certain|Likely|Guessing)\]/g, ""));
  const pick = lines.filter(l => /^(RECOVERY|SESSION|HEADS UP)/.test(l));
  return (pick.length ? pick : lines.slice(0, 3)).join("\n").slice(0, 500);
}
