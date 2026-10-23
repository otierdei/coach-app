/* Oti Hybrid Coach, GitHub version. Generated from the claude.ai artifact v67 by tools/build_from_v67.py.
   db, mcp and sample are provided by api.js (Google Apps Script backend).
   The code is split into several classic scripts that share one global scope; load them in order. */
function renderTasksEverywhere(){
  if(tab==="tasks") renderTasks();
  else if(tab==="today"){ const c = document.querySelector("#v-today [data-tkcard]"); if(c){ c.outerHTML = todayTasksCard(); bindTasks($("#v-today")); tickClock(); } }
  if(!$("#sheet").hidden && $("#sheetBody").dataset.tk) openTask($("#sheetBody").dataset.tk, true);
}
function bindTasks(root){
  root.querySelectorAll("[data-tk-seg]").forEach(b=>b.onclick = ()=>{ taskSeg = b.dataset.tkSeg; try{ sessionStorage.setItem("ohc-taskseg", taskSeg); }catch(e){} renderTasks(); });
  root.querySelectorAll("[data-tk-done]").forEach(b=>b.onclick = ()=>{ const now = Date.now(); if(now - tkTapAt < 900) return; tkTapAt = now; const t = tasksDoc.tasks.find(x=>x.id===b.dataset.tkDone); if(t) setDone(t, !t.done); });
  root.querySelectorAll("[data-tk-open]").forEach(b=>b.onclick = ()=>openTask(b.dataset.tkOpen));
  root.querySelectorAll("[data-tk-pin]").forEach(b=>b.onclick = ()=>{ const t = tasksDoc.tasks.find(x=>x.id===b.dataset.tkPin); if(t) pinToday(t); });
  root.querySelectorAll("[data-tk-stop]").forEach(b=>b.onclick = ()=>stopTimer());
  root.querySelectorAll("[data-tk-new]").forEach(b=>b.onclick = ()=>openTask(null, false, {area:b.dataset.tkNew}));
  root.querySelectorAll("[data-goto-tasks]").forEach(b=>b.onclick = ()=>{ taskSeg = "today"; switchTab("tasks"); });
  root.querySelectorAll("details.tk-area").forEach(d=>d.addEventListener("toggle", ()=>{ d.open ? tkOpenAreas.add(d.dataset.tkArea) : tkOpenAreas.delete(d.dataset.tkArea); try{ sessionStorage.setItem("ohc-tkareas", JSON.stringify([...tkOpenAreas])); }catch(e){} }));
  const qa = root.querySelector("#tkQuickAdd"), qi = root.querySelector("#tkQuick");
  const add = async ()=>{ const title = qi.value.trim(); if(!title) return; const [area, sub] = (root.querySelector("#tkQuickArea").value||"|").split("|");
    tasksDoc.tasks.push(newTask({title, area:area||null, sub:sub||null})); qi.value = ""; renderTasks(); await saveTasks(); };
  if(qa) qa.onclick = add; if(qi) qi.onkeydown = e=>{ if(e.key==="Enter") add(); };
  root.querySelectorAll("[data-tk-keep]").forEach(b=>b.onclick = async ()=>{ const t = tasksDoc.tasks.find(x=>x.id===b.dataset.tkKeep); if(!t) return; const [a,s] = (root.querySelector(`[data-tk-revarea="${t.id}"]`).value||"|").split("|"); t.area = a||null; t.sub = s||null; t.review = false; renderTasks(); await saveTasks(); });
  root.querySelectorAll("[data-tk-revdone]").forEach(b=>b.onclick = async ()=>{ const t = tasksDoc.tasks.find(x=>x.id===b.dataset.tkRevdone); if(!t) return; t.review = false; t.done = true; t.doneAt = null; renderTasks(); await saveTasks(); });
  root.querySelectorAll("[data-tk-del]").forEach(b=>b.onclick = async ()=>{ if(b.dataset.armed!=="1"){ b.dataset.armed="1"; b.textContent = L("Tap again","Nochmal tippen"); return; } tasksDoc.tasks = tasksDoc.tasks.filter(x=>x.id!==b.dataset.tkDel); renderTasks(); await saveTasks(); });
}

/* ----- task sheet ----- */
function openTask(id, refresh, preset){
  const found = id ? tasksDoc.tasks.find(x=>x.id===id) : null;
  if(id && !found){ closeSheet(); return; }
  renderTaskSheet(found || newTask(preset||{}), !found);
}
function renderTaskSheet(t, isNew){
  const running = tasksDoc.timer?.task===t.id, p = tProgress(t), sp = tSpent(t), est = tEst(t);
  const stRows = (t.stages||[]).map((s,i)=>`<div class="tk-st${s.done?" done":""}">
      <button type="button" class="check ${s.done?"on":""}" data-st-done="${s.id}" aria-pressed="${!!s.done}" aria-label="${L("Stage done","Etappe erledigt")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></button>
      <input value="${esc(s.n)}" data-st-name="${s.id}" aria-label="${L("Stage name","Name der Etappe")}">
      <label class="tk-est"><input type="number" min="0" step="5" value="${s.est||""}" data-st-est="${s.id}" aria-label="${L("Estimated minutes","Geschätzte Minuten")}"><span>min</span></label>
      <span class="mono small muted tk-spent">${s.spent?dur(s.spent):"–"}</span>
      <button type="button" class="ghost tk-play${running&&tasksDoc.timer.stage===s.id?" on":""}" data-st-play="${s.id}" aria-label="${L("Start stopwatch for this stage","Stoppuhr für diese Etappe")}">${running&&tasksDoc.timer.stage===s.id?"■":"▶"}</button>
      <button type="button" class="ghost tk-x" data-st-del="${s.id}" aria-label="${L("Remove stage","Etappe entfernen")}">×</button></div>`).join("");
  const body = `<div data-notr style="display:grid;gap:12px">
    ${!isNew?`<div class="row" style="gap:8px">${tBar(t,true)}</div><div class="row small muted" style="gap:14px"><span><b class="mono" style="color:var(--ink)">${Math.round(p*100)}%</b> ${L("done","erledigt")}</span>${est?`<span>${L("estimate","Schätzung")} <b class="mono">${dur(est)}</b></span>`:""}${sp?`<span>${L("tracked","gemessen")} <b class="mono">${dur(sp)}</b></span>`:""}</div>`:""}
    <label class="f">${L("Task","Aufgabe")}<input id="tkTitle" value="${esc(t.title)}"></label>
    <div class="grid2"><label class="f">${L("Area","Bereich")}<select id="tkArea" style="width:100%;min-width:0">${areaOptions(t.area,t.sub,true)}</select></label><label class="f">${L("Due","Fällig")}<input type="date" id="tkDue" value="${t.due||""}"></label></div>
    <div class="grid2"><label class="f">${L("Priority","Priorität")}<select id="tkPrio"><option value="normal"${t.prio!=="high"?" selected":""}>${L("Normal","Normal")}</option><option value="high"${t.prio==="high"?" selected":""}>${L("High","Hoch")}</option></select></label>
      <label class="f">${L("Repeats","Wiederholt")}<select id="tkRec"><option value="">${L("No","Nein")}</option><option value="weekly"${t.rec?.freq==="weekly"?" selected":""}>${L("Every week","Jede Woche")}</option><option value="biweekly"${t.rec?.freq==="weekly"&&t.rec.every===2?" selected":""}>${L("Every 2 weeks","Alle 2 Wochen")}</option><option value="monthly"${t.rec?.freq==="monthly"?" selected":""}>${L("Every month","Jeden Monat")}</option></select></label></div>
    <label class="f">${L("Next step and when (makes it stick)","Nächster Schritt und wann (macht es verbindlich)")}<input id="tkNext" value="${esc(t.next||"")}" placeholder="${L("e.g. Thu deep work: write outline","z. B. Do Deep Work: Gliederung schreiben")}"></label>
    <div style="display:grid;gap:8px"><div class="spread"><b>${L("Stages","Etappen")}</b><span class="small muted">${L("weighted by minutes","gewichtet nach Minuten")}</span></div>
      ${stRows||`<p class="small muted">${L("No stages. Add some or use a template.","Keine Etappen. Füge welche hinzu oder nimm eine Vorlage.")}</p>`}
      <div class="row" style="gap:6px;flex-wrap:nowrap"><input id="tkStNew" placeholder="${L("New stage","Neue Etappe")}" style="flex:1"><button type="button" class="ghost" id="tkStAdd">+</button></div>
      <div class="row" style="gap:6px"><select id="tkTpl" aria-label="${L("Template","Vorlage")}" style="width:100%;min-width:0"><option value="">${L("Use a template…","Vorlage verwenden…")}</option>${tasksDoc.templates.map(x=>`<option value="${x.id}">${esc(x.name)} (${x.stages.length})</option>`).join("")}</select></div></div>
    ${!isNew?`<div class="row" style="gap:8px">${running?`<button type="button" class="primary" data-tk-stop>■ ${L("Stop","Stopp")} <span class="mono" id="tkClock">${fmtClock(timerMin())}</span></button>`:`<button type="button" class="ghost" id="tkPlay">▶ ${L("Start stopwatch","Stoppuhr starten")}</button>`}<button type="button" class="ghost" id="tkPinS">${t.today===todayK()?"★ "+L("On today","Für heute"):"☆ "+L("Pin to today","Für heute")}</button></div>`:""}
    <label class="row small" style="gap:8px;color:var(--muted)"><input type="checkbox" id="tkShared" ${t.shared?"checked":""} style="min-height:0;width:18px;height:18px"> ${L("Shareable later (only visible to others once you share the app)","Später teilbar (für andere erst sichtbar, wenn du die App teilst)")}</label>
    <div class="row" style="gap:8px"><button type="button" class="primary" id="tkSave">${isNew?L("Add task","Aufgabe anlegen"):L("Save","Speichern")}</button>${!isNew?`<button type="button" class="ghost" id="tkDoneS">${t.done?L("Reopen","Wieder öffnen"):L("Mark done","Erledigt")}</button><button type="button" class="ghost" id="tkDel">${L("Delete","Löschen")}</button>`:""}</div>
  </div>`;
  const title = isNew ? L("New task","Neue Aufgabe") : t.title || L("Task","Aufgabe");
  const draft = {stages: structuredClone(t.stages||[])};
  const bind = root => {
    root.dataset.tk = isNew ? "" : t.id;
    const collect = () => { const [a,s] = (root.querySelector("#tkArea").value||"|").split("|"); const rv = root.querySelector("#tkRec").value;
      return {title: root.querySelector("#tkTitle").value.trim(), area:a||null, sub:s||null, due: root.querySelector("#tkDue").value||null, prio: root.querySelector("#tkPrio").value,
        next: root.querySelector("#tkNext").value.trim(), rec: rv? {freq: rv==="biweekly"?"weekly":rv, every: rv==="biweekly"?2:1} : null, shared: root.querySelector("#tkShared").checked}; };
    const syncStages = () => { root.querySelectorAll("[data-st-name]").forEach(i=>{ const s = draft.stages.find(x=>x.id===i.dataset.stName); if(s) s.n = i.value.trim()||s.n; });
      root.querySelectorAll("[data-st-est]").forEach(i=>{ const s = draft.stages.find(x=>x.id===i.dataset.stEst); if(s) s.est = Number(i.value)||0; }); };
    const commit = async (close) => { const v = collect(); if(!v.title){ root.querySelector("#tkTitle").focus(); return false; } syncStages();
      Object.assign(t, v, {stages: draft.stages}); if(isNew){ tasksDoc.tasks.push(t); isNew = false; }
      if(close) closeSheet(); renderTasksEverywhere(); await saveTasks(); return true; };
    root.querySelector("#tkSave").onclick = ()=>commit(true);
    root.querySelector("#tkStAdd").onclick = ()=>{ const n = root.querySelector("#tkStNew").value.trim(); if(!n) return; syncStages(); draft.stages.push({id:uid(), n, est:30, done:false, spent:0}); Object.assign(t, collect(), {stages:draft.stages}); if(!t.title) t.title = ""; reopen(); };
    root.querySelector("#tkTpl").onchange = e=>{ const id = e.target.value; if(!id) return; syncStages(); draft.stages = draft.stages.concat(stagesFromTpl(id)); const v = collect(); Object.assign(t, v, {stages:draft.stages, tpl:id}); if(!v.title){ const tp = tasksDoc.templates.find(x=>x.id===id); t.title = tp?.name||""; } reopen(); };
    root.querySelectorAll("[data-st-del]").forEach(b=>b.onclick = ()=>{ syncStages(); draft.stages = draft.stages.filter(s=>s.id!==b.dataset.stDel); Object.assign(t, collect(), {stages:draft.stages}); reopen(); });
    root.querySelectorAll("[data-st-done]").forEach(b=>b.onclick = async ()=>{ if(isNew){ syncStages(); const s = draft.stages.find(x=>x.id===b.dataset.stDone); if(s) s.done = !s.done; Object.assign(t, collect(), {stages:draft.stages}); reopen(); return; }
      if(!(await commit(false))) return; await toggleStage(t, b.dataset.stDone); });
    root.querySelectorAll("[data-st-play]").forEach(b=>b.onclick = async ()=>{ if(!(await commit(false))) return; const sid = b.dataset.stPlay;
      if(tasksDoc.timer?.task===t.id && tasksDoc.timer.stage===sid) await stopTimer(); else await startTimer(t.id, sid); });
    const pl = root.querySelector("#tkPlay"); if(pl) pl.onclick = async ()=>{ if(await commit(false)) await startTimer(t.id); };
    root.querySelectorAll("[data-tk-stop]").forEach(b=>b.onclick = ()=>stopTimer());
    const pn = root.querySelector("#tkPinS"); if(pn) pn.onclick = async ()=>{ if(await commit(false)) await pinToday(t); };
    const dn = root.querySelector("#tkDoneS"); if(dn) dn.onclick = async ()=>{ if(await commit(false)){ closeSheet(); await setDone(t, !t.done); } };
    const dl = root.querySelector("#tkDel"); if(dl) dl.onclick = async ()=>{ if(dl.dataset.armed!=="1"){ dl.dataset.armed="1"; dl.textContent = L("Tap again to delete","Nochmal tippen zum Löschen"); return; }
      if(tasksDoc.timer?.task===t.id) tasksDoc.timer = null; tasksDoc.tasks = tasksDoc.tasks.filter(x=>x.id!==t.id); closeSheet(); renderTasksEverywhere(); await saveTasks(); };
    tickClock();
  };
  const reopen = () => renderTaskSheet(t, isNew);
  openSheet(title, body, bind);
}

/* ================= shell ================= */
function render(){
  try{
    if(tab==="today"){ renderToday(); injectTodayTasks(); } else if(tab==="tasks") renderTasks(); else if(tab==="week") renderWeek(); else if(tab==="sleep"){ renderSleep(); fitSeg(); } else if(tab==="progress"){ renderProgress(); fitSeg(); } else if(tab==="life") renderLife(); else if(!$("#v-setup").innerHTML) renderSetup();
    if(tab!=="today") closeTraining(true);
  }catch(e){ console.error(e); }
  if(calState.status==="ok") setSync("g","Live"); else if(calState.status==="err") setSync("y","Template only"); else if(calState.status==="loading") setSync("","Syncing"); else setSync("","Offline");
}
function injectTodayTasks(){
  const v = $("#v-today"); if(!v || v.querySelector("[data-tkcard]")) return;
  const cards = v.querySelectorAll(":scope > .card"); const tmp = document.createElement("div"); tmp.innerHTML = todayTasksCard(); const c = tmp.firstElementChild; if(!c) return;
  const slot = v.querySelector("[data-tk-slot]");
  if(slot) slot.replaceWith(c); else if(cards.length) cards[0].after(c); else v.appendChild(c);
  bindTasks(v); tickClock();
}
// api.js merged a write with a newer server copy: continue with the merged doc (never write the old copy again)
window.addEventListener("coach:merged", e=>{ const {name, data} = e.detail||{};
  if(name==="log") logData = {days:{}, ...data}; else if(name==="health") health = {days:{}, workouts:[], sources:[], driveSeen:{}, ...data}; else return;
  try{ bumpLog(); }catch(err){} planCache.clear(); render(); });
// Fitness (23.10.2026): one tab in the bar for Progress and Sleep, switched with sub tabs at the top
let fitSub = "progress";
// the sub tabs survive direct re-renders (e.g. after changing a workout type in its sheet)
{ const rp = renderProgress, rs = renderSleep; renderProgress = function(){ rp(); if(tab==="progress") fitSeg(); }; renderSleep = function(){ rs(); if(tab==="sleep") fitSeg(); }; }
function fitSeg(){
  const v = $("#v-"+tab); if(!v || v.querySelector(":scope > .fseg")) return;
  const d = document.createElement("div"); d.className = "fseg"; d.setAttribute("role","group"); d.setAttribute("aria-label", L("Fitness area","Fitness Bereich"));
  d.innerHTML = [["progress",L("Progress","Fortschritt")],["sleep",L("Sleep","Schlaf")]].map(([k,t])=>`<button type="button" data-fit="${k}" aria-pressed="${tab===k}">${t}</button>`).join("");
  const head = v.firstElementChild; if(head && !head.classList.contains("card")) head.after(d); else v.prepend(d);
  d.querySelectorAll("[data-fit]").forEach(b=>b.onclick = ()=>switchTab(b.dataset.fit));
}
function switchTab(t){
  if(t==="fitness") t = fitSub;
  if(t==="today" && trainOpen) closeTraining(true);
  if(t==="sleep" || t==="progress") fitSub = t;
  tab = t; try{ sessionStorage.setItem("ohc-tab", t); }catch(e){}
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.tab===t || (b.dataset.tab==="fitness" && (t==="sleep" || t==="progress")))));
  document.querySelectorAll("section.view").forEach(s=>s.hidden = s.id !== "v-"+t); document.body.classList.toggle("on-tasks", t==="tasks");
  if(t==="setup") renderSetup(); else render();
  window.scrollTo(0,0);
}
document.querySelectorAll("nav.tabs button").forEach(b=>b.addEventListener("click", ()=>switchTab(b.dataset.tab)));
$("#gearBtn").addEventListener("click", ()=>switchTab(tab==="setup" ? "today" : "setup"));
document.addEventListener("visibilitychange", async ()=>{ if(document.hidden || !db) return; try{ await loadDocs(); if(autoTop3()) saveTasks(); planCache.clear(); render(); }catch(e){} });
(async function boot(){
  try{ const t = sessionStorage.getItem("ohc-tab"); if(t) tab = t; }catch(e){}
  if(window.API && !API.configured()) tab = "setup";
  switchTab(tab);
  if(window.API && API.configured()){ [db, mcp, sample] = [API.db, API.mcp, API.sample]; }
  else { calState = {status:"off", msg:"Connect the backend in Setup (gear icon)."}; driveState = {status:"off", msg:"Connect the backend in Setup (gear icon)."}; }
  await loadDocs(); if(autoTop3()) saveTasks(); planCache.clear(); if(reconcileTicks()) saveDoc("log", logData);
  startCalendar();
  switchTab(tab);
  writeSchedule(false);
  syncHealthCalendar().then(()=>syncDrive(false)).then(()=>syncSleepStages()).then(()=>{
    // data from the Shortcut can land a few seconds after the app opens: look again after 20 s and 60 s
    // also picks up workouts of today when the Shortcut ran in the afternoon
    for(const ms of [20000, 60000]) setTimeout(async ()=>{ setSync("","Syncing"); await syncHealthCalendar(); await syncDrive(false); await syncSleepStages(); planCache.clear(); render(); }, ms);
  });
})();
