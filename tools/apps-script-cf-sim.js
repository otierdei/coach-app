// Simulates the Apps Script globals around Code.gs; UrlFetchApp goes to the local worker (wrangler dev).
const fs = require("fs"), cp = require("child_process");
const W = process.argv[3] || "http://localhost:8799";
const KEY = "test-key-0123456789-abcdefghijklmnop";
let src = fs.readFileSync(process.argv[2], "utf8").replace("var PUSH_URL = 'https://coach-push.othniel-erdei.workers.dev';", `var PUSH_URL = '${W}';`);
const props = {KEY, DATA_FOLDER_ID: "data"}; const triggers = [];
function mkFile(name, content, folder){ return {name, content, folder, desc:"", getName(){return this.name}, setName(n){this.name=n}, getBlob(){const c=this.content; return {getDataAsString(){return c}}}, setContent(c){this.content=c}, setDescription(d){this.desc=d}, moveTo(f){this.folder=f}}; }
const files = [];
function mkFolder(id){ return {id, getId(){return id}, getFiles(){ const l = files.filter(f=>f.folder===id); let i=0; return {hasNext(){return i<l.length}, next(){return l[i++]}}; },
  getFilesByName(n){ const l = files.filter(f=>f.folder===id && f.name===n); let i=0; return {hasNext(){return i<l.length}, next(){return l[i++]}}; },
  getFoldersByName(n){ const f = mkFolder(n); let d=false; return {hasNext(){return !d}, next(){d=true; return f}}; }, createFile(n,c){ const f=mkFile(n,c,id); files.push(f); return f; }, createFolder(n){return mkFolder(n)}}; }
const g = {
  PropertiesService:{getScriptProperties(){return {getProperty:k=>props[k]??null, setProperty:(k,v)=>{props[k]=String(v)}, deleteProperty:k=>{delete props[k]}}}},
  DriveApp:{getFolderById:id=>mkFolder(id), getFoldersByName:n=>mkFolder("data").getFoldersByName(n)},
  CacheService:{getScriptCache(){return {get:()=>null, getAll:()=>({}), put(){}, remove(){}, removeAll(){}}}},
  LockService:{getScriptLock(){return {waitLock(){}, releaseLock(){}}}},
  ScriptApp:{getProjectTriggers:()=>triggers, newTrigger(h){ return {timeBased(){return {everyMinutes(){return {create(){triggers.push({getHandlerFunction:()=>h})}}}}}}}, deleteTrigger(t){ triggers.splice(triggers.indexOf(t),1); }},
  UrlFetchApp:{fetch(url, o){ g.fetches = (g.fetches||0) + 1; const out = o && o.payload ? cp.execFileSync("curl", ["-s","-X","POST","-H","Content-Type: text/plain","--data-binary","@-", url], {input:o.payload}).toString() : cp.execFileSync("curl", ["-s", url]).toString(); return {getContentText:()=>out, getResponseCode:()=>200}; }},
  Logger:{log:m=>g.logs.push(String(m))}, logs:[], Utilities:{}, Session:{}, CalendarApp:{}, ContentService:{createTextOutput:t=>({setMimeType(){return t}}), MimeType:{JSON:1}},
};
const run = new Function(...Object.keys(g), src + "\nreturn {doPost, applyInbox, migrateToCloudflare, switchToCloudflare, switchBackToDrive, mirrorFromCloudflare, readAll_};");
const api = run(...Object.values(g));
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log("FAIL", m); } };
const post = b => JSON.parse(api.doPost({postData:{contents:JSON.stringify({key:KEY, ...b})}}));
const drive = n => JSON.parse(files.find(f=>f.folder==="data" && f.name===n+".json").content);
const inbox = (name, obj) => files.push(mkFile(name, JSON.stringify(obj), "inbox"));

// the worker only knows the key after /setup (the app does that when push is switched on)
cp.execFileSync("curl",["-s","-X","POST","--data-binary",JSON.stringify({key:KEY}), W+"/setup"]);
// Drive state like today
files.push(mkFile("tasks.json", JSON.stringify({version:200, updatedAt:"x", data:{tasks:[{id:"t1", t:"Task"}]}}), "data"));
files.push(mkFile("log.json", JSON.stringify({version:90, data:{days:{}}}), "data"));
// 1. before the switch: a notices file goes to Cloudflare, a tasks file stays in Drive
inbox("notices--2026-11-07-trainer.json", {doc:"notices", mode:"patch", by:"trainer", data:{items:[{id:"trainer-sim", source:"trainer", title:"Trainer Review", summary:"3"}]}});
inbox("tasks--a.json", {doc:"tasks", mode:"patch", data:{tasks:[{id:"t1", done:true}]}});
ok(api.applyInbox() === 2, "inbox applied 2");
ok(drive("tasks").version === 201 && drive("tasks").data.tasks[0].done === true, "tasks still in Drive");
ok(post({action:"read"}).error === undefined || true, "noop");
let cfN = JSON.parse(cp.execFileSync("curl",["-s","-X","POST","--data-binary",JSON.stringify({key:KEY, action:"read", doc:"notices"}), W+"/data"]).toString());
ok(cfN.doc && cfN.doc.data.items.some(i=>i.id==="trainer-sim"), "notice reached Cloudflare");
ok(files.filter(f=>f.folder==="inbox").length === 0, "inbox empty");
// 2. migrate and switch
api.migrateToCloudflare();
ok(g.logs.some(l=>/^tasks: Drive 201, Cloudflare 201, same data/.test(l)), "migrate tasks " + g.logs.filter(l=>/tasks/.test(l)));
const setTarget = t => cp.execFileSync("curl",["-s","-X","POST","--data-binary",JSON.stringify({key:KEY, action:"setTarget", target:t}), W+"/data"]);
setTarget("cf"); g.fetches = 0; api.applyInbox();
ok(g.fetches < 15, "no recursion in the switch (" + g.fetches + " requests)");
ok(props.DATA_ON_CF === "1" && g.logs.some(l=>/docs now on Cloudflare/.test(l)), "switch through the target");
{ const h = JSON.parse(cp.execFileSync("curl",["-s", W+"/health"]).toString()); ok(h.dataLive === true, "dataLive set"); }
// 3. a device that is not switched still reads and writes, through the script
let r = post({action:"readAll"}); ok(r.ok && r.docs.tasks.version === 201, "proxied readAll");
r = post({action:"write", doc:"tasks", data:{tasks:[{id:"t1", t:"Task 2"}]}, baseVersion:201}); ok(r.ok && r.version === 202, "proxied write " + JSON.stringify(r));
r = post({action:"write", doc:"tasks", data:{tasks:[]}, baseVersion:201}); ok(r.conflict === true, "proxied conflict");
// 4. inbox now goes to Cloudflare; Drive gets the mirror
inbox("tasks--b.json", {doc:"tasks", mode:"patch", data:{tasks:[{id:"t2", t:"New"}]}});
props.LAST_MIRROR = String(Date.now()); api.applyInbox();
ok(drive("tasks").version === 201, "Drive not written directly after switch");
props.LAST_MIRROR = "0"; api.applyInbox();
ok(drive("tasks").version === 203 && drive("tasks").data.tasks.length === 2 && drive("tasks").by === "cloudflare", "mirror " + drive("tasks").version);
// 5. way back
setTarget("drive"); api.applyInbox();
ok(!props.DATA_ON_CF && g.logs.some(l=>/back on Drive/.test(l)), "switch back through the target");
{ const h = JSON.parse(cp.execFileSync("curl",["-s", W+"/health"]).toString()); ok(h.dataLive === false, "dataLive cleared"); }
r = post({action:"readAll"}); ok(r.docs.tasks.version === 203, "Drive serves again with the mirrored version");
console.log(`apps script sim: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
