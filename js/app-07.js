/* Oti Hybrid Coach, GitHub version. Generated from the claude.ai artifact v67 by tools/build_from_v67.py.
   db, mcp and sample are provided by api.js (Google Apps Script backend).
   The code is split into several classic scripts that share one global scope; load them in order. */
function openPlan(){
  const body = `<div class="grid2"><label class="f" for="plDate">${L("Date","Datum")}<input id="plDate" type="date" value="${dateKey(new Date())}"></label><label class="f" for="plTime">${L("Time","Uhrzeit")}<input id="plTime" type="time" value="10:00"></label>
    <label class="f" for="plKind">${L("What","Was")}<select id="plKind"><option value="song">${L("Song pipeline","Song Pipeline")}</option><option value="reels">${L("Drum reels","Drum Reels")}</option></select></label>
    <label class="f" for="plMin">${L("Minutes","Minuten")}<input id="plMin" type="number" value="60" min="15" step="15"></label></div>
    <label class="row" for="plWeekly" style="gap:10px;font-size:14px"><input type="checkbox" id="plWeekly" style="min-height:0;width:22px;height:22px"> ${L("Repeat every week on this weekday","Jede Woche an diesem Wochentag wiederholen")}</label>
    <button type="button" class="primary" id="plSave">${L("Plan it","Planen")}</button>`;
  openSheet(L("Plan a music session","Musik Session planen"), body, el=>{ el.querySelector("#plSave").onclick = async ()=>{
    const d = el.querySelector("#plDate").value, p = {id:uid(), time:el.querySelector("#plTime").value||"10:00", kind:el.querySelector("#plKind").value, min:Number(el.querySelector("#plMin").value)||60};
    if(!d) return;
    if(el.querySelector("#plWeekly").checked) habits.musicPlan.weekly.push({...p, dow:fromKey(d).getDay()});
    else (habits.musicPlan.dates[d] = habits.musicPlan.dates[d]||[]).push(p);
    for(const x of Object.keys(habits.musicPlan.dates)) if(x < dateKey(addDays(new Date(),-14))) delete habits.musicPlan.dates[x];
    closeSheet(); render(); await saveHabits(); }; });
}

/* ---------- render + bind ---------- */
function renderLife(){
  const seg = `<div class="pw-seg" role="group" aria-label="${L("Area","Bereich")}"><button type="button" data-seg="spirit" aria-pressed="${lifeSeg==="spirit"}">${L("Spiritual life","Geistliches Leben")}</button><button type="button" data-seg="music" aria-pressed="${lifeSeg==="music"}">${L("Music","Musik")}</button></div>`;
  $("#v-life").innerHTML = lifeSeg==="spirit"
    ? `<div class="ptw" data-notr>${seg}${spiritHtml()}</div>`
    : `<div data-notr style="display:grid;gap:14px"><div class="ptw" style="padding-block:14px 4px;background:transparent">${seg}</div>${musicHtml()}</div>`;
  const root = $("#v-life");
  root.querySelectorAll("[data-seg]").forEach(b=>b.onclick = ()=>{ lifeSeg = b.dataset.seg; try{ sessionStorage.setItem("ohc-lifeseg", lifeSeg); }catch(e){} renderLife(); });
  bindHabitTicks(root);
  root.querySelectorAll("[data-prompt]").forEach(b=>b.onclick = async ()=>{ const id = b.dataset.prompt, per = b.dataset.per, k = dateKey(new Date()), list = habits.prompts[id] = habits.prompts[id]||[];
    if(promptDone(id, per).done){ const r = promptDone(id, per); habits.prompts[id] = list.filter(x=>x!==r.last); } else list.push(k); renderLife(); await saveHabits(); });
  root.querySelectorAll("[data-open-prayer]").forEach(b=>b.onclick = ()=>{ const d = $("#pr-"+b.dataset.openPrayer); if(d){ const m = d.closest(".lmore"); if(m) m.open = true; d.open = true; d.scrollIntoView({behavior:"smooth", block:"start"}); } });
  root.querySelectorAll("[data-irr]").forEach(b=>b.onclick = async ()=>{ const wk = dateKey(mondayOf(new Date())); habits.fruit[wk] = {...(habits.fruit[wk]||{}), irr:Number(b.dataset.irr)}; renderLife(); await saveHabits(); });
  const ns = $("#pwNoteSave"); if(ns) ns.onclick = async ()=>{ const wk = dateKey(mondayOf(new Date())); habits.fruit[wk] = {...(habits.fruit[wk]||{}), note:$("#pwNote").value.trim()}; ns.textContent = L("Saved","Gespeichert"); await saveHabits(); };
  const br = $("#pwBreath"); if(br) br.onclick = ()=>breathe(br);
  // music
  const ml = $("#muLog"); if(ml) ml.onclick = ()=>openMusicLog();
  const pa = $("#muPlanAdd"); if(pa) pa.onclick = openPlan;
  root.querySelectorAll("[data-unplan]").forEach(b=>b.onclick = async ()=>{ const [d,id] = b.dataset.unplan.split("|");
    if(habits.musicPlan.dates[d]?.some(p=>p.id===id)){ habits.musicPlan.dates[d] = habits.musicPlan.dates[d].filter(p=>p.id!==id); if(!habits.musicPlan.dates[d].length) delete habits.musicPlan.dates[d]; }
    else { habits.musicPlan.skip = (habits.musicPlan.skip||[]).filter(x=>x>=dateKey(addDays(new Date(),-7))); habits.musicPlan.skip.push(d+"|"+id); }
    renderLife(); await saveHabits(); });
  const sa = $("#songAdd"); if(sa) sa.onclick = async ()=>{ const t = $("#songNew").value.trim(); if(!t) return; habits.songs.push({id:uid(), title:t, stage:0, added:dateKey(new Date())}); renderLife(); await saveHabits(); };
  root.querySelectorAll("[data-song]").forEach(b=>b.onclick = async ()=>{ const s = habits.songs.find(x=>x.id===b.dataset.song); if(!s) return; s.stage = Number(b.dataset.stage); s.updated = dateKey(new Date()); renderLife(); await saveHabits(); });
  root.querySelectorAll("[data-song-del]").forEach(b=>b.onclick = async ()=>{ if(b.dataset.armed!=="1"){ b.dataset.armed="1"; b.textContent = L("Tap again to remove","Nochmal tippen zum Entfernen"); return; } habits.songs = habits.songs.filter(x=>x.id!==b.dataset.songDel); renderLife(); await saveHabits(); });
  root.querySelectorAll("[data-mu-del]").forEach(b=>b.onclick = async ()=>{ if(b.dataset.armed!=="1"){ b.dataset.armed="1"; b.textContent = L("Sure?","Sicher?"); return; } const [k,id] = b.dataset.muDel.split("|"); const H = hab(k); H.mu = (H.mu||[]).filter(x=>x.id!==id); renderLife(); await saveLogH(); });
  const fs = $("#fcSave"); if(fs) fs.onclick = async ()=>{ const t = $("#fcText").value.trim(); const F = habits.focus;
    if(t && t!==F.text) F.from = dateKey(new Date()); F.text = t; F.startBpm = Number($("#fcStart").value)||null; F.targetBpm = Number($("#fcTarget").value)||null; renderLife(); await saveHabits(); };
}
function bindHabitTicks(root){
  root.querySelectorAll("[data-hab]").forEach(b=>b.onclick = async ()=>{ const k = dateKey(new Date()), H = hab(k), f = b.dataset.hab; H[f] = !H[f]; if(!H[f]) delete H[f]; render(); await saveLogH(); });
}
let breathTimer = null;
function breathe(btn){
  const orb = $("#pwOrb"), t = $("#pwOrbT"); if(!orb) return;
  clearTimeout(breathTimer); const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; let n = 0;
  btn.disabled = true;
  const step = () => { if(n>=5){ orb.className = "pw-orb"; t.textContent = L("Amen. Go gently.","Amen. Geh behutsam."); btn.disabled = false; return; }
    orb.className = "pw-orb in"; t.textContent = L("In · Jesus,","Ein · Jesus,");
    breathTimer = setTimeout(()=>{ orb.className = "pw-orb out"; t.textContent = L("Out · teach me Your unhurried way.","Aus · lehre mich Dein unhastiges Tempo."); breathTimer = setTimeout(()=>{ n++; step(); }, 6000); }, 4000); };
  if(reduce) orb.style.transition = "none";
  step();
}
/* card on Today: tonight's practice + planned music, only what applies today */
function rhythmCardHtml(){
  const now = new Date(), k = dateKey(now), H = habOf(k), dow = now.getDay(), rows = [];
  if(!started(k)) return "";
  if(isEveningDay(now)) rows.push(`<div class="rhythm-row"><div><div class="t">${L("Evening Rhythm","Abendrhythmus")}</div><div class="m">${L("Phone away","Handy weg um")} ${habits.evening.time}${habits.evening.latest?L(`, counts until ${habits.evening.latest}`,`, zählt bis ${habits.evening.latest}`):""} · Lectio 365</div></div><button type="button" class="check ${H.ev?"on":""}" data-hab="ev" aria-pressed="${!!H.ev}" aria-label="${L("Evening Rhythm done","Abendrhythmus erledigt")}"><span class="n">✓</span>${CHECK_SVG}</button></div>`);
  if(fastSkip(now)) rows.push(`<div class="rhythm-row"><div><div class="t">${L("No fast today","Heute kein Fasten")}</div><div class="m">${esc(fastSkip(now))}</div></div></div>`);
  if(isFast(now)) rows.push(`<div class="rhythm-row"><div><div class="t">${L("Thursday fast","Fasten")}</div><div class="m">${L("Hunger is a call to pray","Hunger ist ein Ruf zum Gebet")}</div></div><button type="button" class="check ${H.fast?"on":""}" data-hab="fast" aria-pressed="${!!H.fast}" aria-label="${L("Fast kept","Fasten gehalten")}"><span class="n">✓</span>${CHECK_SVG}</button></div>`);
  if(dow===habits.sabbath.dow) rows.push(`<div class="rhythm-row"><div><div class="t">${L("Sabbath","Sabbat")}</div><div class="m">${L("From","Ab")} ${habits.sabbath.start} · ${habits.sabbath.hours} ${L("hours","Stunden")}</div></div><button type="button" class="check ${H.sab?"on":""}" data-hab="sab" aria-pressed="${!!H.sab}" aria-label="${L("Sabbath kept","Sabbat gehalten")}"><span class="n">✓</span>${CHECK_SVG}</button></div>`);
  const mu = musicPlanned(now), doneMu = (H.mu||[]);
  for(const p of mu) rows.push(`<div class="rhythm-row"><div><div class="t">${L(KIND[p.kind][0],KIND[p.kind][1])} · ${p.time}</div><div class="m">${p.min} min${doneMu.some(s=>s.kind===p.kind)?L(" · logged ✓"," · eingetragen ✓"):""}</div></div><button type="button" class="ghost" data-mulog="${p.kind}" style="padding:7px 12px;min-height:38px">${L("Log","Eintragen")}</button></div>`);
  if(!rows.length) return "";
  return `<div class="card" data-notr><div class="spread"><h3>${L("Rhythm","Rhythmus")}</h3><button type="button" class="ghost" data-goto-life style="padding:6px 12px;min-height:34px">${L("Rule of Life","Rule of Life")} ›</button></div>${rows.join("")}</div>`;
}
function bindRhythmCard(root){
  bindHabitTicks(root);
  root.querySelectorAll("[data-mulog]").forEach(b=>b.onclick = ()=>openMusicLog(b.dataset.mulog));
  root.querySelectorAll("[data-goto-life]").forEach(b=>b.onclick = ()=>switchTab("life"));
}


/* ================= Tasks (app/tasks doc, owner only by db rule; "shared" path reserved for later sharing) ================= */
// Research basis: a written plan with a next step frees attention (Masicampo & Baumeister 2011),
// if then plans raise goal attainment (Gollwitzer & Sheeran 2006), progress near the goal pulls you forward
// (Kivetz et al. 2006), visible small wins drive good days (Amabile & Kramer). Hence: next step field,
// Today max 3, stage bars weighted by time, Done this week.
const TASKS_VERSION = 1;
const DEFAULT_AREAS = [
  {id:"gegot", name:"GeGo Trossingen", sub:[{id:"ild1",name:"ILD I"},{id:"ild2",name:"ILD II"},{id:"gegot-o",name:"Other (Sermon, Organization)"}]},
  {id:"gegos", name:"GeGo Singen", sub:[{id:"ggs",name:"GGS Youth"},{id:"sermon",name:"Sermon Sunday"},{id:"gegos-a",name:"Admin (Fahrtkosten etc.)"}]},
  {id:"ets", name:"ETS", sub:[{id:"herm",name:"Hermeneutics"},{id:"dns",name:"Denominations & Sects"},{id:"ets-o",name:"Other"}]},
  {id:"raum", name:"Raum Worship", sub:[]},
  {id:"ignite", name:"Ignite Jugend", sub:[]},
  {id:"lessons", name:"Drum Lessons", sub:[]},
  {id:"music", name:"Music", sub:[{id:"social",name:"Social Media"},{id:"practice",name:"Personal Practice"}]},
  {id:"personal", name:"Personal", sub:[{id:"papa",name:"Papa (NK & Steuer)"},{id:"haushalt",name:"Haushalt"},{id:"steuern",name:"Steuern"},{id:"einkaufen",name:"Einkaufen"},{id:"garten",name:"Garten"}]}
];
const DEFAULT_TEMPLATES = [
  {id:"sermon", name:"Sermon", stages:[["Exegesis and research",120],["Outline",60],["Full draft",120],["Illustrations and application",45],["Final read and slides",30]]},
  {id:"lecture", name:"ETS lecture", stages:[["Read and research",90],["Outline",45],["Slides",90],["Quiz or assignment",30],["Upload to Moodle",15]]},
  {id:"ild", name:"ILD lesson", stages:[["Read course material",60],["Lesson plan",45],["Handouts and CT",30],["Room and tables",15]]},
  {id:"youth", name:"Youth night", stages:[["Theme",20],["Message",120],["Program and games",30],["Team briefing",15]]},
  {id:"reel", name:"Drum reel", stages:[["Idea and script",20],["Practice",60],["Film",45],["Edit",60],["Post and caption",15]]},
  {id:"song", name:"Song production", stages:[["Drums",90],["Bass",60],["Electric guitars",90],["Acoustic",45],["Keys",60],["Vocals",90],["Mix",120]]}
];
let tasksDoc = {version:TASKS_VERSION, areas:structuredClone(DEFAULT_AREAS), templates:structuredClone(DEFAULT_TEMPLATES), tasks:[], timer:null, learned:{}};
let taskSeg = "today", taskTick = null;
try{ const s = sessionStorage.getItem("ohc-taskseg"); if(s) taskSeg = s; }catch(e){}
function mergeTasks(t){
  const x = {...structuredClone(tasksDoc), ...JSON.parse(JSON.stringify(t))};
  if(!Array.isArray(x.areas) || !x.areas.length) x.areas = structuredClone(DEFAULT_AREAS);
  if(!Array.isArray(x.templates) || !x.templates.length) x.templates = structuredClone(DEFAULT_TEMPLATES);
  x.tasks = Array.isArray(x.tasks) ? x.tasks : []; x.learned = x.learned || {};
  return x;
}
async function saveTasks(){ await saveDoc("tasks", tasksDoc); }
const todayK = () => dateKey(new Date());
const areaOf = id => tasksDoc.areas.find(a=>a.id===id);
const subOf = (a, id) => (areaOf(a)?.sub||[]).find(s=>s.id===id);
const areaLabel = t => { const a = areaOf(t.area); if(!a) return L("No area","Ohne Bereich"); const s = subOf(t.area, t.sub); return s ? `${a.name} · ${s.name}` : a.name; };
function tProgress(t){
  if(t.done) return 1;
  const st = t.stages||[]; if(!st.length) return 0;
  const w = s => Math.max(5, Number(s.est)||30), tot = st.reduce((n,s)=>n+w(s),0);
  return st.filter(s=>s.done).reduce((n,s)=>n+w(s),0) / tot;
}
const tSpent = t => (t.spent||0) + (t.stages||[]).reduce((n,s)=>n+(s.spent||0),0);
const tEst = t => (t.stages||[]).length ? t.stages.reduce((n,s)=>n+(Number(s.est)||0),0) : (Number(t.est)||0);
const nextStage = t => (t.stages||[]).find(s=>!s.done);
function dueInfo(t){
  if(!t.due) return null; const d = Math.round((fromKey(t.due) - fromKey(todayK()))/864e5);
  const txt = d<0 ? L(`${-d} d overdue`,`${-d} T überfällig`) : d===0 ? L("today","heute") : d===1 ? L("tomorrow","morgen") : fmtDate(t.due);
  return {d, txt, cls: d<0 ? "r" : d<=1 ? "y" : ""};
}
function median(a){ if(!a.length) return null; const b=[...a].sort((x,y)=>x-y), m=Math.floor(b.length/2); return b.length%2? b[m] : (b[m-1]+b[m])/2; }
function learnedEst(tplId, name, fallback){ const a = tasksDoc.learned?.[tplId]?.[name]||[]; return a.length>=3 ? Math.round(median(a)) : fallback; }
function stagesFromTpl(tplId){
  const tp = tasksDoc.templates.find(x=>x.id===tplId); if(!tp) return [];
  return tp.stages.map(([n,est])=>({id:uid(), n, est:learnedEst(tplId, n, est), done:false, spent:0}));
}
function newTask(p){ return {id:uid(), title:"", area:null, sub:null, due:null, prio:"normal", next:"", stages:[], done:false, created:todayK(), today:null, rec:null, tpl:null, review:false, shared:false, spent:0, ...p}; }
function openTasks(){ return tasksDoc.tasks.filter(t=>!t.done && !t.review); }
function todayTasks(){ const k = todayK(); return openTasks().filter(t=>t.today===k); }
function weekStart(){ return dateKey(mondayOf(new Date())); }
function doneThisWeek(){ const m = weekStart(); return tasksDoc.tasks.filter(t=>t.done && t.doneAt && t.doneAt>=m); }

/* ----- timer ----- */
function timerMin(){ const tm = tasksDoc.timer; return tm ? (Date.now()-tm.start)/6e4 : 0; }
async function startTimer(taskId, stageId){
  if(tasksDoc.timer) await stopTimer(false);
  const t = tasksDoc.tasks.find(x=>x.id===taskId); if(!t) return;
  tasksDoc.timer = {task:taskId, stage: stageId || nextStage(t)?.id || null, start:Date.now()};
  renderTasksEverywhere(); await saveTasks();
}
async function stopTimer(save=true){
  const tm = tasksDoc.timer; if(!tm) return; const t = tasksDoc.tasks.find(x=>x.id===tm.task); const min = Math.round(timerMin()*100)/100;
  if(t && min>0){ const s = (t.stages||[]).find(x=>x.id===tm.stage); if(s) s.spent = Math.round(((s.spent||0)+min)*100)/100; else t.spent = Math.round(((t.spent||0)+min)*100)/100;
    (t.log = t.log||[]).push({d:todayK(), min, stage: s?.n || null}); }
  tasksDoc.timer = null; if(save){ renderTasksEverywhere(); await saveTasks(); }
}
const fmtClock = m => { const s = Math.floor(m*60); const h = Math.floor(s/3600); return (h? h+":" : "") + pad(Math.floor(s/60)%60) + ":" + pad(s%60); };
function timerBanner(){
  const tm = tasksDoc.timer; if(!tm) return "";
  const t = tasksDoc.tasks.find(x=>x.id===tm.task); if(!t) return "";
  const s = (t.stages||[]).find(x=>x.id===tm.stage);
  return `<div class="tk-timer" data-notr><span class="tk-dot"></span><div style="min-width:0"><div class="tk-tt">${esc(t.title)}</div><div class="m">${s?esc(s.n):L("Whole task","Ganze Aufgabe")}</div></div><b class="mono" id="tkClock">${fmtClock(timerMin())}</b><button type="button" class="primary" data-tk-stop>${L("Stop","Stopp")}</button></div>`;
}
function tickClock(){ clearInterval(taskTick); if(!tasksDoc.timer) return; taskTick = setInterval(()=>{ document.querySelectorAll("#tkClock").forEach(el=>el.textContent = fmtClock(timerMin())); }, 1000); }

/* ----- completion ----- */
function nextDue(t){
  const base = t.due ? fromKey(t.due) : new Date(); const n = Math.max(1, Number(t.rec.every)||1);
  if(t.rec.freq==="monthly"){ const d = new Date(base); d.setMonth(d.getMonth()+n); return dateKey(d); }
  return dateKey(addDays(base, 7*n));
}
let tkTapAt = 0;
async function setDone(t, on){
  if(tasksDoc.timer?.task===t.id) await stopTimer(false);
  t.done = on; t.doneAt = on ? todayK() : null;
  if(on){
    for(const s of t.stages||[]) if(s.done && t.tpl && s.spent>0){ const L2 = (tasksDoc.learned[t.tpl] = tasksDoc.learned[t.tpl]||{}); (L2[s.n] = L2[s.n]||[]).push(Math.round(s.spent)); L2[s.n] = L2[s.n].slice(-12); }
    if(t.rec && t.rec.freq && !t.recSpawned){
      t.recSpawned = true;
      tasksDoc.tasks.push(newTask({title:t.title, area:t.area, sub:t.sub, prio:t.prio, next:"", rec:{...t.rec}, tpl:t.tpl, due:nextDue(t),
        stages:(t.stages||[]).map(s=>({id:uid(), n:s.n, est: t.tpl ? learnedEst(t.tpl, s.n, s.est) : s.est, done:false, spent:0}))}));
    }
  }
  renderTasksEverywhere(); await saveTasks();
}
async function toggleStage(t, sid){
  const s = (t.stages||[]).find(x=>x.id===sid); if(!s) return;
  s.done = !s.done; s.doneAt = s.done ? todayK() : null;
  if(tasksDoc.timer?.task===t.id && tasksDoc.timer.stage===sid && s.done) await stopTimer(false);
  if(t.stages.every(x=>x.done) && !t.done){ await setDone(t, true); return; }
  if(!t.stages.every(x=>x.done) && t.done){ t.done = false; t.doneAt = null; }
  renderTasksEverywhere(); await saveTasks();
}
async function pinToday(t){
  const k = todayK();
  if(t.today===k){ t.today = null; if(t.autoToday===k){ if(tasksDoc.autoSkip?.d!==k) tasksDoc.autoSkip = {d:k, ids:[]}; tasksDoc.autoSkip.ids.push(t.id); } t.autoToday = null; renderTasksEverywhere(); await saveTasks(); return; }
  if(todayTasks().length>=3){
    // a manual star replaces the lowest ranked auto pick
    const autos = todayTasks().filter(x=>x.autoToday===k).sort(byRank);
    if(!autos.length){ alertBanner(L("Today holds 3 tasks. Finish or unpin one first.","Heute hat schon 3 Aufgaben. Erst eine erledigen oder lösen.")); return; }
    const out = autos[autos.length-1]; out.today = null; out.autoToday = null;
    if(tasksDoc.autoSkip?.d!==k) tasksDoc.autoSkip = {d:k, ids:[]}; tasksDoc.autoSkip.ids.push(out.id);
  }
  t.today = k; t.autoToday = null; renderTasksEverywhere(); await saveTasks();
}
function alertBanner(msg){ const el = $("#tkMsg"); if(el){ el.textContent = msg; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(()=>el.hidden = true, 4000); } }

/* ----- rows ----- */
function tBar(t, big){ const p = tProgress(t); return `<div class="bar${big?" tk-big":""}" role="img" aria-label="${Math.round(p*100)}%"><i style="width:${(p*100).toFixed(1)}%;background:${t.done?"var(--rec-g)":"var(--focus)"}"></i></div>`; }
function taskRow(t, opts={}){
  const di = dueInfo(t), st = t.stages||[], p = tProgress(t), ns = nextStage(t), running = tasksDoc.timer?.task===t.id;
  const meta = [opts.showArea? esc(areaLabel(t)) : "", st.length? `${st.filter(s=>s.done).length}/${st.length} ${L("stages","Etappen")}${ns&&!t.done?` · ${L("next","als Nächstes")}: ${esc(ns.n)}`:""}` : (t.next? `${L("Next","Nächster Schritt")}: ${esc(t.next)}` : ""), t.rec?.freq? (t.rec.freq==="weekly"? L("weekly","wöchentlich") : L("monthly","monatlich")) : "", (t.autoToday && t.autoToday===todayK() && t.today===todayK())? L("auto pick","automatisch") : ""].filter(Boolean).join(" · ");
  return `<div class="tk-row${t.done?" done":""}${running?" run":""}">
    <button type="button" class="check ${t.done?"on":""}" data-tk-done="${t.id}" aria-pressed="${t.done}" aria-label="${L("Done","Erledigt")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></button>
    <button type="button" class="tk-main" data-tk-open="${t.id}"><span class="tk-t">${t.prio==="high"?`<span class="tk-hi" aria-label="${L("High priority","Hohe Priorität")}">!</span>`:""}${esc(t.title)}</span>${meta?`<span class="tk-m">${meta}</span>`:""}${st.length?`<span class="tk-b">${tBar(t)}<span class="mono tk-p">${Math.round(p*100)}%</span></span>`:""}</button>
    <span class="tk-side">${di?`<span class="chip ${di.cls}" style="padding:2px 8px;font-size:11.5px">${esc(di.txt)}</span>`:""}${opts.pin && !t.done?`<button type="button" class="ghost tk-pin${t.today===todayK()?" on":""}" data-tk-pin="${t.id}" aria-label="${L("Pin to today","Für heute")}">${t.today===todayK()?"★":"☆"}</button>`:""}</span>
  </div>`;
}
function songRows(){
  const songs = habits?.songs||[]; if(!songs.length) return "";
  return `<div class="tk-sub"><div class="tk-subh">${L("Song pipeline","Song Pipeline")} <span class="muted small">${L("read only, edit under Life","nur Ansicht, bearbeiten unter Life")}</span></div>${songs.map(s=>{ const p = s.stage/(STAGES.length-1);
    return `<div class="tk-row ro"><span class="tk-main" style="cursor:default"><span class="tk-t">♪ ${esc(s.title)}</span><span class="tk-m">${L(STAGES[s.stage][0],STAGES[s.stage][1])}</span><span class="tk-b"><div class="bar"><i style="width:${(p*100).toFixed(1)}%;background:var(--sport)"></i></div><span class="mono tk-p">${Math.round(p*100)}%</span></span></span></div>`; }).join("")}</div>`;
}

/* ===== daily impulse (v66): ideas in our own words, inspired by the authors, not quotes ===== */
const IMPULSES = [
 ["James Clear","Atomic Habits","Small wins compound. A task done at 1 % better every day beats a heroic push once a month.","Kleine Siege summieren sich. Jeden Tag 1 % besser schlägt den heroischen Kraftakt einmal im Monat.","Pick one task and only do its next stage.","Wähle eine Aufgabe und mach nur die nächste Etappe."],
 ["Cal Newport","Deep Work","Depth is rare and valuable. Your best work comes from long, undistracted blocks, not from squeezing it between messages.","Tiefe ist selten und wertvoll. Deine beste Arbeit entsteht in langen Blöcken ohne Ablenkung, nicht zwischen Nachrichten.","In your next deep work block: phone in another room.","Im nächsten Deep Work Block: Handy in einen anderen Raum."],
 ["John Mark Comer","The Ruthless Elimination of Hurry","Hurry is the enemy of love and of presence with God. You cannot be fully present while rushing.","Eile ist der Feind der Liebe und der Gegenwart Gottes. Wer hetzt, ist nie ganz da.","Do one thing today slower than needed, on purpose.","Mach heute eine Sache absichtlich langsamer als nötig."],
 ["James Clear","Atomic Habits","You do not rise to the level of your goals, you fall to the level of your systems. Fix the system, not your willpower.","Du erreichst nicht das Niveau deiner Ziele, sondern das deines Systems. Repariere das System, nicht deine Willenskraft.","Star your 3 tasks before 9:00.","Markiere deine 3 Aufgaben vor 9:00."],
 ["Cal Newport","Slow Productivity","Do fewer things, work at a natural pace, obsess over quality. Overload makes everything slower.","Mach weniger Dinge, arbeite in natürlichem Tempo, achte besessen auf Qualität. Überlastung macht alles langsamer.","Move one task that is not essential to next month.","Schieb eine nicht wesentliche Aufgabe in den nächsten Monat."],
 ["John Mark Comer","Practicing the Way","Your rule of life is a trellis, not a cage. It holds up what you want to grow.","Deine Lebensregel ist ein Rankgitter, kein Käfig. Sie stützt, was wachsen soll.","Protect today's prayer time like an appointment.","Schütze deine Gebetszeit heute wie einen Termin."],
 ["James Clear","Atomic Habits","Every action is a vote for the person you want to become. One finished task is one vote.","Jede Handlung ist eine Stimme für die Person, die du werden willst. Eine erledigte Aufgabe ist eine Stimme.","Finish one small task before lunch.","Erledige eine kleine Aufgabe vor dem Mittag."],
 ["Cal Newport","Deep Work","Shallow work keeps you busy, deep work moves you forward. Batch emails and messages instead of answering all day.","Oberflächliche Arbeit hält dich beschäftigt, tiefe Arbeit bringt dich voran. Bündle Mails und Nachrichten statt den ganzen Tag zu antworten.","Answer messages in two fixed slots today.","Beantworte Nachrichten heute in zwei festen Zeitfenstern."],
 ["John Mark Comer","The Ruthless Elimination of Hurry","Sabbath is not a reward for finished work. It is a rhythm that tells you the work is never finished and God is still God.","Sabbat ist keine Belohnung für erledigte Arbeit. Er erinnert dich: Die Arbeit ist nie fertig, und Gott bleibt Gott.","Write down what you will NOT do this Sunday afternoon.","Schreib auf, was du am Sonntagnachmittag NICHT tun wirst."],
 ["James Clear","Atomic Habits","Make it easy. Reduce the friction for the next step until starting takes two minutes.","Mach es leicht. Senke die Hürde für den nächsten Schritt, bis der Start nur zwei Minuten dauert.","Open the file for tomorrow's task tonight.","Öffne heute Abend schon die Datei für die Aufgabe von morgen."],
 ["Cal Newport","Digital Minimalism","Attention is your most limited resource. Spend it on purpose, not on whatever is loudest.","Aufmerksamkeit ist deine knappste Ressource. Setz sie bewusst ein, nicht für das Lauteste.","No social media before your first task is done.","Kein Social Media, bevor die erste Aufgabe erledigt ist."],
 ["John Mark Comer","Practicing the Way","Following Jesus means being with him, becoming like him and doing what he did. The order matters.","Jesus nachfolgen heißt: bei ihm sein, wie er werden, tun was er tat. Die Reihenfolge zählt.","Start your first work block with two minutes of silence.","Beginn den ersten Arbeitsblock mit zwei Minuten Stille."],
 ["James Clear","Atomic Habits","Never miss twice. Missing once is an accident, missing twice is the start of a new habit.","Verpasse nie zweimal. Einmal ist ein Ausrutscher, zweimal der Anfang einer neuen Gewohnheit.","If yesterday slipped, do one stage today, however small.","Wenn gestern nichts lief: heute eine Etappe, egal wie klein."],
 ["Cal Newport","Slow Productivity","Busyness is not productivity. Measure what you finished, not how full your day felt.","Beschäftigt sein ist nicht produktiv sein. Zähle, was fertig wurde, nicht wie voll sich der Tag anfühlte.","Look at Done this week before you plan tomorrow.","Schau auf Erledigt, bevor du morgen planst."],
 ["John Mark Comer","The Ruthless Elimination of Hurry","Simplicity is freedom. Every yes is a no to something else, so say yes on purpose.","Einfachheit ist Freiheit. Jedes Ja ist ein Nein zu etwas anderem, also sag bewusst Ja.","Remove one item from your inbox today.","Lösche heute einen Punkt aus deiner Inbox."],
 ["James Clear","Atomic Habits","Environment beats motivation. Design your space so the right action is the obvious one.","Umgebung schlägt Motivation. Gestalte deinen Raum so, dass das Richtige das Naheliegende ist.","Leave your drumsticks or sermon notes where you will see them first.","Leg Sticks oder Predigtnotizen dorthin, wo du sie zuerst siehst."],
 ["Cal Newport","Deep Work","A shutdown ritual ends the workday. Unfinished tasks are captured, so your mind can rest.","Ein Abschlussritual beendet den Arbeitstag. Offenes ist notiert, also darf der Kopf ruhen.","Tonight: check tomorrow's 3 tasks, then say 'done for today'.","Heute Abend: 3 Aufgaben für morgen prüfen, dann 'Feierabend' sagen."],
 ["John Mark Comer","Practicing the Way","Spiritual formation happens through small practices repeated over a long time, not through intense moments.","Geistliche Formung geschieht durch kleine, lange wiederholte Übungen, nicht durch intensive Momente.","Read one Psalm slowly before your first task.","Lies vor der ersten Aufgabe langsam einen Psalm."]
];
function impulseCard(){
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset()*60000) / 86400000);
  const [who, book, en, de, aEn, aDe] = IMPULSES[day % IMPULSES.length];
  // 23.10.2026: one quiet row that opens on tap, so the list comes first
  return `<details class="tk-impd tk-imp"><summary><span class="ey">${L("Impulse","Impuls")}</span><span class="tx">${L(en,de)}</span></summary><div><p style="font-weight:600;font-size:16px;line-height:1.4">${L(en,de)}</p><p class="small"><b>${L("Today","Heute")}:</b> ${L(aEn,aDe)}</p><p class="small muted">${esc(who)} · ${L(`idea from "${book}", in our words`,`Gedanke aus "${book}", sinngemäß`)}</p></div></details>`;
}

/* ----- views ----- */
function tasksHeader(){
  const inbox = tasksDoc.tasks.filter(t=>t.review && !t.done).length;
  const seg = (id, en, de, n) => `<button type="button" data-tk-seg="${id}" aria-pressed="${taskSeg===id}">${L(en,de)}${n?` <span class="tk-n">${n}</span>`:""}</button>`;
  return `<div class="spread" style="padding:4px 2px 0"><div><div class="eyebrow">${L("Tasks","Aufgaben")}</div><h2>${L("One list for everything","Eine Liste für alles")}</h2></div></div>
  ${impulseCard()}
  ${timerBanner()}
  <div class="tk-add card" style="padding:12px"><div class="row" style="flex-wrap:nowrap"><input id="tkQuick" placeholder="${L("New task, Enter to add","Neue Aufgabe, Enter zum Speichern")}" style="flex:1;min-width:0" aria-label="${L("New task","Neue Aufgabe")}"><select id="tkQuickArea" aria-label="${L("Area","Bereich")}" style="flex:0 0 38%;width:38%;min-width:0">${areaOptions(null,null,true)}</select><button type="button" class="primary" id="tkQuickAdd" aria-label="${L("Add","Hinzufügen")}">+</button></div></div>
  <div id="tkMsg" class="banner y" hidden></div>
  ${inbox && taskSeg!=="inbox"?`<button type="button" class="tk-inbox" data-tk-seg="inbox"><span>${L(`${inbox} collected items to sort`,`${inbox} gesammelte Punkte zu sortieren`)}</span><span>›</span></button>`:""}
  <div class="seg" role="group" aria-label="${L("View","Ansicht")}" style="justify-self:start">${seg("today","Today","Heute",todayTasks().length?`${todayTasks().length}/3`:"")}${seg("areas","Areas","Bereiche")}${seg("done","Done this week","Erledigt")}</div>`;
}
function areaOptions(area, sub, withNone){
  let o = withNone? `<option value="">${L("Area…","Bereich…")}</option>` : "";
  for(const a of tasksDoc.areas){ o += `<option value="${a.id}|"${a.id===area&&!sub?" selected":""}>${esc(a.name)}</option>`; for(const s of a.sub||[]) o += `<option value="${a.id}|${s.id}"${a.id===area&&s.id===sub?" selected":""}>  ${esc(a.name)} · ${esc(s.name)}</option>`; }
  return o;
}
// Oti's task hierarchy (08.10.2026): sermons first (Trossingen before Singen), then GeGo Trossingen, GeGo Singen, Ignite, ETS, Raum Worship, everything else; inside a rank by due date, then high priority
const SERMON_RE = /^\s*(predigt|sermon)/i; // only tasks to PREPARE a sermon, not feedback on others' sermons
function taskRank(t){
  const ser = t.tpl==="sermon" || t.sub==="sermon" || SERMON_RE.test(t.title||"");
  if(ser) return t.area==="gegot" ? 0 : 1;
  return {gegot:2, gegos:3, ignite:4, ets:5, raum:6}[t.area] ?? 7;
}
function byRank(a,b){ return (taskRank(a)-taskRank(b)) || ((a.due||"9")<(b.due||"9")?-1:(a.due||"9")>(b.due||"9")?1:0) || ((b.prio==="high")-(a.prio==="high")); }
// Auto Top 3 (Oti, 12.10.2026): free slots are filled on open. 1) recurring tasks due today or earlier, 2) overdue, due today, or high priority due tomorrow, ranked by the hierarchy. Own stars are never touched; an unstarred auto pick stays out for the day.
function autoCandidates(){
  const k = todayK(), tmr = dateKey(addDays(fromKey(k),1)), skip = (tasksDoc.autoSkip?.d===k ? tasksDoc.autoSkip.ids : []) || [];
  const open = openTasks().filter(t=>t.today!==k && !skip.includes(t.id));
  const rec = open.filter(t=>t.rec?.freq && t.due && t.due<=k).sort(byRank);
  const rest = open.filter(t=>!rec.includes(t) && t.due && (t.due<=k || (t.prio==="high" && t.due<=tmr))).sort(byRank);
  return [...rec, ...rest];
}
function autoTop3(){
  if(!tasksDoc?.tasks) return false;
  const k = todayK(); let free = 3 - todayTasks().length; if(free<=0) return false;
  const picks = autoCandidates().slice(0, free); if(!picks.length) return false;
  for(const t of picks){ t.today = k; t.autoToday = k; }
  return true;
}
function viewToday(){
  const k = todayK(), pinned = todayTasks(), open = openTasks();
  const overdue = open.filter(t=>t.due && t.due<k && t.today!==k).sort((a,b)=>a.due<b.due?-1:1);
  const soon = open.filter(t=>t.due && t.due>=k && t.due<=dateKey(addDays(new Date(),7)) && t.today!==k).sort(byRank);
  const doneToday = tasksDoc.tasks.filter(t=>t.done && t.doneAt===k);
  let h = `<div class="card"><div class="spread"><h3>${L("Today","Heute")}</h3><span class="small muted">${pinned.length}/3</span></div>`;
  h += pinned.length ? `<div class="list">${pinned.map(t=>taskRow(t,{showArea:true,pin:true})).join("")}</div>` : `<p class="small muted">${L("Pick up to 3 tasks with ☆. Three that get done beat ten that wait.","Wähle bis zu 3 Aufgaben mit ☆. Drei, die fertig werden, schlagen zehn, die warten.")}</p>`;
  if(doneToday.length) h += `<p class="small" style="color:var(--g-ink)">✓ ${doneToday.length} ${L("done today","heute erledigt")}: ${doneToday.map(t=>esc(t.title)).join(", ")}</p>`;
  h += `</div>`;
  // 23.10.2026: long lists start closed, the count stays visible
  if(overdue.length) h += `<details class="card tk-area" ${overdue.length<=3?"open":""}><summary><span style="color:var(--r-ink)">${L("Overdue","Überfällig")}</span><span class="tk-cnt">${overdue.length}</span></summary><div class="list">${overdue.map(t=>taskRow(t,{showArea:true,pin:true})).join("")}</div></details>`;
  if(soon.length) h += `<details class="card tk-area" ${soon.length<=5?"open":""}><summary><span>${L("Next 7 days","Nächste 7 Tage")}</span><span class="tk-cnt">${soon.length}</span></summary><div class="list">${soon.map(t=>taskRow(t,{showArea:true,pin:true})).join("")}</div></details>`;
  const hi = open.filter(t=>t.prio==="high" && !t.due && t.today!==k);
  if(hi.length) h += `<details class="card tk-area" ${hi.length<=3?"open":""}><summary><span>${L("High priority, no date","Wichtig, ohne Datum")}</span><span class="tk-cnt">${hi.length}</span></summary><div class="list">${hi.map(t=>taskRow(t,{showArea:true,pin:true})).join("")}</div></details>`;
  return h;
}
function areaStats(aid, sid){ const ts = tasksDoc.tasks.filter(t=>!t.review && t.area===aid && (sid===undefined || (t.sub||null)===sid)); const open = ts.filter(t=>!t.done); return {open, all:ts, done: ts.filter(t=>t.done && t.doneAt>=weekStart())}; }
let tkOpenAreas = new Set(); try{ tkOpenAreas = new Set(JSON.parse(sessionStorage.getItem("ohc-tkareas")||"[]")); }catch(e){}
function viewAreas(){
  let h = "";
  for(const a of tasksDoc.areas){
    const S = areaStats(a.id), open = S.open, est = open.reduce((n,t)=>n+Math.max(0,tEst(t)-tSpent(t)),0), isOpen = tkOpenAreas.has(a.id);
    h += `<details class="card tk-area" data-tk-area="${a.id}" ${isOpen?"open":""}><summary><span>${esc(a.name)}</span><span class="tk-cnt">${open.length} ${L("open","offen")}${est?` · ~${dur(est)}`:""}</span></summary><div style="display:grid;gap:10px">`;
    const loose = open.filter(t=>!t.sub || !subOf(a.id,t.sub)).sort(sortTasks);
    if(loose.length) h += `<div class="list">${loose.map(t=>taskRow(t,{pin:true})).join("")}</div>`;
    for(const s of a.sub||[]){ const ts = open.filter(t=>t.sub===s.id).sort(sortTasks);
      h += `<div class="tk-sub"><div class="tk-subh">${esc(s.name)} <span class="muted small">${ts.length}</span></div>${ts.length?`<div class="list">${ts.map(t=>taskRow(t,{pin:true})).join("")}</div>`:`<p class="small muted">${L("Nothing open","Nichts offen")}</p>`}</div>`; }
    if(a.id==="music") h += songRows();
    if(!open.length && !(a.sub||[]).length) h += `<p class="small muted">${L("Nothing open","Nichts offen")}</p>`;
    h += `<button type="button" class="ghost" data-tk-new="${a.id}" style="justify-self:start">+ ${L("Task in","Aufgabe in")} ${esc(a.name)}</button></div></details>`;
  }
  return h;
}
function sortTasks(a,b){ const da = a.due||"9999", db2 = b.due||"9999"; if(da!==db2) return da<db2?-1:1; if(a.prio!==b.prio) return a.prio==="high"?-1:1; return (a.created||"")<(b.created||"")?-1:1; }
function viewDone(){
  const done = doneThisWeek(), m = weekStart();
  const mins = tasksDoc.tasks.flatMap(t=>t.log||[]).filter(x=>x.d>=m).reduce((n,x)=>n+x.min,0);
  let h = `<div class="card"><div class="spread"><h3>${L("Done this week","Diese Woche erledigt")}</h3><span class="chip g">${done.length}</span></div>${mins?`<p class="small muted">${L("Tracked time this week","Gemessene Zeit diese Woche")}: <b class="mono">${dur(mins)}</b></p>`:""}`;
  if(!done.length) h += `<p class="small muted">${L("Nothing yet. Every finished stage counts too.","Noch nichts. Auch jede fertige Etappe zählt.")}</p>`;
  for(const a of tasksDoc.areas){ const ts = done.filter(t=>t.area===a.id); if(!ts.length) continue;
    h += `<div class="tk-sub"><div class="tk-subh">${esc(a.name)} <span class="muted small">${ts.length}</span></div><div class="list">${ts.map(t=>taskRow(t)).join("")}</div></div>`; }
  const none = done.filter(t=>!areaOf(t.area)); if(none.length) h += `<div class="list">${none.map(t=>taskRow(t)).join("")}</div>`;
  const stagesDone = tasksDoc.tasks.flatMap(t=>(t.stages||[]).filter(s=>s.done && s.doneAt>=m && !t.done).map(s=>({t,s})));
  if(stagesDone.length) h += `<div class="tk-sub"><div class="tk-subh">${L("Stages finished","Fertige Etappen")} <span class="muted small">${stagesDone.length}</span></div><p class="small" style="color:var(--ink-2)">${stagesDone.map(x=>`${esc(x.t.title)}: ${esc(x.s.n)}`).join(" · ")}</p></div>`;
  return h + `</div>`;
}
function viewInbox(){
  const items = tasksDoc.tasks.filter(t=>t.review && !t.done);
  let h = `<div class="card"><h3>${L("To sort","Zu sortieren")}</h3><p class="small muted">${L("Collected from your notes and calendar. Keep what is still open, tick what is done, remove the rest. Check the area first.","Gesammelt aus deinen Notizen und dem Kalender. Behalte, was noch offen ist, hake ab, was erledigt ist, lösch den Rest. Prüf zuerst den Bereich.")}</p></div>`;
  for(const t of items) h += `<div class="card tk-rev" style="gap:8px"><div><b>${esc(t.title)}</b>${t.src?`<div class="small muted">${L("from","aus")} ${esc(t.src)}</div>`:""}${(t.stages||[]).length?`<div class="small muted">${t.stages.map(s=>esc(s.n)).join(" · ")}</div>`:""}</div>
    <select data-tk-revarea="${t.id}" aria-label="${L("Area","Bereich")}" style="width:100%;min-width:0">${areaOptions(t.area,t.sub,true)}</select>
    <div class="row" style="gap:6px"><button type="button" class="primary" data-tk-keep="${t.id}">${L("Keep","Behalten")}</button><button type="button" class="ghost" data-tk-revdone="${t.id}">${L("Already done","Schon erledigt")}</button><button type="button" class="ghost" data-tk-del="${t.id}">${L("Remove","Entfernen")}</button></div></div>`;
  if(!items.length) h += `<p class="small muted">${L("All sorted.","Alles sortiert.")}</p>`;
  return h;
}
function renderTasks(){
  const el = $("#v-tasks"); if(!el) return;
  if(taskSeg==="inbox" && !tasksDoc.tasks.some(t=>t.review && !t.done)) taskSeg = "today";
  el.innerHTML = `<div data-notr style="display:grid;grid-template-columns:minmax(0,1fr);gap:14px">${tasksHeader()}${taskSeg==="areas"?viewAreas():taskSeg==="done"?viewDone():taskSeg==="inbox"?viewInbox():viewToday()}</div>`;
  bindTasks(el); tickClock();
}
function todayTasksCard(){
  const pinned = todayTasks(), banner = timerBanner();
  const open = openTasks(), k = todayK(), overdue = open.filter(t=>t.due && t.due<k).length, inbox = tasksDoc.tasks.filter(t=>t.review && !t.done).length;
  if(!pinned.length && !banner && !overdue && !inbox) return `<div class="card" data-notr data-tkcard><div class="spread"><h3>${L("Top 3 today","Top 3 heute")}</h3><button type="button" class="ghost" data-goto-tasks style="padding:6px 12px;min-height:34px">${L("Tasks","Aufgaben")} ›</button></div><p class="small muted">${L("No tasks picked for today.","Keine Aufgaben für heute gewählt.")}</p></div>`;
  return `<div class="card" data-notr data-tkcard><div class="spread"><h3>${L("Top 3 today","Top 3 heute")}</h3><button type="button" class="ghost" data-goto-tasks style="padding:6px 12px;min-height:34px">${L("Tasks","Aufgaben")} ›</button></div>${banner}
    ${pinned.length?`<div class="list">${pinned.map(t=>taskRow(t,{showArea:true})).join("")}</div>`:`<p class="small muted">${L("No tasks picked for today.","Keine Aufgaben für heute gewählt.")}</p>`}
    ${overdue||inbox?`<p class="small" style="color:var(--y-ink)">${[overdue?L(`${overdue} overdue`,`${overdue} überfällig`):"", inbox?L(`${inbox} to sort`,`${inbox} zu sortieren`):""].filter(Boolean).join(" · ")}</p>`:""}</div>`;
}
