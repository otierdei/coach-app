/* Oti Hybrid Coach, GitHub version. Generated from the claude.ai artifact v67 by tools/build_from_v67.py.
   db, mcp and sample are provided by api.js (Google Apps Script backend).
   The code is split into several classic scripts that share one global scope; load them in order. */
function renderWeek(){
  const mon = addDays(mondayOf(new Date()), 7*weekOffset), P = weekPlan(mon), today = dateKey(new Date()), wc = weekCounts(mon);
  let html = `<div class="spread" style="padding:4px 2px 0"><div><div class="eyebrow">${P.w<1?"Before block 1":P.w>12?"After block 1":`Week ${P.w} of 12${DELOAD(P.w)?" · deload":""}`}</div><h2>${mon.toLocaleDateString("en-GB",{day:"numeric",month:"short"})} to ${addDays(mon,6).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</h2></div>
    ${ring(wc.planned?wc.done/wc.planned:0, "var(--week)", 58, 7, `${wc.done}/${wc.planned}`, "", 17)}</div>
    <div class="row"><button class="ghost" id="wkPrev" aria-label="Previous week">←</button><button class="ghost" id="wkNow">This week</button><button class="ghost" id="wkNext" aria-label="Next week">→</button></div>`;
  if(weekOffset>1) html += `<div class="banner">Calendar events load for this and next week only. Later weeks use your template.</div>`;
  for(const d of P.days){
    const k = dateKey(d.date), def = d.session?.def ? formDef(d.session.def, formLevel(dateKey(d.date))) : null, dn = def ? doneCount(k, def) : 0;
    html += `<div class="wday ${k===today?"today":""}" data-wday="${k}" style="cursor:pointer">
      ${ring(def? dn/def.total : 0, def?(isDone(k,def)?"var(--rec-g)":"var(--load)"):"var(--track)", 52, 6, `<span style="font-size:13px">${SHORT[d.date.getDay()]}</span>`, "", 13)}
      <div style="display:grid;gap:4px;min-width:0"><div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><span style="font-weight:700;display:inline-flex;align-items:center;gap:8px;min-width:0" class="${def?`ty-${typeKey(def.type)}`:""}">${def?tbadge(def.type,"sm"):""}<span class="tname" style="min-width:0">${def?esc(def.name):d.conflict?"No slot":d.date.getDay()===6?"Day off":"Rest"}${def?`<span class="muted small" style="white-space:nowrap"> · ${fmt(d.session.start)}</span>`:""}</span></span><span class="small muted mono">${d.date.getDate()}.${d.date.getMonth()+1}.</span></div>
      <div class="row" style="gap:6px">${def&&isDone(k,def)?`<span class="chip g">Done</span>`:""}${d.session?.moved?`<span class="chip">moved from ${d.session.fromDay}</span>`:""}${d.bed.late?`<span class="chip sleep">bed ${fmt(d.bed.bed)}</span>`:""}${d.wake.early?`<span class="chip sleep">wake ${fmt(d.wake.wake)}</span>`:""}${d.afterLate&&def?.hard?`<span class="chip y">after late night</span>`:""}${(()=>{ const x = k<today? strainFor(k) : null; return x!=null? `<span class="chip load">strain ${x.toFixed(1)}</span>` : ""; })()}${workoutsFor(k).map(w=>`<span class="chip watch">⌚ ${esc(wType(w))} ${w.min} min${w.km?` · ${w.km.toFixed(1)} km`:""}</span>`).join("")}</div></div>
      <div class="full"><button type="button" class="stripbtn" data-daycal="${k}" aria-label="Open day calendar">${strip(d,false)}</button>${def?`<details ${k===today?"open":""}><summary>${dn}/${def.total} sets · show workout</summary><div style="display:grid;gap:8px;margin-top:8px">${blocksHtml(def,k)}</div></details>`:""}</div></div>`;
  }
  $("#v-week").innerHTML = html;
  bindChecks("#v-week", defForKey);
  $("#wkPrev").onclick = ()=>{weekOffset--;render();}; $("#wkNext").onclick = ()=>{weekOffset++;render();}; $("#wkNow").onclick = ()=>{weekOffset=0;render();};
}
function consistency(n){
  const keys = [...Array(n)].map((_,i)=>dateKey(addDays(new Date(),-i)));
  const w = keys.map(k=>health.days[k]?.wakeAt).filter(x=>x!=null);
  const ok = w.filter(x=>Math.abs(x - wakeFor(fromKey(keys[0])).wake) <= 30 || Math.abs(x - toMin(profile.wake)) <= 30).length;
  return {n:w.length, ok};
}
function renderSleep(){
  const mon = mondayOf(new Date()), P = weekPlan(mon), k = dateKey(new Date());
  const nights = Object.entries(health.days).filter(([,v])=>v.onset!=null && v.wakeAt!=null).sort().slice(-30);
  const last14 = nights.slice(-14), sm = sleepMinFor(k), C = consistency(14);
  const wakeSd = sd(last14.map(([,v])=>v.wakeAt)), avg = mean(last14.map(([,v])=>v.sleepMin).filter(Boolean));
  let html = `<div style="padding:4px 2px 0"><div class="eyebrow">Sleep</div><h2>Rhythm first</h2></div>
    <div class="card"><div class="minis" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="mini">${ring(sm?sm/profile.asleepNeed:0, "var(--sleep)", 116, 11, sm?`${Math.floor(sm/60)}:${pad(Math.round(sm%60))}`:"–", "last night", 30)}<div class="cap">${sm?Math.round(sm/profile.asleepNeed*100)+"% of your 7:30 need":"Nothing logged"}</div></div>
      <div class="mini">${ring(C.n?C.ok/C.n:0, "var(--sleep)", 116, 11, C.n?`${C.ok}/${C.n}`:"–", "on anchor", 30)}<div class="cap">Wake within ±30 min, last 14 nights</div></div>
    </div>
    <div class="grid3"><div><div class="mono">${avg?dur(avg):"–"}</div><div class="small muted">avg asleep</div></div><div><div class="mono">${wakeSd!=null?"±"+Math.round(wakeSd)+" min":"–"}</div><div class="small muted">wake spread</div></div><div><div class="mono">${profile.wake}</div><div class="small muted">anchor</div></div></div>
    ${nights.length?sleepChart(nights):`<p class="small muted">Sleep history appears here once your Shortcuts automation sends data.</p>`}</div>`;
  html += nightsHtml(nights);
  html += journalHtml();
  html += `<div class="card"><h3>This week's nights</h3><div class="tbl"><table><thead><tr><th>Night</th><th class="num">Last meal</th><th class="num">Lights out</th><th class="num">Wake</th><th class="num">In bed</th></tr></thead><tbody>`;
  for(const d of P.days){ const nx = addDays(d.date,1);
    html += `<tr><td>${SHORT[d.date.getDay()]} → ${SHORT[nx.getDay()]}${d.bed.late?` <span class="chip sleep">late</span>`:""}${d.bed.early?` <span class="chip sleep">early</span>`:""}</td><td class="num mono">${fmt(lastMealFor(d))}</td><td class="num mono">${fmt(d.bed.bed)}</td><td class="num mono">${fmt(d.bed.nextWake)}</td><td class="num mono">${dur(d.bed.inBed)}</td></tr>`; }
  html += `</tbody></table></div>
    <div class="grid2"><div class="block"><span class="bn">Coffee</span><span class="bd">Last cup by ${profile.coffeeCutoff}. You struggle to fall asleep sometimes, and 2 to 3 cups late in the day is a likely reason.</span></div>
    <div class="block"><span class="bn">Dinner</span><span class="bd">Last big meal 3 h before lights out. Church nights: eat before 19:15. Youth night: around 17:30.</span></div>
    <div class="block"><span class="bn">Late nights</span><span class="bd">Keep the wake time. Take a 20 min nap before 15:00 instead of sleeping in.</span></div>
    <div class="block"><span class="bn">Can't fall asleep</span><span class="bd">After 20 min awake, get up, dim light, read paper, go back when sleepy.</span></div></div></div>`;
  $("#v-sleep").innerHTML = html;
  bindTips("#v-sleep");
  document.querySelectorAll("#v-sleep [data-night]").forEach(b=>b.addEventListener("click", ()=>openNight(b.dataset.night)));
}
/* ================= single nights: stages + feedback ================= */
function stagesOf(v){
  if(!v || !(v.deep>0) || !(v.rem>0)) return null;
  const light = v.light!=null && v.light>0 ? v.light : Math.max(0, (v.sleepMin||0) - v.deep - v.rem);
  return {deep:v.deep, rem:v.rem, light, awake: v.awake>0 ? v.awake : 0, est: !(v.light>0)};
}
function stageBar(st, big){
  if(!st) return `<div class="sbar${big?" big":""}"><i style="width:100%;background:color-mix(in srgb,var(--sleep) 30%,transparent)"></i></div>`;
  const tot = st.deep+st.rem+st.light+st.awake || 1, w = x => (x/tot*100).toFixed(1)+"%";
  return `<div class="sbar${big?" big":""}" role="img" aria-label="Deep ${st.deep} min, REM ${st.rem} min, light ${Math.round(st.light)} min, awake ${st.awake} min"><i style="width:${w(st.deep)};background:var(--s-deep)"></i><i style="width:${w(st.rem)};background:var(--s-rem)"></i><i style="width:${w(st.light)};background:var(--s-light)"></i>${st.awake?`<i style="width:${w(st.awake)};background:var(--s-awake)"></i>`:""}</div>`;
}
const SLEGEND = `<div class="slegend"><span><i style="background:var(--s-deep)"></i>Deep</span><span><i style="background:var(--s-rem)"></i>REM</span><span><i style="background:var(--s-light)"></i>Light</span><span><i style="background:var(--s-awake)"></i>Awake</span></div>`;
function nightLabel(k){ return fromKey(k).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}); }
function nightGrade(k){
  const v = health.days[k]||{}, need = profile.asleepNeed, sm = v.sleepMin||0, B = baselines(fromKey(k));
  let pts = sm >= need-15 ? 2 : sm >= need-60 ? 1 : 0;
  if(v.hrv && B.hrv){ if(v.hrv/B.hrv >= 1.05) pts++; else if(v.hrv/B.hrv < 0.85) pts--; }
  if(sm < need-45) pts = Math.min(pts, 1);
  return pts >= 2 ? {c:"g", t:"Good"} : pts === 1 ? {c:"y", t:"OK"} : {c:"r", t:"Poor"};
}
function nightsHtml(nights){
  if(!nights.length) return "";
  const rows = [...nights].reverse().map(([k,v])=>{ const st = stagesOf(v), g = nightGrade(k);
    return `<button type="button" class="nrow" data-night="${k}"><span class="t">${esc(nightLabel(k))}</span><span class="m">${fmt(v.onset)} to ${fmt(v.wakeAt)}${st?` · deep ${st.deep} · REM ${st.rem}`:""}</span><span class="v"><span class="chip ${g.c}" style="padding:2px 8px">${g.t}</span>${dur(v.sleepMin||0)}</span><span class="sb">${stageBar(st)}</span></button>`; });
  return `<div class="card"><div class="spread"><h3>Nights</h3><span class="small muted">tap a night</span></div>${SLEGEND}
    <div class="list">${rows.slice(0,7).join("")}</div>
    ${rows.length>7?`<details><summary>Older nights (${rows.length-7})</summary><div class="list" style="margin-top:8px">${rows.slice(7).join("")}</div></details>`:""}</div>`;
}
function nightFeedback(k){
  const v = health.days[k]||{}, d = fromKey(k), need = profile.asleepNeed, sm = v.sleepMin||0, st = stagesOf(v), B = baselines(d);
  const j = logData.days[dateKey(addDays(d,-1))]?.j || {}, out = [];
  let anc = toMin(profile.wake); try{ const w = wakeFor(d); if(w && w.wake!=null) anc = w.wake; }catch(e){}
  if(sm >= need-15) out.push(`Enough sleep: ${dur(sm)}, right at your 7:30 need.`);
  else if(sm >= need-60) out.push(`A bit short: ${dur(sm)}, about ${Math.round((need-sm)/5)*5} min under your need.`);
  else out.push(`Short night: ${dur(sm)}, ${dur(need-sm)} under your need. Expect lower energy today and keep hard efforts controlled.`);
  const on = v.onset < 720 ? v.onset + 1440 : v.onset;
  if(on > 1440-15) out.push(`You fell asleep late, at ${fmt(v.onset)}. Bedtime is your lever: lights out by 23:30 gives you the full night before ${fmt(anc)}.`);
  if(v.wakeAt - anc > 45) out.push(`You woke at ${fmt(v.wakeAt)}, ${v.wakeAt-anc} min after your ${fmt(anc)} anchor. Sleeping in shifts your rhythm; keep the wake time and nap before 15:00 instead.`);
  if(st){ const tot = st.deep+st.rem+st.light, dp = st.deep/tot, rp = st.rem/tot;
    if(dp < 0.12) out.push(`Deep sleep was low (${Math.round(dp*100)}%). Late meals, alcohol and hard training late in the evening cut it most.`);
    else if(dp >= 0.18) out.push(`Strong deep sleep (${Math.round(dp*100)}%), the phase that repairs muscle after training.`);
    if(rp < 0.15) out.push(`REM was low (${Math.round(rp*100)}%). REM sits in the last hours of the night, so a short or late night cuts it first.`);
    else if(rp >= 0.2 && dp >= 0.12) out.push(`REM was healthy (${Math.round(rp*100)}%), good for focus and mood.`);
  }
  if(v.hrv && B.hrv){ const r = v.hrv/B.hrv;
    if(r >= 1.1) out.push(`Your HRV was above your normal (${Math.round(v.hrv)} vs ${Math.round(B.hrv)}): your body recovered well.`);
    else if(r < 0.85) out.push(`HRV below your normal (${Math.round(v.hrv)} vs ${Math.round(B.hrv)}): your body is still carrying load.`); }
  if(v.rhr && B.rhr && v.rhr - B.rhr >= 4) out.push(`Resting pulse ${Math.round(v.rhr - B.rhr)} above normal, often a late meal, alcohol, stress or a hard session the day before.`);
  const bad = JOURNAL.filter(x=>j[x.k] && x.k!=="windDown" && x.k!=="nap").map(x=>x.t.toLowerCase());
  if(bad.length) out.push(`The evening before you logged: ${bad.join(", ")}. Check whether that pattern shows up on your bad nights.`);
  else if(j.windDown) out.push(`You did your wind down routine the evening before. Keep it.`);
  return out.slice(0,5);
}
function openNight(k){
  const v = health.days[k]; if(!v) return;
  const st = stagesOf(v), g = nightGrade(k), B = baselines(fromKey(k)), cell = (b,s)=>`<div><b>${b}</b><span>${s}</span></div>`;
  let body = `<div class="row"><span class="chip ${g.c}"><span class="dot"></span>${g.t}</span><span class="small muted mono">${fmt(v.onset)} to ${fmt(v.wakeAt)}</span></div>
    <div class="kv">${cell(dur(v.sleepMin||0), "asleep")}${cell(v.hrv?Math.round(v.hrv)+" ms":"–", `HRV${B.hrv?` · normal ${Math.round(B.hrv)}`:""}`)}${cell(v.rhr?v.rhr+" bpm":"–", `resting pulse${B.rhr?` · normal ${Math.round(B.rhr)}`:""}`)}${cell(v.hrn?v.hrn+" bpm":"–", "lowest night pulse")}</div>`;
  if(st){ const tot = st.deep+st.rem+st.light+st.awake, p = x => Math.round(x/tot*100)+"%";
    body += `<div style="display:grid;gap:8px"><div class="eyebrow">Sleep zones</div>${stageBar(st,true)}${SLEGEND}
      <div class="kv">${cell(dur(st.deep), `deep · ${p(st.deep)}`)}${cell(dur(st.rem), `REM · ${p(st.rem)}`)}${cell(dur(Math.round(st.light)), `light · ${p(st.light)}${st.est?" (estimated)":""}`)}${cell(st.awake?dur(st.awake):"–", "awake")}</div></div>`; }
  else body += `<div class="banner">No sleep zones for this night yet. They load from your daily upload file in Google Drive; open the app again in a minute if the night is recent.</div>`;
  body += `<div style="display:grid;gap:8px"><div class="eyebrow">Feedback</div><div class="nfb">${nightFeedback(k).map(x=>`<p>${esc(x)}</p>`).join("")}</div></div>`;
  openSheet(nightLabel(k), body);
}
function metricPct(m){
  const b = profile.baselines[m.k], l = latest(m.k), t = profile.targets[m.k];
  const nb = m.lower? secs(b):Number(b), nl = m.lower? secs(l):Number(l), nt = m.lower? secs(t):Number(t);
  return nt===nb ? 0 : clamp((nl-nb)/(nt-nb), 0, 1);
}
function renderProgress(){
  const now = new Date(), w = weekIndex(now);
  const last7 = [...Array(7)].map((_,i)=>addDays(now,-i)).filter(x=>!isFast(x)).map(x=>logData.days[dateKey(x)]?.protein||0);
  const protAvg = mean(last7);
  let pl=0, dn=0; for(let i=0;i<4;i++){ const c = weekCounts(addDays(mondayOf(now),-7*i)); pl+=c.planned; dn+=c.done; }
  const C = consistency(14);
  const cards = [
    ...METRICS.map(m=>[metricPct(m), m.lower?"var(--load)":"var(--rec-g)", esc(String(latest(m.k))), m.n, `target ${esc(String(profile.targets[m.k]))}${m.k==="t10k"?" · end of March":""}${m.k==="pistol"&&Number(latest("pistol"))===0?" · test in week 1":""}`]),
    [clamp((secs(profile.baselines.t5k)-secs(latest("t5k")))/(secs(profile.baselines.t5k)-secs(profile.dream.t5k)),0,1), "var(--week)", mmss(secs(latest("t5k"))), "Road to sub 20", "summer 2027 race"],
    [pl?dn/pl:0, "var(--week)", `${dn}/${pl}`, "Sessions", "last 4 weeks"],
    [C.n?C.ok/C.n:0, "var(--sleep)", C.n?`${C.ok}/${C.n}`:"–", "Sleep anchor", "last 14 nights"],
    [clamp(protAvg/profile.proteinTarget,0,1), "var(--protein)", `${Math.round(protAvg)}`, "Protein g/day", `7 day avg without fast days · aim ${profile.proteinTarget}`],
    (()=>{ const st=[...Array(7)].map((_,i)=>health.days[dateKey(addDays(now,-(i+1)))]?.steps).filter(x=>x!=null); const a=mean(st); return [a?clamp(a/profile.stepGoal,0,1):0, "var(--steps)", a?(a/1000).toFixed(1)+"k":"–", "Steps/day", `7 day avg · aim ${(profile.stepGoal/1000)}k`]; })()
  ];
  // daily habits first, long term goals further down
  const pc = c=>`<div class="pcard">${ring(c[0], c[1], 104, 10, c[2], "", c[2].length>5?20:26)}<div class="t">${c[3]}</div><div class="s">${c[4]} · ${Math.round(c[0]*100)}%</div></div>`;
  const nGoals = METRICS.length + 1, goals = cards.slice(0, nGoals), habits = cards.slice(nGoals);
  if(profile.creatineFrom && dateKey(now) >= profile.creatineFrom){ const ds = [...Array(7)].map((_,i)=>dateKey(addDays(now,-i))).filter(x=>x>=profile.creatineFrom); const n = ds.filter(x=>logData.days[x]?.crea).length; habits.push([ds.length? n/ds.length : 0, "var(--lift)", `${n}/${ds.length}`, "Creatine", "days taken, last 7"]); }
  let html = `<div style="padding:4px 2px 0"><div class="eyebrow">Progress · ${w<1?"block 1 starts 28 Sep":`block 1, week ${clamp(w,1,12)} of 12`}</div><h2>Your habits</h2></div><div class="rings-grid">${habits.map(pc).join("")}</div>`;
  html += paiHtml();
  html += vo2Html();
  html += ageHtml();
  html += workoutsHtml();
  html += `<div style="padding:10px 2px 0"><div class="eyebrow">Block and long term</div><h2>Your goals</h2></div><div class="rings-grid">${goals.map(pc).join("")}</div>`;
  html += `<div class="card"><h3>Log a test</h3><p class="small muted">A 5k test is built into week 6, a 10k test into week 12. Test pull ups, push ups and pistols the same weeks, fresh.</p>
    <div class="grid3"><label class="f" for="tMetric">Test<select id="tMetric">${METRICS.map(m=>`<option value="${m.k}">${m.n}</option>`).join("")}</select></label>
    <label class="f" for="tVal">Result<input id="tVal" placeholder="22:58 or 9"></label><label class="f" for="tDate">Date<input id="tDate" type="date" value="${dateKey(now)}"></label></div>
    <button id="btnTest">Save result</button></div>`;
  const P = paces();
  html += `<div class="card"><h3>Your paces</h3><div class="grid2"><div><div class="mono">${pace(P.E2)} to ${pace(P.E1)}</div><div class="small muted">Easy · HR under 150</div></div><div><div class="mono">${pace(P.T)}</div><div class="small muted">Tempo</div></div><div><div class="mono">${pace(P.I)}</div><div class="small muted">Intervals</div></div><div><div class="mono">${pace(P.G)}</div><div class="small muted">Block goal pace (${profile.targets.t5k})</div></div></div></div>`;
  const series = f => Object.entries(health.days).filter(([,v])=>v[f]).sort().slice(-60).map(([k,v])=>[k,v[f]]);
  const rhr = series("rhr"), hrv = series("hrv"), wt = series("weight");
  html += `<div class="card"><h3>Resting heart rate</h3>${rhr.length>1? lineChart(rhr,"Resting heart rate","bpm","var(--rec-r)") : `<p class="small muted">Appears once data syncs.</p>`}</div>`;
  if(hrv.length>1) html += `<div class="card"><h3>HRV</h3>${lineChart(hrv,"HRV","ms","var(--rec-g)")}</div>`;
  const rrS = series("rr"), hn = series("hrn");
  if(hn.length>1) html += `<div class="card"><h3>Night pulse</h3>${lineChart(hn,"Night pulse","bpm","var(--rec-r)")}<p class="small muted">A jump of more than 5 above your normal is often the first sign of getting sick.</p></div>`;
  if(rrS.length>1) html += `<div class="card"><h3>Breathing rate at night</h3>${lineChart(rrS,"Breathing rate","/min","var(--sleep)")}</div>`;
  const kc = series("kcal");
  const stS = [...Array(42)].map((_,i)=>dateKey(addDays(now,-(42-i)))).map(k=>[k, strainFor(k)]).filter(p=>p[1]!=null);
  if(stS.length>1) html += `<div class="card"><h3>Strain</h3>${lineChart(stS,"Strain","","var(--load)")}<p class="small muted">0 to 21, from heart rate zones of your watch workouts plus steps. Green days: aim 14 to 18, yellow 10 to 14, red under 9.</p></div>`;
  if(kc.length>1) html += `<div class="card"><h3>Active calories</h3>${lineChart(kc,"Active calories","kcal","var(--week)")}<p class="small muted">Estimated by your watch. Treat it as a trend, not an exact number: wrist estimates are often 20 to 30% off.</p></div>`;
  if(wt.length>1) html += `<div class="card"><h3>Weight</h3>${lineChart(wt,"Weight","kg","var(--ink-2)")}<p class="small muted">Recomposition: expect the scale to stay within about 1 kg while strength numbers rise.</p></div>`;
  $("#v-progress").innerHTML = html;
  bindTips("#v-progress");
  const wall = (health.workouts||[]).filter(w=>w.type!=="Walk").slice().sort((a,b)=>(a.date+(a.start||""))<(b.date+(b.start||""))?1:-1);
  document.querySelectorAll("#v-progress [data-wk]").forEach(b=>b.onclick = ()=>workoutSheet(wall[Number(b.dataset.wk)]));
  const wka = document.getElementById("wkAll"); if(wka) wka.onclick = workoutsAll;
  document.querySelectorAll("#v-progress [data-age]").forEach(b=>b.onclick = ()=>{ const x = (otiAge()?.contrib||[])[Number(b.dataset.age)]; if(!x) return;
    openSheet(x.t, `<div class="kv"><div><b>${esc(x.v)}</b><span>your value</span></div><div><b style="color:${x.d<0?"var(--rec-g)":x.d>0.2?"var(--rec-r)":"var(--muted)"}">${x.d>0?"+":""}${x.d.toFixed(1)} years</b><span>effect on Oti Age</span></div></div><p>${esc(x.tip)}</p>`); });
  $("#btnTest").onclick = async ()=>{ const v=$("#tVal").value.trim(); if(!v) return; const m=$("#tMetric").value; const td=$("#tDate").value; profile.tests.push({metric:m, value: METRICS.find(x=>x.k===m).lower? v : Number(v), date:td}); try{ const lv = recovery(fromKey(td)).level; if(lv==="r"){ const LD = logData.days[td] = logData.days[td]||{}; LD.form = "r"; await saveDoc("log", logData); alert("Recovery was red on that day, so this test does not change your plan. Test again on a green day."); } }catch(e){} planCache.clear(); render(); await saveDoc("profile", profile); writeSchedule(true); };
}
function renderSetup(){
  const hd = Object.keys(health.days).sort();
  let html = `<div style="padding:4px 2px 0"><div class="eyebrow">Setup</div><h2>Data and plan</h2></div>${window.API ? API.setupCard() : ""}
  <div class="card"><div class="spread"><h3>Automatic health sync</h3><span class="chip ${driveState.status==="ok"?"g":driveState.status==="err"?"y":""}"><span class="dot"></span>${esc({ok:"Synced",err:"Problem",loading:"Syncing",idle:"Waiting",off:"Off",empty:"No files yet"}[driveState.status]||"")}</span></div>
    <p class="small">${esc(driveState.msg||"")}</p>
    <p class="small muted">Your free Shortcuts automation writes a small event with your sleep, resting HR and HRV into the Google calendar "Oti Health" the first time you open WhatsApp each morning. This page and the morning briefing read it.</p>
    <button id="btnDrive">Sync now</button>
    <div class="small muted">${hd.length?`${hd.length} days stored (${hd[0]} to ${hd[hd.length-1]}). Sources: ${esc((health.sources||[]).join(", "))}`:"No data stored yet."}</div></div>
  <div class="card"><h3>Manual import</h3><p class="small muted">Fallback: Apple Health export.zip or Zepp CSV files.</p>
    <input type="file" id="fileIn" multiple accept=".zip,.xml,.csv,.json,.txt,application/zip,text/xml,text/csv,application/json"><div id="impStatus" class="small muted"></div></div>
  <div class="card"><div class="spread"><h3>Calendar</h3><span class="chip ${calState.status==="ok"?"g":calState.status==="err"?"y":""}"><span class="dot"></span>${esc(calState.status==="ok"?"Live":calState.status==="err"?"Problem":calState.status==="loading"?"Loading":"Off")}</span></div>
    <p class="small">${esc(calState.msg||"")}</p>
    <label class="f" for="calIds">Calendars (one ID per line, "primary" = main)<textarea id="calIds" rows="3">${esc(profile.calendars.join("\n"))}</textarea></label></div>
  <div class="card"><h3>You</h3><div class="grid3">
    <label class="f" for="bW">Weight kg<input id="bW" type="number" step="0.1" value="${profile.body.weightKg}"></label>
    <label class="f" for="bH">Height cm<input id="bH" type="number" value="${profile.body.heightCm}"></label>
    <label class="f" for="bHr">Max HR<input id="bHr" type="number" value="${profile.body.maxHr}"></label>
    <label class="f" for="bP">Protein g/day<input id="bP" type="number" step="5" value="${profile.proteinTarget}"></label>
    <label class="f" for="sWake">Wake anchor<input id="sWake" type="time" value="${profile.wake}"></label>
    <label class="f" for="sCof">Coffee cutoff<input id="sCof" type="time" value="${profile.coffeeCutoff}"></label>
    <label class="f" for="sNeed">Time in bed min<input id="sNeed" type="number" step="15" value="${profile.sleepNeed}"></label>
    <label class="f" for="sPrep">Prep before 1st event<input id="sPrep" type="number" step="15" value="${profile.prepMin}"></label>
    <label class="f" for="sStart">Block start<input id="sStart" type="date" value="${profile.blockStart}"></label>
    <label class="f" for="bYear">Birth year (Oti Age)<input id="bYear" type="number" min="1950" max="2015" value="${profile.birthYear||""}"></label></div></div>
  <div class="card"><h3>Weekly template</h3><p class="small muted">Fixed commitments that aren't in your calendar.</p>`;
  for(const dow of [1,2,3,4,5,6,0]){
    const rows = profile.week[String(dow)]||[];
    html += `<div style="display:grid;gap:6px"><div class="eyebrow">${DAY_NAMES[dow]}</div>${rows.map((r,i)=>`<div class="tmpl-row"><input aria-label="Title" data-d="${dow}" data-i="${i}" data-f="t" value="${esc(r.t)}"><input aria-label="Start" type="time" data-d="${dow}" data-i="${i}" data-f="s" value="${r.s}"><input aria-label="End" type="time" data-d="${dow}" data-i="${i}" data-f="e" value="${r.e}"><button class="ghost" data-del="${dow}:${i}" aria-label="Remove">×</button></div>`).join("")}<button class="ghost small" data-add="${dow}" style="justify-self:start;padding:6px 12px">+ Add</button></div>`;
  }
  html += `</div><div class="card"><h3>Block targets</h3><div class="grid2">${METRICS.map(m=>`<label class="f" for="tg-${m.k}">${m.n}<input id="tg-${m.k}" data-tg="${m.k}" value="${esc(profile.targets[m.k])}"></label>`).join("")}</div></div>
    <div class="row"><button class="primary" id="btnSave">Save settings</button><span id="saveMsg" class="small muted"></span></div>`;
  $("#v-setup").innerHTML = html; if(window.API) API.bindSetup();
  $("#fileIn").addEventListener("change", e=>importFiles([...e.target.files]));
  $("#btnDrive").onclick = async ()=>{ if(!(await syncHealthCalendar())) syncDrive(true); };
  $("#v-setup").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{ const [d,i]=b.dataset.del.split(":"); collectTemplate(); profile.week[d].splice(Number(i),1); renderSetup(); });
  $("#v-setup").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{ collectTemplate(); (profile.week[b.dataset.add] = profile.week[b.dataset.add]||[]).push({t:"New",s:"19:00",e:"20:00"}); renderSetup(); });
  $("#btnSave").onclick = async ()=>{
    collectTemplate();
    profile.body.weightKg = Number($("#bW").value)||profile.body.weightKg; profile.body.heightCm = Number($("#bH").value)||profile.body.heightCm; profile.body.maxHr = Number($("#bHr").value)||profile.body.maxHr;
    profile.proteinTarget = Number($("#bP").value)||150; profile.wake = $("#sWake").value||profile.wake; profile.coffeeCutoff = $("#sCof").value||profile.coffeeCutoff;
    profile.sleepNeed = Number($("#sNeed").value)||465; profile.prepMin = Number($("#sPrep").value)||60; profile.blockStart = $("#sStart").value||profile.blockStart; profile.birthYear = Number($("#bYear").value)||null;
    const cals = $("#calIds").value.split(/\s+/).filter(Boolean), calChanged = cals.join()!==profile.calendars.join(); profile.calendars = cals;
    document.querySelectorAll("[data-tg]").forEach(i=>{ const m=METRICS.find(x=>x.k===i.dataset.tg); profile.targets[m.k] = m.lower? i.value.trim() : Number(i.value); });
    planCache.clear(); await saveDoc("profile", profile); writeSchedule(true); $("#saveMsg").textContent = "Saved";
    if(calChanged){ calEvents = {}; startCalendar(); }
  };
}
function collectTemplate(){ document.querySelectorAll("#v-setup [data-f]").forEach(inp=>{ const r = profile.week[inp.dataset.d]?.[Number(inp.dataset.i)]; if(r) r[inp.dataset.f] = inp.value; }); }
function sleepChart(nights){
  const W=620,H=250,L=44,R=10,T=12,B=28; const y0=20*60, y1=35*60; // 20:00 to 11:00 next day
  const y = m => T + (m - y0)/(y1-y0)*(H-T-B);
  const n = nights.length, bw = Math.max(4, Math.min(14, (W-L-R)/n - 4)), x = i => L + (i+0.5)*(W-L-R)/n;
  let g = "";
  for(let t=y0;t<=y1;t+=180){ g += `<line x1="${L}" x2="${W-R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${y(t)+4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${fmt(t)}</text>`; }
  const wa = toMin(profile.wake)+1440;
  g += `<line x1="${L}" x2="${W-R}" y1="${y(wa)}" y2="${y(wa)}" stroke="var(--ink-2)" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${W-R}" y="${y(wa)-5}" text-anchor="end" font-size="11" fill="var(--ink-2)">wake anchor</text>`;
  const bars = nights.map(([k,v],i)=>{ let on=v.onset, wk=v.wakeAt+1440; if(on<720) on+=1440; on=Math.max(on,y0); wk=Math.min(wk,y1);
    return `<rect data-night="${k}" style="cursor:pointer" data-tip="${esc(fromKey(k).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}))}: ${fmt(v.onset)} to ${fmt(v.wakeAt)} · ${dur(v.sleepMin||0)}" x="${x(i)-bw/2}" y="${y(on)}" width="${bw}" height="${Math.max(2,y(wk)-y(on))}" rx="3" fill="var(--sleep)"/>`; }).join("");
  const lbl = nights.map(([k],i)=> (i%Math.ceil(n/6)===0||i===n-1)?`<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="var(--mono)">${fromKey(k).getDate()}.${fromKey(k).getMonth()+1}</text>`:"").join("");
  return `<div class="chart" data-chart><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sleep windows for the last ${n} nights">${g}${bars}${lbl}</svg><div class="tip" hidden></div></div><p class="small muted">Each bar is one night, from falling asleep (top) to waking (bottom). Tap a bar for details.</p>`;
}
const ZC = ["#5B6B7A","#3FA9FF","#2EE59D","#FFD23F","#FF5A52"];
// a watch workout that matches the planned session ticks it off completely (all sets), once per workout
function autoTick(w){
  const ty = typeKey(wType(w)); if(ty==="walk") return false;
  const def = defForKey(w.date); if(!def) return false;
  const fits = def.type==="run" ? ty==="run" : def.type==="strength" ? ty!=="run" : true;
  if(!fits) return false;
  const L = logData.days[w.date] = logData.days[w.date]||{}; L.auto = L.auto||{};
  const key = `${w.date} ${w.start}`; if(L.auto[key]) return false; L.auto[key] = true;
  // only training blocks: meals such as "Break the fast" stay for you to tick
  L.sets = L.sets||{}; def.blocks.forEach((b,bi)=>{ if(/break the fast|protein|meal|essen|mahlzeit/i.test(b.n+" "+b.d) && !/warm|cool|min easy|×/i.test(b.n)) return; for(let i=0;i<b.s;i++) L.sets[`${def.sessionKey}:${bi}:${i}`] = true; });
  L.done = L.done||{}; L.done[def.sessionKey] = true; L.autoDone = true; L.doneAt = L.doneAt || Date.now();
  return true;
}
function reconcileTicks(){ let ch = false;
  // one time: undo meal ticks that the first auto tick version set (e.g. "Break the fast")
  if(!logData.migrMeal){ logData.migrMeal = true; ch = true; for(const [k,L] of Object.entries(logData.days||{})){ if(!L.autoDone || !L.sets) continue; const def = defForKey(k); if(!def) continue; def.blocks.forEach((b,bi)=>{ if(/break the fast/i.test(b.n)) for(let i=0;i<b.s;i++) delete L.sets[`${def.sessionKey}:${bi}:${i}`]; }); } } const since = dateKey(addDays(new Date(),-3)); for(const w of health.workouts||[]) if(w.date>=since && autoTick(w)) ch = true; return ch; }
function mergeWatchWorkouts(list){
  let n = 0; health.workouts = health.workouts||[];
  for(const w of list){
    const i = health.workouts.findIndex(x=>x.date===w.date && x.start===w.start);
    if(i>=0 && health.workouts[i].manual) continue; // corrected by Oti (e.g. from Zepp): never overwrite
    if(i>=0) health.workouts[i] = {...health.workouts[i], ...w}; else { health.workouts.push(w); n++; }
    autoTick(w);
  }
  health.workouts.sort((a,b)=>(a.date+(a.start||""))<(b.date+(b.start||""))?-1:1);
  if(list.length) saveDoc("log", logData);
  return n;
}
const WTYPES = ["Run","Soccer","Pickleball","Volleyball","Strength","Hike","Other"];
function wType(w){ return logData.wtypes?.[w.date+" "+w.start] || w.type; }
function typeKey(t){ t = String(t||"").toLowerCase();
  if(/run|lauf|interval|hill|tempo|5k|10k|sprint/.test(t)) return "run";
  if(/strength|kraft/.test(t)) return "lift";
  if(/soccer|football|fu(ß|ss)ball|pickle|volley|sport/.test(t)) return "sport";
  if(/hike|walk|wander/.test(t)) return "walk";
  return "other"; }
const TICON = {
  run:'<path d="M13 4.5a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0"/><path d="M7 21l3-5 3 2 1-6 3 3h3"/><path d="M8 11l3-3 3 1"/>',
  lift:'<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  sport:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.5 2.5-1.3 4h-4.4l-1.3-4z"/>',
  walk:'<path d="M3 20l6-9 4 5 3-3 5 7z"/>',
  other:'<path d="M3 12h4l2-5 4 10 2-5h6"/>' };
function tbadge(t, size){ const k = typeKey(t); return `<span class="tb ty-${k} ${size||""}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TICON[k]}</svg></span>`; }
function zbar(w){ if(!w?.zones) return ""; const tot = w.zones.reduce((a,b)=>a+b,0)||1; return `<div class="zb" role="img" aria-label="Heart rate zones ${w.zones.map((z,i)=>`Z${i+1} ${z}%`).join(", ")}">${w.zones.map((z,i)=>z?`<i style="width:${z/tot*100}%;background:${ZC[i]}"></i>`:"").join("")}</div>`; }
function wrow(w, attr){ return `<button type="button" class="wrow ty-${typeKey(wType(w))}" ${attr}>${tbadge(wType(w))}<span class="t">${esc(wType(w))}</span><span class="m">${fromKey(w.date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})} · ${w.start||""}</span><span class="v"><span class="vs">${w.min} min${w.km?`<small>${w.km.toFixed(1)} km</small>`:""}</span></span>${zbar(w)}</button>`; }
const ZLEGEND = `<div class="zlegend">${["Z1","Z2","Z3","Z4","Z5"].map((z,i)=>`<span><i style="background:${ZC[i]}"></i>${z}</span>`).join("")}</div>`;

function workoutsFor(k){ return (health.workouts||[]).filter(w=>w.date===k && w.type!=="Walk"); }
function wkLine(w){ return [w.start, `${w.min} min`, w.km?`${w.km.toFixed(2)} km`:"", w.pace?`${w.pace}/km`:"", w.hrAvg?`♥ ${w.hrAvg}/${w.hrMax}`:"", w.kcal?`${w.kcal} kcal`:""].filter(Boolean).join(" · "); }
function workoutsHtml(){
  const all = (health.workouts||[]).filter(w=>w.type!=="Walk").slice().sort((a,b)=>(a.date+(a.start||""))<(b.date+(b.start||""))?1:-1);
  if(!all.length) return `<div class="card"><h3>Workouts</h3><p class="small muted">No workouts yet.</p></div>`;
  const row = (w,i)=>wrow(w, `data-wk="${i}"`);
  return `<div class="card"><div class="spread"><h3>Workouts</h3><span class="small muted">${all.length} from your watch</span></div>
    ${ZLEGEND}<div class="list">${all.slice(0,6).map(row).join("")}</div>
    ${all.length>6?`<button type="button" class="ghost" id="wkAll">Show all ${all.length}</button>`:""}</div>`;
}
function workoutsAll(){
  const all = (health.workouts||[]).filter(w=>w.type!=="Walk").slice().sort((a,b)=>(a.date+(a.start||""))<(b.date+(b.start||""))?1:-1);
  openSheet("All workouts", `${ZLEGEND}<div class="list">${all.map((w,i)=>wrow(w, `data-wka="${i}"`)).join("")}</div>`,
    body=>body.querySelectorAll("[data-wka]").forEach(b=>b.onclick=()=>workoutSheet(all[Number(b.dataset.wka)])));
}
function workoutSheet(w){
  const ty = wType(w), zl = ["Z1 under 60%","Z2 60 to 70%","Z3 70 to 80%","Z4 80 to 90%","Z5 over 90%"];
  const easyFlag = ty==="Run" && w.pace && w.hrAvg>150 && secs(w.pace) > secs(latest("t5k"))/5*1.15;
  let h = `<div class="row" style="gap:10px">${tbadge(ty,"lg")}<p class="small muted" style="flex:1">${fromKey(w.date).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}${w.start?` · ${w.start}${w.end?` to ${w.end}`:""}`:""}</p></div>${zbar(w)}
    <div class="kv"><div><b>${w.min} min</b><span>duration</span></div>${w.km?`<div><b>${w.km.toFixed(2)} km</b><span>distance</span></div>`:""}${w.pace?`<div><b>${esc(w.pace)}</b><span>pace per km</span></div>`:""}${w.hrAvg?`<div><b>${w.hrAvg}<span style="font-size:.55em"> / ${w.hrMax||"–"}</span></b><span>heart rate avg / max</span></div>`:""}<div><b style="color:var(--strain)">${Math.round(workoutLoad(w))}</b><span>load (strain points)</span></div>${w.power?`<div><b>${w.power} W</b><span>power</span></div>`:""}${w.kcal?`<div><b>${w.kcal}</b><span>kcal</span></div>`:""}</div>`;
  { // elevation: from the watch data when available (w.up / w.down), otherwise entered by hand
    const ek = `${w.date} ${w.start}`, man = logData.elev?.[ek] || {}, up = w.up ?? man.up, down = w.down ?? man.down;
    if(w.km && up!=null){ const g = gapPace(w.min*60, w.km, up, down||0);
      h += `<div class="kv"><div><b>↑ ${Math.round(up)} m</b><span>elevation gain</span></div><div><b>↓ ${Math.round(down||0)} m</b><span>elevation loss</span></div><div><b style="color:var(--run)">${pace(g)}</b><span>grade adjusted pace</span></div></div>`; }
    if(w.km && w.up==null) h += `<details class="chg"><summary class="small">${up!=null?"Change":"Add"} elevation</summary><div class="grid2" style="margin-top:8px"><label class="f" for="elUp">Gain m<input id="elUp" type="number" inputmode="numeric" min="0" max="3000" value="${man.up??""}"></label><label class="f" for="elDown">Loss m<input id="elDown" type="number" inputmode="numeric" min="0" max="3000" value="${man.down??""}"></label></div><button type="button" id="elSave" style="margin-top:8px">Save elevation</button></details>`;
  }
  if(easyFlag) h += `<div class="banner y"><b>Easy pace, hard heart rate.</b> Average ${w.hrAvg} bpm on an easy run. Easy means under 150.</div>`;
  if(w.zones) h += `<div class="eyebrow">Heart rate zones</div><div style="display:grid;gap:6px">${w.zones.map((z,i)=>`<div class="spread"><span class="small">${zl[i]}</span><span class="mono small">${z}% · ${Math.round(w.min*z/100)} min</span></div><div class="bar"><i style="width:${z}%;background:${ZC[i]}"></i></div>`).join("")}</div>`;
  if(w.splits) h += `<div class="eyebrow">Splits per km</div><div class="row" style="gap:6px">${w.splits.map((x,i)=>`<span class="chip mono">${i+1} · ${esc(x)}</span>`).join("")}</div>`;
  if(/^(Workout|Other)/.test(w.type)) h += `<label class="f" for="wselS">Workout type<select id="wselS">${WTYPES.map(t=>`<option value="${t}" ${t===ty?"selected":""}>${t}</option>`).join("")}</select></label>`;
  openSheet(ty, h, body=>{ const es = body.querySelector("#elSave"); if(es) es.onclick = async ()=>{ const u = Number(body.querySelector("#elUp").value), dn = Number(body.querySelector("#elDown").value); logData.elev = logData.elev||{}; logData.elev[`${w.date} ${w.start}`] = {up: isFinite(u)?u:0, down: isFinite(dn)?dn:0}; await saveDoc("log", logData); workoutSheet(w); };
    $("#sheetTitle").style.color = `var(--${({run:"run",lift:"lift",sport:"sport",walk:"steps"})[typeKey(ty)]||"ink"})`; const sel = body.querySelector("#wselS"); if(sel) sel.onchange = async ()=>{ logData.wtypes = logData.wtypes||{}; logData.wtypes[w.date+" "+w.start] = sel.value; $("#sheetTitle").textContent = sel.value; renderProgress(); await saveDoc("log", logData); }; });
}
function openSheet(title, body, onOpen){
  $("#sheetTitle").style.color = ""; sheetFocus = document.activeElement; $("#sheetTitle").textContent = title; $("#sheetBody").innerHTML = body; delete $("#sheetBody").dataset.tk; $("#sheet").hidden = false;
  document.body.style.overflow = "hidden"; $("#sheetClose").focus(); if(onOpen) onOpen($("#sheetBody"));
}
function closeSheet(){ $("#sheet").hidden = true; $("#sheetTitle").style.color = ""; document.body.style.overflow = ""; sheetFocus?.focus?.(); }
document.addEventListener("click", e=>{ if(e.target.id==="sheet" || e.target.id==="sheetClose") closeSheet(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !$("#sheet").hidden) closeSheet(); });
// grade adjusted pace (s per km) from total gain and loss, for the gentle grades of normal runs:
// each metre up costs about 3.5 m of flat running, each metre down gives back about 1.8 m (Minetti energy cost, linearised).
// Per km elevation from the watch would allow the full per grade curve later.
function gapPace(sec, km, up, down){ const eq = km + (3.5*up - 1.8*down)/1000; return sec / Math.max(eq, km*0.8); }
function vdotD(t, m){ const min = t/60, v = m/min; const vo = -4.6 + 0.182258*v + 0.000104*v*v; const pct = 0.8 + 0.1894393*Math.exp(-0.012778*min) + 0.2989558*Math.exp(-0.1932605*min); return vo/pct; }
// VO2max from three sources: pace vs heart rate on your runs (Swain %HRR method), the watch, and race times
function vo2Estimate(){
  const now = new Date(), since = dateKey(addDays(now,-120));
  const rhrs = [...Array(30)].map((_,i)=>health.days[dateKey(addDays(now,-i))]?.rhr).filter(Boolean), hrRest = rhrs.length? mean(rhrs) : 50, hrMax = profile.body.maxHr;
  const runs = (health.workouts||[]).filter(w=>w.date>=since && wType(w)==="Run" && w.pace && w.hrAvg && w.min>=15).map(w=>{
    const sp = secs(w.pace); if(!sp || sp>540) return null; const v = 60000/sp, hrr = (w.hrAvg-hrRest)/(hrMax-hrRest);
    if(hrr<0.6 || hrr>0.92) return null; return 3.5 + (0.2*v)/hrr; }).filter(x=>x!=null).sort((a,b)=>a-b);
  const med = a => a.length%2 ? a[(a.length-1)/2] : (a[a.length/2-1]+a[a.length/2])/2;
  const watchPts = Object.entries(health.days).filter(([k,v])=>v.vo2 && k>=dateKey(addDays(now,-60))).sort();
  const watch = watchPts.length ? watchPts[watchPts.length-1][1].vo2 : null;
  const race = Math.max(vdotD(secs(latest("t5k")),5000), latest("t10k")? vdotD(secs(latest("t10k")),10000) : 0);
  const parts = [];
  if(runs.length>=3) parts.push({k:"hr", t:"Pace vs heart rate", v:med(runs), w:.50, note:`median of ${runs.length} runs, last 4 months, resting HR ${Math.round(hrRest)}`});
  if(watch) parts.push({k:"watch", t:"Watch (Zepp)", v:watch, w:.40, note:"wrist estimates are often a few points high"});
  if(race) parts.push({k:"race", t:"Race times", v:race, w:.10, note:"a floor: your recorded races were not all out"});
  if(!parts.length) return null;
  const W = parts.reduce((n,p)=>n+p.w,0), val = parts.reduce((n,p)=>n+p.v*p.w,0)/W;
  const spread = parts.length>1 ? Math.max(...parts.map(p=>p.v)) - Math.min(...parts.map(p=>p.v)) : 6;
  return {value: Math.round(val*10)/10, lo: Math.round(val - Math.min(4, spread/3)), hi: Math.round(val + Math.min(4, spread/3)), parts, hrRest};
}
