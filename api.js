/* Coach App: small api layer that replaces the claude.ai artifact capabilities (db, mcp, sample).
   Backend: Google Apps Script web app (apps-script/Code.gs) in Oti's Google account.
   Every request is a POST with Content-Type text/plain (no CORS preflight), body {key, action, ...}.
   Nothing personal lives in this file: the endpoint URL and the secret key are stored only on the device. */
"use strict";
(function(){
  const LS = {
    get(k){ try{ return JSON.parse(localStorage.getItem("coach:"+k)); }catch(e){ return null; } },
    set(k,v){ try{ localStorage.setItem("coach:"+k, JSON.stringify(v)); }catch(e){} },
    del(k){ try{ localStorage.removeItem("coach:"+k); }catch(e){} }
  };
  const DOCS = ["profile","log","health","schedule","briefing","habits","tasks","monthly"];
  // docs that the scheduled tasks also write: on a version conflict we merge (server keys survive, our values win)
  const MERGE_DOCS = new Set(["log","health"]);

  // one tap setup: https://.../#connect=<base64url of {u,k}>
  (function readHash(){
    const m = location.hash.match(/connect=([A-Za-z0-9_\-]+)/);
    if(!m) return;
    try{
      const j = JSON.parse(atob(m[1].replace(/-/g,"+").replace(/_/g,"/")));
      if(j.u && j.k) LS.set("cfg", {url:j.u, key:j.k});
    }catch(e){}
    history.replaceState(null, "", location.pathname + location.search);
  })();

  let cfg = LS.get("cfg") || null;
  const versions = LS.get("versions") || {};
  const pending = LS.get("pending") || {};       // doc -> data that could not be saved yet
  let online = null, lastErr = "";

  const configured = () => !!(cfg && cfg.url && cfg.key);

  async function call(action, params, {timeout=25000}={}){
    if(!configured()) throw Object.assign(new Error("not configured"), {code:"server_not_connected"});
    const ctl = new AbortController(); const t = setTimeout(()=>ctl.abort(), timeout);
    try{
      const r = await fetch(cfg.url, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify({key:cfg.key, action, ...(params||{})}), signal: ctl.signal, redirect:"follow"});
      const txt = await r.text();
      let j; try{ j = JSON.parse(txt); }catch(e){ throw Object.assign(new Error("Backend answered without JSON. Is the web app deployed for \"Anyone\"?"), {code:"server_unavailable"}); }
      if(j.error) throw Object.assign(new Error(j.error), {code: j.code || (j.error==="bad key" ? "needs_reauth" : "server_unavailable")});
      online = true; return j;
    }catch(e){
      if(e.name==="AbortError" || e instanceof TypeError){ online = false; e.code = e.code || "server_unavailable"; }
      lastErr = e.message || String(e); throw e;
    }finally{ clearTimeout(t); }
  }

  /* ---------- db shim: db.doc("app/<name>").get() / .set(obj) like the artifact runtime ---------- */
  const isObj = x => x && typeof x === "object" && !Array.isArray(x);
  function mergeDeep(server, mine){
    if(!isObj(server) || !isObj(mine)) return mine;
    const out = {...server};
    for(const [k,v] of Object.entries(mine)) out[k] = isObj(v) && isObj(server[k]) ? mergeDeep(server[k], v) : v;
    return out;
  }
  let prefetch = null;           // one readAll shared by all get() calls of one load
  function readAllOnce(){
    if(!prefetch) prefetch = call("readAll").then(r=>r.docs||{}).catch(e=>{ prefetch = null; throw e; });
    return prefetch;
  }
  const chains = {};             // serialize writes per doc
  async function writeDoc(name, data){
    let attempt = 0;
    while(true){
      const base = versions[name] ?? 0;
      const r = await call("write", {doc:name, data, baseVersion: base});
      if(r.ok){ versions[name] = r.version; LS.set("versions", versions); delete pending[name]; LS.set("pending", pending); return r; }
      if(r.conflict && attempt < 2){
        attempt++;
        versions[name] = r.current?.version ?? 0;
        if(MERGE_DOCS.has(name) && r.current) data = mergeDeep(r.current.data || {}, data);
        continue;
      }
      throw Object.assign(new Error("Version conflict on "+name), {code:"conflict"});
    }
  }
  function queueWrite(name, data){
    const snapshot = JSON.parse(JSON.stringify(data));
    pending[name] = snapshot; LS.set("pending", pending);
    const prev = chains[name] || Promise.resolve();
    const p = prev.catch(()=>{}).then(async ()=>{
      if(pending[name] !== snapshot) return;        // a newer write superseded this one
      return writeDoc(name, snapshot);
    });
    chains[name] = p;
    return p.catch(e=>{ if(e.code==="server_unavailable"){ return; } throw e; });   // offline: stays in pending, flushed later
  }
  async function flushPending(){
    for(const name of Object.keys(pending)){ try{ await writeDoc(name, pending[name]); }catch(e){ if(e.code==="server_unavailable") return; } }
  }
  window.addEventListener("online", ()=>flushPending());

  const db = {
    doc(path){
      const name = String(path).replace(/^app\//,"");
      return {
        async get(){
          if(pending[name]) return {exists:true, data:()=>pending[name]};   // never show older server data over an unsaved local change
          let rec = null;
          try{ const all = await readAllOnce(); rec = all[name] || null; }
          catch(e){ const c = LS.get("cache:"+name); return {exists: !!c, data: ()=>c}; }
          if(rec && (versions[name]==null || rec.version >= versions[name])){ versions[name] = rec.version; LS.set("versions", versions); LS.set("cache:"+name, rec.data); }
          return {exists: !!rec, data: ()=>rec ? rec.data : undefined};
        },
        async set(obj){ LS.set("cache:"+name, obj); return queueWrite(name, obj); }
      };
    },
    refresh(){ prefetch = null; }
  };
  // coming back to the app: the next load reads fresh data
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden){ db.refresh(); flushPending(); } });

  /* ---------- mcp shim: same call shapes the v67 code used for Google Calendar and Google Drive ---------- */
  const mcp = {
    async callTool(server, tool, input){
      if(/calendar/i.test(server)){
        if(tool==="list_calendars"){ const r = await call("calendars"); return {payload:{calendars:r.calendars}}; }
        if(tool==="list_events"){ const r = await call("events", {calendarId: input.calendarId || "primary", startTime: input.startTime, endTime: input.endTime}); return {payload:{events:r.events}}; }
      }
      if(/drive/i.test(server)){
        if(tool==="search_files"){ const r = await call("driveSearch", {query: input.query, pageSize: input.pageSize||25}); return {payload:{files:r.files}}; }
        if(tool==="download_file_content"){ const r = await call("driveDownload", {fileId: input.fileId}, {timeout:40000}); return {payload:{content:r.content}}; }
      }
      throw Object.assign(new Error("unsupported "+server+"/"+tool), {code:"not_in_manifest"});
    },
    watchTool(server, tool, input, cb, {refetchInterval}={}){
      let stop = false;
      const run = async ()=>{
        try{ const r = await mcp.callTool(server, tool, input); if(!stop) cb({type:"data", result:{payload:r.payload, cache:{storedAt:Date.now()}}}); }
        catch(e){ if(!stop) cb({type:"error", error:{code:e.code||"server_unavailable", message:e.message}}); }
      };
      run(); const id = refetchInterval ? setInterval(run, refetchInterval) : null;
      return ()=>{ stop = true; if(id) clearInterval(id); };
    }
  };

  /* ---------- Coach button: open claude.ai with the prompt prefilled (stays inside Oti's subscription) ---------- */
  async function copy(text){
    try{ await navigator.clipboard.writeText(text); return true; }
    catch(e){ try{ const ta = document.createElement("textarea"); ta.value = text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; }catch(e2){ return false; } }
  }
  const MAX_URL = 12000;   // [Guessing] safe length for a claude.ai link; longer prompts go via clipboard
  function coachUrl(prompt){
    const enc = encodeURIComponent(prompt);
    return enc.length <= MAX_URL ? "https://claude.ai/new?q="+enc : "https://claude.ai/new";
  }
  async function openCoach(prompt){
    const copied = await copy(prompt);
    const url = coachUrl(prompt);
    window.__lastCoachUrl = url;
    const w = window.open(url, "_blank", "noopener");
    if(!w) location.href = url;
    return {url, copied, prefilled: url.includes("?q=")};
  }
  // sample() kept so the v67 code path stays valid: it opens Claude instead of streaming an answer here
  async function sample(prompt){
    const r = await openCoach(prompt);
    return {text: r.prefilled
      ? "Opened Claude with your data in a new tab. The prompt is also on your clipboard."
      : "Opened Claude in a new tab. The prompt was too long for the link, so it is on your clipboard: paste it there."};
  }

  /* ---------- Push: coach push worker on Cloudflare (worker/ in this repo) ----------
     Uses the same secret key as the Apps Script backend; the worker only keeps its hash.
     iPhone: works only when the app is opened from the Home Screen (iOS 16.4+). */
  const PUSH_URL = "https://coach-push.othniel-erdei.workers.dev";
  const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const deviceName = () => /iPhone/.test(navigator.userAgent) ? "iPhone" : /iPad/.test(navigator.userAgent) ? "iPad" : /Mac/.test(navigator.userAgent) ? "Mac" : "Browser";
  async function pushCall(path, body){
    const r = await fetch(PUSH_URL + path, {method: body ? "POST" : "GET", headers: body ? {"Content-Type":"text/plain;charset=utf-8"} : undefined, body: body ? JSON.stringify(body) : undefined});
    const j = await r.json().catch(()=>({error:"bad answer"}));
    if(!r.ok || j.error) throw Object.assign(new Error(j.error || ("HTTP "+r.status)), {code: j.code || r.status});
    return j;
  }
  function keyToBytes(b64){ const s = b64.replace(/-/g,"+").replace(/_/g,"/"); const bin = atob(s + "===".slice((s.length+3)%4)); return Uint8Array.from(bin, c=>c.charCodeAt(0)); }
  async function pushSubscribe({ask}={}){
    if(!configured()) throw new Error("Connect the backend first.");
    if(!pushSupported()) throw new Error(standalone() ? "This browser has no push support." : "Open the app from the Home Screen icon, then try again.");
    if(Notification.permission !== "granted"){
      if(!ask) return null;
      const p = await Notification.requestPermission();
      if(p !== "granted") throw new Error("Notifications are not allowed. iPhone: Settings > Notifications > Coach.");
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const last = LS.get("pushEndpoint");
    if(!sub){
      const {publicKey} = await pushCall("/vapid");
      sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey)});
    }
    await pushCall("/setup", {key: cfg.key});
    const j = sub.toJSON();
    await pushCall("/subscribe", {key: cfg.key, device: deviceName(), subscription: {endpoint: j.endpoint, keys: j.keys}, replaces: last && last !== j.endpoint ? last : undefined});
    LS.set("pushEndpoint", j.endpoint); LS.set("pushChecked", Date.now());
    return j.endpoint;
  }
  // each time the app comes to the front: re-send the subscription (iOS can drop or rotate it without notice)
  async function pushRefresh(){
    try{
      if(!configured() || !pushSupported() || Notification.permission !== "granted") return;
      if(Date.now() - (LS.get("pushChecked")||0) < 6*3600*1000) return;
      await pushSubscribe({ask:false});
    }catch(e){ LS.set("pushError", String(e.message||e)); }
  }
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) pushRefresh(); });
  setTimeout(pushRefresh, 4000);
  const pushTest = () => pushCall("/push", {key: cfg.key, title: "Coach test", body: "Push from your Coach app works. " + new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}), tag: "test", by: "app test"});
  const pushStatus = () => pushCall("/status", {key: cfg.key});

  function pushHtml(e){
    const perm = pushSupported() ? Notification.permission : "unsupported";
    const on = perm === "granted" && LS.get("pushEndpoint");
    const hint = !standalone() && /iPhone|iPad/.test(navigator.userAgent) ? "Open the app from the Home Screen icon to turn on push." :
      perm === "denied" ? "Blocked. iPhone: Settings > Notifications > Coach > Allow." : "";
    return `<div class="card" id="pushCard"><div class="spread"><h3>Push notifications</h3><span class="chip ${on?"g":"y"}"><span class="dot"></span>${on?"On":"Off"}</span></div>
      <p class="small muted">Briefings and reminders come straight from your app. Claude's own pushes stay on until this has worked 3 times.</p>
      <div class="row"><button class="primary" id="pushOn">${on?"Renew push":"Turn on push"}</button><button class="ghost" id="pushTest" ${on?"":"disabled"}>Send test push</button><button class="ghost" id="pushStat" ${configured()?"":"disabled"}>Status</button></div>
      <p id="pushMsg" class="small muted">${e(hint || LS.get("pushError") || "")}</p></div>`;
  }
  function bindPush(){
    const m = t => { const x = document.getElementById("pushMsg"); if(x) x.textContent = t; };
    const on = document.getElementById("pushOn"); if(!on) return;
    on.onclick = async ()=>{ m("Turning on…"); try{ await pushSubscribe({ask:true}); LS.del("pushError"); m("Push is on. Tap \"Send test push\"."); const t = document.getElementById("pushTest"); if(t) t.disabled = false; }catch(err){ m("Not on: " + (err.message||err)); } };
    const t = document.getElementById("pushTest");
    if(t) t.onclick = async ()=>{ m("Sending…"); try{ const r = await pushTest(); m(r.delivered ? `Sent to ${r.delivered} device(s). It should arrive in a few seconds.` : `Not delivered: ${JSON.stringify(r.results||r)}`); }catch(err){ m("Error: " + (err.message||err)); } };
    const s = document.getElementById("pushStat");
    if(s) s.onclick = async ()=>{ m("Checking…"); try{ const r = await pushStatus(); m(`${r.subs.length} device(s). Last: ` + (r.log.slice(0,3).map(x=>`${x.ts.slice(5,16).replace("T"," ")} ${x.kind} ${x.delivered??""}/${x.sent??""}`).join(" · ") || "nothing yet")); }catch(err){ m("Error: " + (err.message||err)); } };
  }

  /* ---------- Setup card ---------- */
  function connectLink(){
    if(!configured()) return "";
    const b = btoa(JSON.stringify({u:cfg.url, k:cfg.key})).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    return location.origin + location.pathname + "#connect=" + b;
  }
  function setupCard(){
    const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const st = !configured() ? ["y","Not connected"] : online===false ? ["y","Offline"] : online ? ["g","Connected"] : ["","Not checked"];
    const p = Object.keys(pending).length;
    return `<div class="card" id="apiCard"><div class="spread"><h3>Backend</h3><span class="chip ${st[0]}"><span class="dot"></span>${e(st[1])}</span></div>
      <p class="small muted">Your data lives in the Google Drive folder "Coach Data", read and written by your own Apps Script web app. URL and key are stored only on this device.</p>
      <label class="f" for="apiUrl">Web app URL<input id="apiUrl" placeholder="https://script.google.com/macros/s/.../exec" value="${e(cfg?.url||"")}"></label>
      <label class="f" for="apiKey">Secret key<input id="apiKey" type="password" autocomplete="off" value="${e(cfg?.key||"")}"></label>
      <div class="row"><button class="primary" id="apiSave">Connect</button><button class="ghost" id="apiLink" ${configured()?"":"disabled"}>Copy link for iPhone</button><span id="apiMsg" class="small muted">${p?`${p} change(s) waiting to sync. `:""}${e(lastErr && online===false ? lastErr : "")}</span></div></div>` + pushHtml(e);
  }
  function bindSetup(){
    bindPush();
    const s = document.getElementById("apiSave"); if(!s) return;
    s.onclick = async ()=>{
      const url = document.getElementById("apiUrl").value.trim(), key = document.getElementById("apiKey").value.trim();
      const msg = document.getElementById("apiMsg");
      cfg = {url, key}; LS.set("cfg", cfg); msg.textContent = "Checking…";
      try{ const r = await call("ping"); msg.textContent = `Connected as ${r.user||"you"}. ${r.docs?.length||0} docs found. Reloading…`; setTimeout(()=>location.reload(), 900); }
      catch(e){ msg.textContent = "Not connected: " + (e.message||e); }
    };
    const l = document.getElementById("apiLink");
    if(l) l.onclick = async ()=>{ const ok = await copy(connectLink()); document.getElementById("apiMsg").textContent = ok ? "Link copied. Send it to your iPhone (AirDrop or Notes) and open it in Safari once." : connectLink(); };
  }

  window.API = {db, mcp, sample, openCoach, coachUrl, configured, setupCard, bindSetup, call, flushPending,
    push: {subscribe: pushSubscribe, test: ()=>pushTest(), status: ()=>pushStatus(), url: PUSH_URL},
    status: ()=>({configured: configured(), online, pending: Object.keys(pending).length, lastErr}), DOCS};
})();
