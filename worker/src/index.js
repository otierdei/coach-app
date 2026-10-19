/* Coach push worker (Cloudflare Workers + D1, EU jurisdiction).
   Job in phase 1: keep the iPhone's push subscription and send pushes when the app backend
   (Apps Script) or the app asks for one. Apps Script stays the only scheduler.

   Auth: the same secret key the app already uses for Apps Script. The worker never stores the key,
   only its SHA-256. It is set once with POST /setup (first caller wins, later calls must match).

   POST bodies are JSON (sent as text/plain to avoid CORS preflight):
     /setup      {key}                                  -> {ok}
     /subscribe  {key, subscription, device}            -> {ok, subs}
     /push       {key, title, body, tag?, url?, by?}    -> {ok, sent, delivered, removed, results}
     /status     {key}                                  -> {ok, subs:[...], log:[...]}
     /unsubscribe {key, endpoint}                       -> {ok}
   GET /health -> {ok}   GET /vapid -> {publicKey} */
import { newVapidKeys, sendPush } from "./webpush.js";

const SUBJECT = "https://otierdei.github.io/coach-app/";
const ORIGINS = ["https://otierdei.github.io"];
const MAX_PUSHES_PER_DAY = 60;

const enc = new TextEncoder();
async function sha256hex(s) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(s))));
  return [...h].map(b => b.toString(16).padStart(2, "0")).join("");
}
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function cors(req) {
  const o = req.headers.get("Origin");
  return o && ORIGINS.includes(o) ? { "Access-Control-Allow-Origin": o, "Vary": "Origin" } : {};
}
function json(req, obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors(req) } });
}
async function cfgGet(env, k) {
  const r = await env.DB.prepare("SELECT v FROM config WHERE k = ?").bind(k).first();
  return r ? r.v : null;
}
async function cfgSet(env, k, v) {
  await env.DB.prepare("INSERT INTO config (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(k, v).run();
}
async function vapid(env) {
  const raw = await cfgGet(env, "vapid");
  if (raw) return JSON.parse(raw);
  const v = await newVapidKeys();
  // INSERT OR IGNORE: if two first calls race, both end up using the one that was stored
  await env.DB.prepare("INSERT OR IGNORE INTO config (k, v) VALUES ('vapid', ?)").bind(JSON.stringify(v)).run();
  return JSON.parse(await cfgGet(env, "vapid"));
}
async function authed(env, body) {
  const stored = await cfgGet(env, "key_hash");
  if (!stored || !body || !body.key) return false;
  return sameHex(stored, await sha256hex(body.key));
}
async function log(env, kind, title, sent, delivered, removed, detail) {
  await env.DB.prepare("INSERT INTO log (ts, kind, title, sent, delivered, removed, detail) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(new Date().toISOString(), kind, String(title || "").slice(0, 120), sent, delivered, removed, String(detail || "").slice(0, 500)).run();
}

async function doPush(env, body) {
  const day = new Date().toISOString().slice(0, 10);
  const today = await env.DB.prepare("SELECT COUNT(*) AS n FROM log WHERE kind = 'push' AND ts >= ?").bind(day).first();
  if (today && today.n >= MAX_PUSHES_PER_DAY) return { ok: false, error: "daily push limit reached" };
  const title = String(body.title || "Coach").slice(0, 80);
  const text = String(body.body || "").slice(0, 600);
  const payload = { title, body: text, tag: body.tag ? String(body.tag).slice(0, 40) : undefined, url: body.url ? String(body.url).slice(0, 300) : undefined, ts: Date.now() };
  const v = await vapid(env);
  const { results: subs } = await env.DB.prepare("SELECT id, endpoint, p256dh, auth, device FROM subs").all();
  const results = [];
  let delivered = 0, removed = 0;
  for (const s of subs) {
    let r;
    try { r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, v, SUBJECT); }
    catch (e) { r = { ok: false, status: 0, gone: false, text: String(e && e.message || e) }; }
    const now = new Date().toISOString();
    if (r.gone) {
      await env.DB.prepare("DELETE FROM subs WHERE id = ?").bind(s.id).run(); removed++;
    } else if (r.ok) {
      await env.DB.prepare("UPDATE subs SET last_ok = ?, last_status = ?, fails = 0 WHERE id = ?").bind(now, r.status, s.id).run(); delivered++;
    } else {
      await env.DB.prepare("UPDATE subs SET last_status = ?, fails = fails + 1 WHERE id = ?").bind(r.status, s.id).run();
    }
    results.push({ device: s.device, status: r.status, ok: r.ok, gone: r.gone, error: r.ok ? undefined : r.text });
  }
  const detail = results.map(x => `${x.device}:${x.status}`).join(" ") || "no subscriptions";
  await log(env, "push", title, subs.length, delivered, removed, (body.by ? body.by + " " : "") + detail);
  return { ok: delivered > 0, sent: subs.length, delivered, removed, results };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...cors(req), "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
    }
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        const set = !!(await cfgGet(env, "key_hash"));
        return json(req, { ok: true, app: "coach-push", keySet: set });
      }
      if (req.method === "GET" && url.pathname === "/vapid") return json(req, { publicKey: (await vapid(env)).publicKey });
      if (req.method !== "POST") return json(req, { error: "not found" }, 404);

      let body;
      try { body = JSON.parse(await req.text()); } catch (e) { return json(req, { error: "bad json" }, 400); }

      if (url.pathname === "/setup") {
        if (!body.key || String(body.key).length < 24) return json(req, { error: "key too short" }, 400);
        const h = await sha256hex(body.key);
        const stored = await cfgGet(env, "key_hash");
        if (!stored) {
          await env.DB.prepare("INSERT OR IGNORE INTO config (k, v) VALUES ('key_hash', ?)").bind(h).run();
          const now = await cfgGet(env, "key_hash");
          if (!sameHex(now, h)) return json(req, { error: "already set with another key", code: "key_mismatch" }, 403);
          await log(env, "setup", "key set", 0, 0, 0, "");
          return json(req, { ok: true, first: true });
        }
        return sameHex(stored, h) ? json(req, { ok: true, first: false }) : json(req, { error: "already set with another key", code: "key_mismatch" }, 403);
      }

      if (!(await authed(env, body))) return json(req, { error: "bad key", code: "needs_reauth" }, 401);

      if (url.pathname === "/subscribe") {
        const s = body.subscription;
        if (!s || !s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) return json(req, { error: "bad subscription" }, 400);
        if (!/^https:\/\//.test(s.endpoint)) return json(req, { error: "bad endpoint" }, 400);
        const id = await sha256hex(s.endpoint);
        const now = new Date().toISOString();
        await env.DB.prepare(`INSERT INTO subs (id, endpoint, p256dh, auth, device, created, seen, fails) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
          ON CONFLICT(id) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, seen = excluded.seen`)
          .bind(id, s.endpoint, s.keys.p256dh, s.keys.auth, String(body.device || "device").slice(0, 60), now, now).run();
        if (body.replaces && body.replaces !== s.endpoint) {
          await env.DB.prepare("DELETE FROM subs WHERE id = ?").bind(await sha256hex(body.replaces)).run();
        }
        const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM subs").first();
        return json(req, { ok: true, subs: n.n });
      }
      if (url.pathname === "/unsubscribe") {
        await env.DB.prepare("DELETE FROM subs WHERE id = ?").bind(await sha256hex(body.endpoint || "")).run();
        return json(req, { ok: true });
      }
      if (url.pathname === "/push") return json(req, await doPush(env, body));
      if (url.pathname === "/status") {
        const { results: subs } = await env.DB.prepare("SELECT device, created, seen, last_ok, last_status, fails, substr(endpoint, 1, 40) AS host FROM subs").all();
        const { results: lg } = await env.DB.prepare("SELECT ts, kind, title, sent, delivered, removed, detail FROM log ORDER BY id DESC LIMIT 20").all();
        return json(req, { ok: true, subs, log: lg });
      }
      return json(req, { error: "not found" }, 404);
    } catch (e) {
      return json(req, { error: String(e && e.message || e) }, 500);
    }
  },
};
