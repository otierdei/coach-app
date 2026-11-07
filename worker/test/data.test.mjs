// Tests for the /data endpoint against a running worker (wrangler dev --local). Usage: node test/data.test.mjs http://localhost:8799
const BASE = process.argv[2] || "http://localhost:8799";
const KEY = "test-key-0123456789-abcdefghijklmnop";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("FAIL", m); } };
const post = async (path, body) => (await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) })).json();
const data = (action, p = {}) => post("/data", { key: KEY, action, ...p });

await post("/setup", { key: KEY });
ok((await post("/data", { key: "wrong-key-0123456789-abcdefghijk", action: "readAll" })).code === "needs_reauth", "wrong key rejected");

// import keeps Drive versions; a second import does not overwrite a newer D1 copy unless forced
let r = await data("import", { docs: { tasks: { version: 140, updatedAt: "2026-11-07T08:00:00Z", data: { tasks: [{ id: "a", t: "A" }] } }, log: { version: 50, data: { days: {} } } } });
ok(r.result.tasks === "imported version 140", "import tasks " + JSON.stringify(r));
r = await data("import", { docs: { tasks: { version: 120, data: { tasks: [] } } } });
ok(/kept D1 version 140/.test(r.result.tasks), "import keeps newer");
r = await data("read", { doc: "tasks" });
ok(r.doc.version === 140 && r.doc.data.tasks[0].id === "a", "read after import");

// write: right base wins, wrong base gets the current copy, -1 (never read) always conflicts
r = await data("write", { doc: "tasks", data: { tasks: [{ id: "a", t: "A2" }] }, baseVersion: 140 });
ok(r.ok && r.version === 141, "write ok");
r = await data("write", { doc: "tasks", data: { tasks: [] }, baseVersion: 140 });
ok(r.conflict && r.current.version === 141 && r.current.data.tasks[0].t === "A2", "stale write conflicts");
r = await data("write", { doc: "tasks", data: { tasks: [] }, baseVersion: -1 });
ok(r.conflict, "unread doc conflicts");
r = await data("write", { doc: "profile", data: { name: "Oti" }, baseVersion: 0 });
ok(r.ok && r.version === 1, "first write of a new doc");
r = await data("write", { doc: "secrets", data: {} });
ok(/unknown doc/.test(r.error || ""), "unknown doc refused");

// two writers at the same base: exactly one wins
const both = await Promise.all([1, 2].map(i => data("write", { doc: "profile", data: { n: i }, baseVersion: 1 })));
ok(both.filter(x => x.ok).length === 1 && both.filter(x => x.conflict).length === 1, "compare and swap " + JSON.stringify(both));

// inbox modes, like applyInbox
r = await data("inbox", { file: "tasks--1.json", doc: "tasks", mode: "patch", data: { tasks: [{ id: "a", done: true }, { id: "b", t: "B" }] } });
ok(r.ok && r.version === 142, "inbox patch");
r = await data("read", { doc: "tasks" });
ok(r.doc.data.tasks.length === 2 && r.doc.data.tasks[0].t === "A2" && r.doc.data.tasks[0].done === true, "patch merges by id");
r = await data("inbox", { file: "tasks--1.json", doc: "tasks", mode: "patch", data: { tasks: [{ id: "c" }] } });
ok(r.duplicate === true && r.version === 142, "same file applied once");
r = await data("inbox", { file: "tasks--2.json", doc: "tasks", mode: "patch", data: { tasks: [{ id: "b", __delete__: true }] } });
r = await data("read", { doc: "tasks" });
ok(r.doc.data.tasks.length === 1, "patch delete");
await data("inbox", { file: "log--1.json", doc: "log", mode: "merge", data: { days: { "2026-11-07": { p: 20 } } } });
await data("inbox", { file: "log--2.json", doc: "log", mode: "merge", data: { days: { "2026-11-07": { c: true } } } });
r = await data("read", { doc: "log" });
ok(r.doc.data.days["2026-11-07"].p === 20 && r.doc.data.days["2026-11-07"].c === true && r.doc.version === 52, "merge deep");
await data("inbox", { file: "briefing--1.json", doc: "briefing", mode: "set", data: { date: "2026-11-07", lines: ["RECOVERY 53"] } });
r = await data("read", { doc: "briefing" });
ok(r.doc.data.lines[0] === "RECOVERY 53" && r.doc.version === 1, "set");

// notices: first item creates the list, new ids push (no device subscribed here, so 0 delivered), seen marks only that item
r = await data("inbox", { file: "notices--1.json", doc: "notices", mode: "patch", data: { items: [{ id: "trainer-2026-11-07", source: "trainer", title: "Trainer Review", summary: "3 Vorschläge", body: "## 1\nText", createdAt: "2026-11-07T07:30:00Z" }] } });
ok(r.ok && r.pushes.length === 1 && r.pushes[0].id === "trainer-2026-11-07", "notice push " + JSON.stringify(r));
r = await data("inbox", { file: "notices--2.json", doc: "notices", mode: "patch", data: { items: [{ id: "immo-2026-11-07", source: "immo", title: "Immobilienscan", summary: "2 neue Objekte", link: "https://docs.google.com/document/d/x" }] } });
ok(r.pushes.length === 1 && r.pushes[0].id === "immo-2026-11-07", "second notice pushes only itself");
r = await data("noticeSeen", { id: "trainer-2026-11-07" });
r = await data("read", { doc: "notices" });
const it = r.doc.data.items;
ok(it.length === 2 && it[0].seenAt && !it[1].seenAt && it[0].body === "## 1\nText", "seen marks one");
r = await data("readAll");
ok(Object.keys(r.docs).sort().join() === "briefing,log,notices,profile,tasks", "readAll lists docs " + Object.keys(r.docs));
const st = await post("/status", { key: KEY });
ok(st.log.some(l => l.kind === "push" && l.title === "Immobilienscan"), "push logged");

console.log(`data tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
