import fs from "fs"; import vm from "vm";
const src = fs.readFileSync(process.argv[2], "utf8");
let driveReads = 0; const files = {}; const inbox = []; const processed = [];
const mkFile = (name, content) => ({ name, content, desc:"", getName(){return this.name}, setName(n){this.name=n}, getBlob(){ const self=this; return {getDataAsString(){ driveReads++; return self.content; }}; }, setContent(c){ this.content=c; }, setDescription(d){this.desc=d}, moveTo(f){ const i=inbox.indexOf(this); if(i>=0) inbox.splice(i,1); processed.push(this); } });
const iter = arr => { let i=0; return {hasNext:()=>i<arr.length, next:()=>arr[i++]}; };
const folder = { getId:()=>"F", getFilesByName:n=>iter(files[n]?[files[n]]:[]), createFile:(n,c)=>(files[n]=mkFile(n,c)), getFoldersByName:n=>iter([n==="inbox"?inboxF:procF]), createFolder:()=>null };
const inboxF = { getFiles:()=>iter([...inbox]) }, procF = {};
const cache = new Map(); let cacheOn = true;
const ctx = { console, JSON,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==="KEY"?"k":k==="DATA_FOLDER_ID"?"F":null, setProperty(){}})},
  DriveApp:{getFolderById:()=>folder, getFoldersByName:()=>iter([folder])},
  CacheService:{getScriptCache:()=>({ get:k=>cacheOn?cache.get(k)??null:null, getAll:ks=>{ const o={}; if(cacheOn) for(const k of ks) if(cache.has(k)) o[k]=cache.get(k); return o; }, put:(k,v)=>{ if(v.length>100000) throw new Error("too big"); cache.set(k,v); }, remove:k=>cache.delete(k), removeAll:ks=>ks.forEach(k=>cache.delete(k)) })},
  LockService:{getScriptLock:()=>({waitLock(){}, releaseLock(){}})},
  ContentService:{createTextOutput:t=>({setMimeType(){return {t};}}), MimeType:{JSON:1}},
  Utilities:{}, Session:{}, ScriptApp:{}, Logger:{log(){}}, UrlFetchApp:{fetch(){}} };
vm.createContext(ctx); vm.runInContext(src, ctx);
const call = b => JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({key:"k", ...b})}}).t);
const res=[]; const check=(l,g,w)=>{ const ok=JSON.stringify(g)===JSON.stringify(w); res.push(ok); console.log(`${ok?"OK  ":"FAIL"} ${l}: ${JSON.stringify(g)}`); };
for(const n of ["log","tasks","health"]) files[n+".json"] = mkFile(n+".json", JSON.stringify({version:5, updatedAt:"x", data:{n, big: n==="health" ? "x".repeat(120000) : ""}}));
let r = call({action:"readAll"}); check("first readAll versions", Object.fromEntries(Object.entries(r.docs).map(([k,v])=>[k,v.version])), {log:5,health:5,tasks:5});
let before = driveReads; r = call({action:"readAll"}); check("second readAll: Drive reads (only health >95 KB)", driveReads-before, 1);
r = call({action:"write", doc:"log", data:{n:"log", p:80}, baseVersion:5}); check("write ok", [r.ok, r.version], [true,6]);
r = call({action:"readAll"}); check("readAll after write sees new log", [r.docs.log.version, r.docs.log.data.p], [6,80]);
r = call({action:"write", doc:"log", data:{n:"log", p:1}, baseVersion:5}); check("stale write -> conflict with current", [r.conflict, r.current.version], [true,6]);
inbox.push(mkFile("log--20261104-130000--hq.json", JSON.stringify({doc:"log", mode:"merge", by:"hq", data:{p:140}})));
r = call({action:"readAll"}); check("readAll no longer applies inbox", [r.docs.log.version, inbox.length], [6,1]);
ctx.applyInbox(); r = call({action:"readAll"}); check("after trigger: inbox applied and cached", [r.docs.log.version, r.docs.log.data.p, inbox.length], [7,140,0]);
check("Drive file matches cache", JSON.parse(files["log.json"].content).version, 7);
cacheOn = false; r = call({action:"readAll"}); check("cache empty/expired -> Drive", r.docs.log.version, 7); cacheOn = true;
ctx.clearDocCache(); before = driveReads; r = call({action:"readAll"}); check("after clearDocCache reads all from Drive", driveReads-before, 3);
r = call({action:"write", doc:"tasks", data:{n:"tasks", t:[1]}, baseVersion:5}); r = call({action:"read", doc:"tasks"}); check("read single doc from cache", r.doc.version, 6);
// slow Drive read finishing after a write must not put the older version back into the cache
{ const v = JSON.parse(cache.get("doc:log")).version; ctx.cachePut_("log", {version: v-1, updatedAt:"old", data:{p:0}}); check("older version never replaces newer cache", JSON.parse(cache.get("doc:log")).version, v); }
console.log(res.every(Boolean)?"\nALLE OK":`\n${res.filter(x=>!x).length} FEHLER`);
