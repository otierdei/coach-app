/* Oti Hybrid Coach, GitHub version.
   Week tab (23.10.2026): iPhone = agenda, one card per day that opens; Mac = time line with seven columns.
   Events come from the calendars in profile.calendars; single events in the main Google calendar can be added,
   changed and deleted here (Apps Script createEvent / updateEvent / deleteEvent). Recurring events stay read only.
   The assistant (mic button) sends one sentence to Claude on the push worker and shows the proposal; nothing is
   written before Oti taps "Add". Loaded after app-07.js and before app-08.js (shell). */
const WK_LES = /musikunterricht|music lesson|schlagzeugunterricht/i;
const WK_HIDE = /^(lunch|dinner|mittag|abendessen)|bewegungspause|movement break/i;
const WK_CH = /church|gottesdienst|youth|jugend|ignite|gebet|worship|lobpreis|gemeinde/i;
const WK_WORK = /deep work|ets|lehrtag|teaching|sermon|predigt|songwriting|ild/i;
let wkOpen = {};
try{ wkOpen = JSON.parse(sessionStorage.getItem("ohc-wkopen")||"{}"); }catch(e){}
const wkKind = t => WK_LES.test(t) ? "lesson" : WK_HIDE.test(t) ? "meal" : WK_CH.test(t) ? "church" : WK_WORK.test(t) ? "work" : "meet";
const hm = m => `${pad(Math.floor(m/60))}:${pad(Math.round(m%60))}`;

function wkEvents(date){
  const k = dateKey(date), out = [];
  for(const [cid, list] of Object.entries(calEvents)) for(const ev of list||[]){
    if(ev.status==="cancelled" || !ev.start) continue;
    if(/Quelle: Coach App/i.test(ev.description||"")) continue;
    const w = cid==="primary" && ev.writable===true;
    if(ev.start.date){ if(ev.start.date<=k && (ev.end?.date||ev.start.date)>k) out.push({id:ev.id, cid, t:ev.summary||"All day", allDay:true, s:-1, e:0, loc:ev.location||"", w, rec:!!ev.recurring, raw:ev}); continue; }
    // local clock minutes (not ms since midnight): right on the two days a year the clocks change
    const s = new Date(ev.start.dateTime), e = new Date(ev.end?.dateTime || ev.start.dateTime), sk = dateKey(s), ek = dateKey(new Date(e - 1));
    if(sk > k || ek < k) continue;
    const sm = sk < k ? 0 : s.getHours()*60 + s.getMinutes(), em = dateKey(e) > k ? 1440 : e.getHours()*60 + e.getMinutes();
    const multi = sk !== dateKey(new Date(e - 1));
    out.push({id:ev.id, cid, t:ev.summary||"Busy", s:sm, e:em, allDay:false, cont: sk < k, multi, loc:ev.location||"", w: w && !multi, rec:!!ev.recurring, raw:ev});
  }
  return out.sort((a,b)=>a.s-b.s);
}
// lessons of one day as one line: "7 lessons 13:00 to 18:20"
function wkLessons(evs){
  const les = evs.filter(e=>!e.allDay && WK_LES.test(e.t)); if(!les.length) return null;
  return {n: les.length, s: Math.min(...les.map(e=>e.s)), e: Math.max(...les.map(e=>e.e))};
}
const wkEvIndex = {};
const wkKey = e => e.cid+"|"+e.id+"|"+(e.raw.start.dateTime||e.raw.start.date);
function wkEvRow(e){
  wkEvIndex[wkKey(e)] = e;
  return `<button type="button" class="wkrow k-${wkKind(e.t)}" data-wkev="${esc(wkKey(e))}"><span class="wt">${e.allDay?L("all day","ganztägig"):e.cont?`${L("until","bis")} ${hm(e.e)}`:hm(e.s)}</span><span class="wn">${esc(e.t)}${e.loc?`<small>${esc(e.loc)}</small>`:""}</span>${e.rec?`<span class="wr" title="${L("repeats","wiederkehrend")}">↻</span>`:""}</button>`;
}

function renderWeek(){
  const mon = addDays(mondayOf(new Date()), 7*weekOffset), P = weekPlan(mon), today = dateKey(new Date()), wc = weekCounts(mon);
  const inRange = weekOffset>=0 && weekOffset<=1;
  for(const k of Object.keys(wkEvIndex)) delete wkEvIndex[k];
  const days = P.days.map(d=>{ const k = dateKey(d.date), def = d.session?.def ? formDef(d.session.def, formLevel(k)) : null, evs = wkEvents(d.date);
    return {d, k, def, done: def && isDone(k, def), evs, les: wkLessons(evs), key: evs.filter(e=>!WK_LES.test(e.t) && !WK_HIDE.test(e.t))}; });
  // numbers for the week
  const lesMin = days.reduce((n,x)=>n + x.evs.filter(e=>!e.allDay && WK_LES.test(e.t)).reduce((m,e)=>m+(e.e-e.s),0), 0);
  const nights = days.map(x=>health.days[x.k]).filter(h=>h && h.sleepMin);
  const avg = f => nights.length ? nights.reduce((n,h)=>n+(h[f]||0),0)/nights.length : null;
  const sAvg = avg("sleepMin"), dAvg = avg("deep"), rAvg = avg("rem");
  const head = `<div class="spread" style="padding:2px 2px 0;flex-wrap:nowrap"><div><div class="eyebrow">${P.w<1?L("Before block 1","Vor Block 1"):P.w>12?L("After block 1","Nach Block 1"):`${L("Week","Woche")} ${P.w} ${L("of 12","von 12")}${DELOAD(P.w)?" · Deload":""}`}</div>
      <h2>${mon.toLocaleDateString(L("en-GB","de-DE"),{day:"numeric",month:"short"})} ${L("to","bis")} ${addDays(mon,6).toLocaleDateString(L("en-GB","de-DE"),{day:"numeric",month:"short"})}</h2></div>
      <div class="row" style="gap:6px;flex-wrap:nowrap"><button class="rbtn" id="wkPrev" aria-label="${L("Previous week","Vorige Woche")}">‹</button><button class="rbtn" id="wkNext" aria-label="${L("Next week","Nächste Woche")}">›</button></div></div>
    <div class="row wkacts">${weekOffset?`<button class="ghost" id="wkNow">${L("This week","Diese Woche")}</button>`:""}<button class="ghost" id="wkAdd">+ ${L("Event","Termin")}</button><button class="ghost" id="wkMic" aria-label="${L("Ask the assistant","Assistent fragen")}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg> ${L("Assistant","Assistent")}</button></div>
    <div class="wkstats"><div><b>${wc.done}<small> / ${wc.planned}</small></b><span>${L("trainings","Trainings")}</span></div><div><b>${Math.round(lesMin/60)} h</b><span>${L("lessons","Unterricht")}</span></div>
      <div><b style="color:var(--sleep)">${sAvg?dur(sAvg):"–"}</b><span>${L("sleep avg","Schlaf Ø")}${dAvg?` · Deep ${dur(dAvg)} · REM ${dur(rAvg)}`:""}</span></div></div>
    ${!inRange?`<div class="banner">${L("Calendar events load for this and next week only. Later weeks show training only.","Termine werden nur für diese und nächste Woche geladen. Spätere Wochen zeigen nur das Training.")}</div>`:""}`;

  // iPhone: agenda, every day opens
  const agenda = days.map(x=>{ const {d,k,def} = x, isT = k===today, open = wkOpen[k] ?? isT, past = k<today;
    const tr = def ? `${esc(def.name)} · ${fmt(d.session.start)}` : d.conflict ? L("No slot","Kein Platz") : d.date.getDay()===6 ? L("Day off","Freier Tag") : L("Rest","Ruhetag");
    const tag = isT ? L("today","heute") : past && health.days[k]?.sleepMin ? `${L("sleep","Schlaf")} ${dur(health.days[k].sleepMin)}` : "";
    const kk = x.key.filter(e=>!e.cont), lesTxt = x.les ? `${x.les.n} ${L("lessons","Stunden")} ${hm(x.les.s)}` : "";
    const keyLine = [...kk.slice(0,2).map(e=>`${e.allDay?"":hm(e.s)+" "}${e.t}`), lesTxt].filter(Boolean).join(" · ") + (kk.length>2?` · +${kk.length-2}`:"");
    return `<details class="wkday ${isT?"today":""} ${past?"past":""}" data-wkday="${k}" ${open?"open":""}><summary>
      <span class="wd"><small>${SHORT[d.date.getDay()]}</small><b>${d.date.getDate()}</b></span>
      <span class="wm"><span class="wtr ${x.done?"done":def?"":"off"}">${x.done?"✓ ":""}${tr}</span><span class="wsub">${esc(keyLine || L("nothing else","sonst nichts"))}</span></span>
      <span class="wtag">${esc(tag)}</span></summary>
      <div class="wkbody">
        ${(()=>{ const rows = [];
          if(def) rows.push([d.session.start, `<button type="button" class="wkrow k-train" data-wktrain="${k}"><span class="wt">${fmt(d.session.start)}</span><span class="wn">${esc(def.name)}<small>${x.done?L("done","erledigt"):`${doneCount(k,def)}/${def.total} ${L("sets","Sätze")}`}${d.session.moved?` · ${L("moved from","verschoben von")} ${d.session.fromDay}`:""}</small></span></button>`]);
          if(x.les) rows.push([x.les.s, `<div class="wkrow k-lesson static"><span class="wt">${hm(x.les.s)}</span><span class="wn">${x.les.n} ${L("lessons","Unterrichtsstunden")}<small>${L("until","bis")} ${hm(x.les.e)}</small></span></div>`]);
          for(const e of x.key) rows.push([e.allDay ? -2 : e.cont ? -1 : e.s, wkEvRow(e)]);
          for(const w of workoutsFor(k)) rows.push([toMin(w.start), `<div class="wkrow k-train static"><span class="wt">${esc(w.start)}</span><span class="wn">⌚ ${esc(wType(w))}<small>${w.min} min${w.km?` · ${w.km.toFixed(1)} km`:""}</small></span></div>`]);
          if(d.wake?.early) rows.push([-3, `<div class="wkrow k-sleep static"><span class="wt">${fmt(d.wake.wake)}</span><span class="wn">${L("Early wake","Früh aufstehen")}</span></div>`]);
          if(d.bed?.bed!=null) rows.push([d.bed.bed, `<div class="wkrow k-sleep static"><span class="wt">${fmt(d.bed.bed)}</span><span class="wn">${L("Lights out","Licht aus")}${d.bed.late?` · ${L("late","spät")}`:""}${d.afterLate&&def?.hard?` · ${L("hard session after a late night","harte Einheit nach später Nacht")}`:""}</span></div>`]);
          return rows.sort((a,b)=>a[0]-b[0]).map(r=>r[1]).join(""); })()}
        <div class="row" style="gap:6px"><button type="button" class="ghost wkadd" data-wknew="${k}">+ ${L("Event on this day","Termin an diesem Tag")}</button><button type="button" class="ghost wkadd" data-daycal="${k}">${L("Day plan","Tagesplan")}</button>${(()=>{ const x2 = k<today ? strainFor(k) : null; return x2!=null ? `<span class="small muted">Strain ${x2.toFixed(1)}</span>` : ""; })()}</div>
      </div></details>`; }).join("");

  // Mac: seven columns from 07:00 to 23:00
  const S = 7*60, E = 23*60, top = m => ((Math.max(S,Math.min(E,m))-S)/(E-S)*100).toFixed(2)+"%", hgt = (a,b) => Math.max(2.2, (Math.min(E,b)-Math.max(S,a))/(E-S)*100).toFixed(2)+"%";
  const cols = days.map(x=>{ const {d,k,def} = x, isT = k===today;
    const lesB = x.les ? `<div class="tlb k-lesson" style="top:${top(x.les.s)};height:${hgt(x.les.s,x.les.e)}">${x.les.n} ${L("lessons","Stunden")}</div>` : "";
    const vis = x.evs.filter(e=>!e.allDay && e.e>S && e.s<E && !WK_HIDE.test(e.t) && !WK_LES.test(e.t)), lanes = [];
    for(const e of vis){ let l = lanes.findIndex(end=>end<=e.s); if(l<0){ l = lanes.length; lanes.push(0); } lanes[l] = e.e; e.lane = l; }
    const nl = Math.max(1, lanes.length);
    const blocks = lesB + vis.map(e=>{ wkEvIndex[wkKey(e)] = e; return `<button type="button" class="tlb k-${wkKind(e.t)} ${e.cont?"cont":""}" style="top:${top(e.s)};height:${hgt(e.s,e.e)};left:calc(${(e.lane/nl*100).toFixed(1)}% + 3px);right:auto;width:calc(${(100/nl).toFixed(1)}% - 6px)" data-wkev="${esc(wkKey(e))}" title="${esc(hm(e.s)+" "+e.t)}">${esc(e.t)}</button>`; }).join("");
    const tb = def ? `<button type="button" class="tlb k-train ${x.done?"done":""}" style="top:${top(d.session.start)};height:${hgt(d.session.start,d.session.end)}" data-wktrain="${k}">${x.done?"✓ ":""}${esc(def.name)}</button>` : "";
    const ad = x.evs.filter(e=>e.allDay).map(e=>{ wkEvIndex[wkKey(e)] = e; return `<button type="button" class="tla" data-wkev="${esc(wkKey(e))}">${esc(e.t)}</button>`; }).join("");
    return `<div class="tlc ${isT?"today":""}"><div class="tlh">${SHORT[d.date.getDay()]} ${d.date.getDate()}</div><div class="tlad">${ad}</div><div class="tlg" data-wkgrid="${k}">${blocks}${tb}</div></div>`; }).join("");
  const hours = [8,10,12,14,16,18,20,22].map(h=>`<span style="top:${top(h*60)}">${h}:00</span>`).join("");
  const timeline = `<div class="wktl"><div class="tlhours"><div class="tlh"></div><div class="tlad"></div><div class="tlg">${hours}</div></div>${cols}</div>`;

  // "Ask the coach" moved here from Today (Oti 23.10.): it reviews the week
  const coach = `<details class="card" data-fold="coach"><summary>${L("Ask the coach","Coach fragen")}</summary><p class="small muted">${L("Sends your profile, the last 14 days and this week's plan to Claude for a blunt review. Uses your Claude usage.","Schickt dein Profil, die letzten 14 Tage und den Wochenplan an Claude für eine ehrliche Bewertung. Nutzt dein Claude Kontingent.")}</p>
    <button id="btnCoach">${L("Review my week","Meine Woche bewerten")}</button><div id="coachOut" class="coach-out" data-notr hidden></div></details>`;
  $("#v-week").innerHTML = head + `<div class="wkagenda">${agenda}</div>` + timeline + coach;
  { const bc = $("#btnCoach"); if(bc) bc.onclick = askCoach; }
  const v = $("#v-week");
  $("#wkPrev").onclick = ()=>{weekOffset--;render();}; $("#wkNext").onclick = ()=>{weekOffset++;render();}; const wn = $("#wkNow"); if(wn) wn.onclick = ()=>{weekOffset=0;render();};
  $("#wkAdd").onclick = ()=>openEventSheet(null, {date: weekOffset ? dateKey(mon) : today});
  $("#wkMic").onclick = openAssistant;
  v.querySelectorAll("details.wkday").forEach(el=>el.addEventListener("toggle", ()=>{ wkOpen[el.dataset.wkday] = el.open; try{ sessionStorage.setItem("ohc-wkopen", JSON.stringify(wkOpen)); }catch(e){} }));
  v.querySelectorAll("[data-wkev]").forEach(b=>b.onclick = ()=>{ const e = wkEvIndex[b.dataset.wkev]; if(e) openEventSheet(e); });
  v.querySelectorAll("[data-wknew]").forEach(b=>b.onclick = ()=>openEventSheet(null, {date: b.dataset.wknew}));
  v.querySelectorAll("[data-wktrain]").forEach(b=>b.onclick = ()=>{ const k = b.dataset.wktrain; if(k===today){ switchTab("today"); openTraining(); } else openDaySheet(k); });
  // Mac: tap an empty spot in a column = new event at that hour
  v.querySelectorAll("[data-wkgrid]").forEach(g=>g.addEventListener("click", ev=>{ if(ev.target!==g) return; const r = g.getBoundingClientRect(), m = S + (ev.clientY - r.top)/r.height*(E-S), h = Math.max(7, Math.min(22, Math.floor(m/60)));
    openEventSheet(null, {date: g.dataset.wkgrid, start: `${pad(h)}:00`, end: `${pad(h+1)}:00`}); }));
}

/* ---------- event sheet: add, change, delete ---------- */
function openEventSheet(e, pre){
  const isNew = !e, ro = e && !e.w;
  const t0 = e && !e.allDay ? new Date(e.raw.start.dateTime) : null, t1 = e && !e.allDay ? new Date(e.raw.end?.dateTime || e.raw.start.dateTime) : null;
  const day = e ? (e.allDay ? e.raw.start.date : dateKey(t0)) : (pre?.date || dateKey(new Date()));
  const hmD = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`, plus60 = x => { const [h,m] = x.split(":").map(Number), v = Math.min(23*60+59, h*60+m+60); return hm(v); };
  const st = t0 ? hmD(t0) : pre?.start || "18:00", en = t1 ? hmD(t1) : pre?.end || plus60(st);
  const title = isNew ? L("New event","Neuer Termin") : ro ? L("Event","Termin") : L("Change event","Termin ändern");
  const why = ro ? (e.rec ? L("Repeats: change the series in Google Calendar.","Wiederkehrend: die Serie in Google Kalender ändern.") : e.multi ? L("Runs over several days: change it in Google Calendar.","Geht über mehrere Tage: in Google Kalender ändern.") : e.cid!=="primary" ? L("From a calendar the app only reads (band or work).","Aus einem Kalender, den die App nur liest (Band oder Arbeit).") : L("Read only until the backend update is deployed.","Nur lesen, bis das Backend Update bereitgestellt ist.")) : "";
  const body = `<div style="display:grid;gap:12px" data-evsheet>
    ${ro?`<p class="small muted">${esc(why)}</p>`:""}
    <label class="f" for="evT">${L("Title","Titel")}<input id="evT" value="${esc(e?.t || pre?.title || "")}" ${ro?"disabled":""} placeholder="${L("What","Was")}"></label>
    <div class="grid2"><label class="f" for="evD">${L("Date","Datum")}<input id="evD" type="date" value="${esc(day)}" ${ro?"disabled":""}></label>
      <label class="f" for="evA" style="grid-auto-flow:column;justify-content:start;align-items:center;gap:8px;align-self:end;min-height:44px"><input id="evA" type="checkbox" ${(e?.allDay||pre?.allDay)?"checked":""} ${ro?"disabled":""} style="min-height:0;width:20px;height:20px"> ${L("All day","Ganztägig")}</label></div>
    <div class="grid2" id="evTimes"><label class="f" for="evS">${L("Start","Beginn")}<input id="evS" type="time" value="${esc(st)}" ${ro?"disabled":""}></label><label class="f" for="evE">${L("End","Ende")}<input id="evE" type="time" value="${esc(en)}" ${ro?"disabled":""}></label></div>
    <label class="f" for="evL">${L("Place","Ort")}<input id="evL" value="${esc(e?.loc || pre?.location || "")}" ${ro?"disabled":""}></label>
    ${ro?"":`<button type="button" class="primary" id="evSave">${isNew?L("Add to Google Calendar","In Google Kalender eintragen"):L("Save","Speichern")}</button>`}
    ${!isNew && !ro?`<button type="button" class="ghost" id="evDel">${L("Delete","Löschen")}</button>`:""}
    <p class="small muted" id="evMsg" aria-live="polite"></p></div>`;
  openSheet(title, body, root=>{
    const sync = ()=>{ const a = root.querySelector("#evA").checked; root.querySelector("#evTimes").hidden = a; }; sync();
    root.querySelector("#evA").onchange = sync;
    const msg = t => { root.querySelector("#evMsg").textContent = t; };
    const s = root.querySelector("#evSave"); if(s) s.onclick = async ()=>{
      const t = root.querySelector("#evT").value.trim(), d = root.querySelector("#evD").value, a = root.querySelector("#evA").checked, ss = root.querySelector("#evS").value, ee = root.querySelector("#evE").value;
      if(!t || !d){ msg(L("Title and date are needed.","Titel und Datum fehlen.")); return; }
      if(!a && ee <= ss){ msg(L("The end is before the start.","Das Ende liegt vor dem Beginn.")); return; }
      const keepEnd = e && e.allDay && e.raw.start.date===d ? e.raw.end?.date : null;
      const ev = a ? {title:t, start:d, end: keepEnd || dateKey(addDays(fromKey(d),1)), allDay:true, location:root.querySelector("#evL").value.trim()} : {title:t, start:`${d}T${ss}`, end:`${d}T${ee}`, allDay:false, location:root.querySelector("#evL").value.trim()};
      s.disabled = true; msg(L("Saving in Google Calendar…","Speichere in Google Kalender…"));
      try{ if(isNew) await API.cal.create(ev); else await API.cal.update(e.id, e.raw.start.dateTime || e.raw.start.date, ev); closeSheet(); await refreshCalendar(true); }
      catch(err){ s.disabled = false; msg(L("Not saved: ","Nicht gespeichert: ") + (err.message||err)); }
    };
    const dl = root.querySelector("#evDel"); if(dl) dl.onclick = async ()=>{
      if(dl.dataset.armed!=="1"){ dl.dataset.armed = "1"; dl.textContent = L("Tap again to delete","Nochmal tippen zum Löschen"); return; }
      dl.disabled = true; msg(L("Deleting…","Lösche…"));
      try{ await API.cal.remove(e.id, e.raw.start.dateTime || e.raw.start.date); closeSheet(); await refreshCalendar(true); }
      catch(err){ dl.disabled = false; msg(L("Not deleted: ","Nicht gelöscht: ") + (err.message||err)); }
    };
  });
}

/* ---------- assistant ---------- */
function openAssistant(){
  const body = `<div style="display:grid;gap:12px">
    <p class="small muted">${L("Say or type what should change, for example: \"Tomorrow 3 pm dentist, one hour\". Tap the microphone on the keyboard to dictate. Nothing is written before you confirm.","Sag oder tippe, was sich ändern soll, zum Beispiel: „Morgen 15 Uhr Zahnarzt, eine Stunde“. Zum Diktieren auf das Mikrofon der Tastatur tippen. Nichts wird eingetragen, bevor du bestätigst.")}</p>
    <label class="f" for="asT">${L("Your sentence","Dein Satz")}<textarea id="asT" rows="3" style="width:100%"></textarea></label>
    <button type="button" class="primary" id="asGo">${L("Ask","Fragen")}</button>
    <div id="asOut" aria-live="polite"></div></div>`;
  openSheet(L("Calendar assistant","Kalender Assistent"), body, root=>{
    const ta = root.querySelector("#asT"); setTimeout(()=>ta.focus(), 50);
    root.querySelector("#asGo").onclick = async ()=>{
      const text = ta.value.trim(); if(!text) return; const out = root.querySelector("#asOut"), go = root.querySelector("#asGo");
      go.disabled = true; out.innerHTML = `<p class="small muted">${L("Thinking…","Denke nach…")}</p>`;
      const list = []; for(let i=0;i<14;i++){ const d = addDays(mondayOf(new Date()), i); for(const e of wkEvents(d)) if(e.cid==="primary" && !e.cont) list.push({id:e.id, title:e.t, start: e.allDay ? e.raw.start.date : `${dateKey(d)}T${hm(e.s)}`, end: e.allDay ? e.raw.end?.date : `${dateKey(d)}T${hm(e.e)}`, recurring:e.rec}); }
      let r; try{ r = await API.assist(text, list); }catch(err){ go.disabled = false; out.innerHTML = `<div class="banner">${esc(err.code==="no_api_key" ? L("The assistant needs its key on the worker first (Setup).","Der Assistent braucht zuerst seinen Schlüssel auf dem Worker (Setup).") : (err.message||String(err)))}</div>`; return; }
      go.disabled = false;
      if(r.action==="none" || !r.action){ out.innerHTML = `<div class="banner">${esc(r.reply||L("Not understood.","Nicht verstanden."))}</div>`; return; }
      const find = () => { for(const e of Object.values(wkEvIndexAll())) if(e.id===r.id) return e; return null; };
      if(r.action==="delete"){ const e = find(); out.innerHTML = `<div class="banner"><b>${esc(r.reply)}</b></div>${e?`<button type="button" class="ghost" id="asDo">${L("Open to delete","Zum Löschen öffnen")}: ${esc(e.t)}</button>`:""}`;
        const b = root.querySelector("#asDo"); if(b) b.onclick = ()=>openEventSheet(e); return; }
      const ev = r.event || {}, [d, t] = String(ev.start||"").split("T"), [d2, t2] = String(ev.end||"").split("T");
      const pre = {title: ev.title, date: d, start: (t||"").slice(0,5) || undefined, end: (t2||"").slice(0,5) || undefined, allDay: !!ev.allDay, location: ev.location};
      const upd = r.action==="update", target = upd ? find() : null;
      if(upd && !target){ out.innerHTML = `<div class="banner">${esc(r.reply)} ${L("I could not find that event. Open it in the week and change it there.","Ich finde diesen Termin nicht. Öffne ihn in der Woche und ändere ihn dort.")}</div>`; return; }
      out.innerHTML = `<div class="banner"><b>${esc(r.reply)}</b>${upd?`<br>${esc(target.t)} → ${esc(pre.date||"")} ${esc(pre.start||"")}`:""}</div><button type="button" class="primary" id="asDo">${upd?L("Check the change","Änderung prüfen"):L("Check and add","Prüfen und eintragen")}</button>`;
      root.querySelector("#asDo").onclick = ()=>{ if(r.action==="update"){ const e = find(); if(e){ openEventSheet(e); setTimeout(()=>{ const q = s => document.querySelector(s); if(pre.title) q("#evT").value = pre.title; if(pre.date) q("#evD").value = pre.date; if(pre.start) q("#evS").value = pre.start; if(pre.end) q("#evE").value = pre.end; if(pre.location) q("#evL").value = pre.location; }, 30); } return; }
        openEventSheet(null, pre); };
    };
  });
}
function wkEvIndexAll(){ const all = {}; for(let i=0;i<14;i++){ const d = addDays(mondayOf(new Date()), i); for(const e of wkEvents(d)) all[wkKey(e)] = e; } return all; }

/* ---------- calendar refresh: after a change, every minute on the Week tab, and when the app comes back ---------- */
let calRefreshing = null;
async function refreshCalendar(force){
  if(!mcp) return; if(calRefreshing){ if(!force) return calRefreshing; await calRefreshing.catch(()=>{}); }
  const {start, end} = calRange();
  calRefreshing = Promise.all(profile.calendars.map(async cid=>{
    const input = {startTime:start.toISOString(), endTime:end.toISOString(), orderBy:"startTime", pageSize:250, timeZone:"Europe/Berlin"};
    if(cid!=="primary") input.calendarId = cid;
    try{ const r = await mcp.callTool(CAL_SERVER, "list_events", input); calEvents[cid] = parsePayload(r.payload); calState = {status:"ok", msg:"Calendar synced", at:Date.now()}; }catch(e){}
  })).then(()=>{ planCache.clear(); render(); }).finally(()=>{ calRefreshing = null; });
  return calRefreshing;
}
setInterval(()=>{ if(!document.hidden && tab==="week") refreshCalendar(); }, 60000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) refreshCalendar(); });
