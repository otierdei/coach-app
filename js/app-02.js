/* Oti Hybrid Coach, GitHub version. Generated from the claude.ai artifact v67 by tools/build_from_v67.py.
   db, mcp and sample are provided by api.js (Google Apps Script backend).
   The code is split into several classic scripts that share one global scope; load them in order. */
function dayItems(d){
  const k = dateKey(d.date), fast = isFast(d.date), preFast = isFast(addDays(d.date,1));
  const blocks = [], rules = [];
  for(const b of d.busy){ const kind = /deep ?work/i.test(b.t)?"focus" : /lunch|mittag|dinner|abendessen/i.test(b.t)?"meal" : "busy"; blocks.push({kind, t:b.t, s:b.s, e:b.e, src:b.src}); }
  if(d.session) blocks.push({kind:"train", t:d.session.def.name, s:d.session.start, e:d.session.end, session:d.session});
  const mb = microBreak(d); if(mb) blocks.push({kind:"move", t:mb.name, s:mb.s, e:mb.e, mb});
  rules.push({key:"sun", c:"var(--sleep)", t:d.wake.early?`Wake early for ${d.wake.reason}`:"Wake", m:d.wake.wake, why:d.wake.early?"":`Daylight within 30 min sets your body clock. Your anchor is ${profile.wake}, every day.`, whyHtml:d.wake.early?`${esc(`Daylight within 30 min sets your body clock. Earlier than your ${profile.wake} anchor because of`)} <b>${esc(d.wake.reason)}</b>.`:null});
  rules.push({key:"coffee", c:"var(--meal)", t:"Last coffee", m:toMin(profile.coffeeCutoff), why:`Caffeine has a half life of about 5 hours. You sometimes struggle to fall asleep, and coffee after ${profile.coffeeCutoff} is a likely reason.`});
  if(fast) rules.push({key:"fast", c:"var(--meal)", t:"Fast day", m:d.wake.wake+1, allDay:true, why:"Water, tea, coffee only until dinner. Walk 30 to 45 min for your steps."});
  const lm = lastMealFor(d);
  if(!d.busy.some(b=>/dinner|abendessen/i.test(b.t)) || fast || preFast) rules.push({key:"meal", c:"var(--meal)", t:fast?"Break the fast":preFast?"Last meal before the fast":"Last big meal", m:lm, why:fast?"40 g protein first, then a normal dinner.":preFast?"Big, with carbs and about 50 g protein. It has to carry you until tomorrow's dinner.":"A big meal close to bed raises night heart rate and lowers HRV. Keep about 3 hours before lights out."});
  rules.push({key:"wind", c:"var(--sleep)", t:isEveningDay(d.date)?"Phone away · Evening Rhythm":"Wind down", m:isEveningDay(d.date)?Math.min(d.bed.bed-60, toMin(habits.evening.time)):d.bed.bed-60, why:"Screens away, dim light, reading or prayer. The hour before bed decides how fast you fall asleep."});
  rules.push({key:"moon", c:"var(--sleep)", t:"Lights out", m:d.bed.bed, why:`${dur(d.bed.inBed)} in bed until ${fmt(d.bed.nextWake)}.${d.bed.late?" Later than usual because of a late event: keep tomorrow's wake time anyway.":""}`});
  return {k, blocks, rules};
}
function dayCal(d, ctx){
  const {k, blocks, rules} = dayItems(d);
  const S = Math.floor(Math.min(d.wake.wake, ...blocks.map(b=>b.s))/60)*60, E = Math.ceil(Math.max(d.bed.bed+30, ...blocks.map(b=>b.e))/60)*60;
  // hour slots; runs of 3+ empty hours collapse into one short band
  const HH = 46, GAP = 30, slots = [];
  const used = h => blocks.some(b=>b.s < h+60 && b.e > h);
  for(let h=S; h<E; h+=60){
    if(!used(h) && h!==S && h+60<E){ let j=h; while(j<E-60 && !used(j)) j+=60; if(j-h>=180){ slots.push({s:h,e:j,h:GAP,gap:true}); h=j-60; continue; } }
    slots.push({s:h,e:h+60,h:HH});
  }
  let acc = 0; for(const sl of slots){ sl.y = acc; acc += sl.h; }
  const Y = m => { const sl = slots.find(x=>m>=x.s && m<x.e) || (m<S? slots[0] : slots[slots.length-1]); const cm = clamp(m, sl.s, sl.e); return sl.y + (cm-sl.s)/(sl.e-sl.s)*sl.h; };
  let h = "";
  for(const sl of slots){
    if(sl.gap) h += `<div class="gap" style="top:${sl.y+3}px;height:${sl.h-6}px">${fmt(sl.s)} to ${fmt(sl.e)} free</div>`;
    else { h += `<i class="hr" style="top:${sl.y}px"></i><span class="hl" style="top:${sl.y}px">${fmt(sl.s)}</span>`; }
  }
  h += `<i class="hr" style="top:${acc}px"></i><span class="hl" style="top:${acc}px">${fmt(E)}</span>`;
  // lanes for overlapping blocks
  const sorted = blocks.slice().sort((a,b)=>a.s-b.s || b.e-a.e), lanes = [];
  for(const b of sorted){ let li = lanes.findIndex(end=>end<=b.s); if(li<0){ li = lanes.length; lanes.push(0); } lanes[li] = b.e; b.lane = li; }
  for(const b of sorted){ const over = sorted.filter(o=>o.s<b.e && o.e>b.s); b.cols = Math.max(...over.map(o=>o.lane))+1; }
  sorted.forEach((b,i)=>{
    const id = `${k}:b${i}`; CAL_ITEMS[id] = {...b, day:d, ctx};
    const top = Y(b.s), ht = Math.max(24, Y(b.e)-top-2), w = 100/b.cols;
    const tcls = b.kind==="train" ? ` ty-${typeKey(b.session.def.type)}` : "";
    h += `<button type="button" class="cblk k-${b.kind}${tcls}" data-cb="${id}" style="top:${top+1}px;height:${ht}px;left:calc(48px + (100% - 48px) * ${b.lane*w/100});width:calc((100% - 48px) * ${w/100} - 3px)"><span class="ct">${esc(b.t)}</span>${ht>=38?`<span class="cm">${fmt(b.s)} to ${fmt(b.e)}</span>`:""}</button>`;
  });
  rules.filter(r=>!r.allDay).forEach((r,i)=>{ const id = `${k}:r${i}`; CAL_ITEMS[id] = {...r, rule:true, day:d, ctx}; const y = Y(r.m);
    h += `<i class="ml" style="--c:${r.c};top:${y}px"></i><button type="button" class="mk" data-cb="${id}" style="--c:${r.c};top:${y}px" aria-label="${esc(r.t)} ${fmt(r.m)}"></button>`; });
  if(k===dateKey(new Date())){ const n = new Date(), nm = n.getHours()*60+n.getMinutes(); if(nm>=S && nm<=E) h += `<i class="nowl" style="top:${Y(nm)}px"></i>`; }
  const chips = rules.map((r,i)=>{ const id = `${k}:c${i}`; CAL_ITEMS[id] = {...r, rule:true, day:d, ctx}; return `<button type="button" class="rule" data-cb="${id}" style="--c:${r.c}">${ricon(r.key)}<span>${esc(r.t)}</span>${r.allDay?"":`<span class="rt">${fmt(r.m)}</span>`}</button>`; }).join("");
  return `<div class="rules">${chips}</div><div class="dcal" style="height:${acc+8}px">${h}</div>`;
}
function mbBody(d, mb){
  const k = dateKey(d.date), done = !!logData.days[k]?.mb;
  return `<div class="banner"><b>${esc(mb.reps)} ${esc(mb.name)}</b>${mb.why?` · ${esc(mb.why)}`:""}</div><p class="small muted">About half of your maximum, so you get stronger without tiring the planned session.</p>`;
}
function openCalItem(id){
  const it = CAL_ITEMS[id]; if(!it) return;
  const d = it.day, back = it.ctx==="week" ? `<button type="button" class="ghost" data-dayback="${dateKey(d.date)}">‹ Back to the day</button>` : "";
  let body = "";
  if(it.rule){
    body = `<div class="row" style="gap:12px;flex-wrap:nowrap"><span class="tb lg" style="--c:${it.c}">${ricon(it.key)}</span><div><div class="mono" style="font-size:22px;font-weight:600">${it.allDay?tr("all day"):fmt(it.m)}</div><div class="small muted">${d.date.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div></div></div><p>${it.whyHtml || esc(it.why)}</p>`;
    openSheet(it.t, body+back); return;
  }
  const len = it.e - it.s;
  body = `<p class="small muted">${d.date.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</p>
    <div class="kv"><div><b>${fmt(it.s)}</b><span>start</span></div><div><b>${fmt(it.e)}</b><span>end</span></div><div><b>${dur(len)}</b><span>duration</span></div></div>`;
  if(it.kind==="move"){ openSheet(tr("Movement break"), body + mbBody(d, it.mb) + back); return; }
  if(it.kind==="train"){
    const s = it.session, def = s.def;
    body = `<div class="row" style="gap:12px;flex-wrap:nowrap">${tbadge(def.type,"lg")}<div>${def.sub?`<div class="small muted">${esc(def.sub)}</div>`:""}${s.moved?`<div class="small muted">moved from ${esc(s.fromDay)}</div>`:""}</div></div>` + body;
    body += `<div class="eyebrow">Sets</div><div class="ilist">${def.blocks.map(b=>`<div class="it"><b>${esc(b.n)}${b.s>1?`<span class="muted" style="font-weight:500"> · ${b.s} sets</span>`:""}</b><span>${esc(b.d)}</span></div>`).join("")}</div>`;
    if(it.ctx!=="week" && dateKey(d.date)===dateKey(new Date())) body += `<button type="button" class="primary" data-gotrain="1">Open today's training</button>`;
  } else {
    const src = it.src==="tmpl" ? "Weekly template (Setup)" : "Google Calendar";
    body += `<div class="spread"><span class="small muted">Source</span><span class="small">${src}</span></div>`;
    if(d.session){ const a = d.session.start - it.e, b = it.s - d.session.end;
      if(a>=0) body += `<div class="banner ${a<20?"y":""}">${a<20?"<b>Tight.</b> ":""}${dur(a)} until training at ${fmt(d.session.start)}.</div>`;
      else if(b>=0) body += `<div class="banner">${dur(b)} after training.</div>`; }
    if(it.kind==="focus") body += `<p class="small muted">Deep work: phone away, one task. Training sits after it on purpose, not before.</p>`;
  }
  openSheet(it.t, body+back, bd=>{ if(it.kind==="train"){ $("#sheetTitle").style.color = `var(--${({run:"run",lift:"lift",sport:"sport",walk:"steps"})[typeKey(it.session.def.type)]||"ink"})`; } });
}
function openDaySheet(k){
  const d = dayFromPlan(fromKey(k)); if(!d) return;
  openSheet(d.date.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}), `${allDayFor(d.date).length?`<div class="small muted">All day: ${allDayFor(d.date).map(esc).join(", ")}</div>`:""}${dayCal(d,"week")}`);
}
document.addEventListener("click", e=>{
  const cb = e.target.closest?.("[data-cb]"); if(cb){ openCalItem(cb.dataset.cb); return; }
  const db = e.target.closest?.("[data-daycal]"); if(db){ openDaySheet(db.dataset.daycal); return; }
  const bk = e.target.closest?.("[data-dayback]"); if(bk){ openDaySheet(bk.dataset.dayback); return; }
  // whole day card on the Week tab opens the day calendar (workout details and checkboxes keep their own taps)
  const wd = e.target.closest?.("[data-wday]"); if(wd && !e.target.closest("details,button,a,input,label,select,textarea")){ openDaySheet(wd.dataset.wday); return; }
  if(e.target.closest?.("[data-gotrain]")){ closeSheet(); if(tab!=="today") switchTab("today"); openTraining(); }
});
/* ================= movement breaks: middle of the longest deep work block, Mon Wed Thu Fri ================= */
// muscle groups a session loads: strength A = pull + legs, strength B = push, runs and football = legs
function loadsOf(def){
  if(!def) return {};
  if(def.sessionKey==="strengthA") return {pull:3, legs:3};
  if(def.sessionKey==="strengthB") return {push:3, pull:1};
  if(def.sessionKey==="strengthAB") return {pull:3, push:3, legs:1.5};
  if(def.type==="sport") return {legs:3};
  if(def.type==="run") return {legs: def.hard ? 3 : 1.5};
  return {};
}
const MB_EX = {
  push: {n:"Push ups", reps:()=>`2 × ${Math.max(8, Math.round((Number(latest("pushups"))||35)*0.4))}`},
  pull: {n:"Pull ups", reps:()=>`2 × ${Math.max(2, Math.round((Number(latest("pullups"))||7)*0.4))}`},
  legs: {n:"Bulgarian split squats", reps:()=>`2 × 8 per leg`}
};
const MOB_ROUTINE = "10 cat cow, 3 world's greatest stretch per side, 60 s deep squat hold, 5 hip 90/90 switches per side, 10 shoulder circles with a towel";
function microBreak(d){
  if(![1,3,4,5].includes(d.date.getDay())) return null;
  const restDay = (profile.overrides||{})[dateKey(d.date)]?.key==="rest";
  const dw = d.busy.filter(b=>/deep ?work/i.test(b.t)).sort((a,b)=>(b.e-b.s)-(a.e-a.s))[0];
  if(!dw || dw.e - dw.s < 60) return null;
  const mid = Math.round((dw.s + (dw.e-dw.s)/2)/5)*5;
  const today = loadsOf(d.session?.def), prev = loadsOf(dayFromPlan(addDays(d.date,-1))?.session?.def), next = loadsOf(dayFromPlan(addDays(d.date,1))?.session?.def);
  const score = g => (today[g]||0)*1.2 + (prev[g]||0)*0.8 + (next[g]||0)*0.5;
  // tie break: the group used least in the last movement breaks
  const recent = [1,2,3,4,5,6].map(i=>logData.days[dateKey(addDays(d.date,-i))]?.mbEx).filter(Boolean);
  const g = ["push","pull","legs"].sort((a,b)=>score(a)-score(b) || recent.filter(x=>x===a).length - recent.filter(x=>x===b).length)[0];
  const why = today[g] ? "" : ({push:"Chest and arms are free today.", pull:"Your back is free today.", legs:"Your legs are free today."})[g] + (d.session ? " The planned session loads other muscles." : "");
  // red recovery: only mobility, with the exact routine; a rest day otherwise keeps the light dose (about 40% of your max)
  let red = false; try{ red = recovery(d.date).level === "r"; }catch(e){}
  if(red) return {s:mid-5, e:mid+5, g:"mob", name:"Mobility", reps:"5 min:", why:MOB_ROUTINE + ". Recovery is red, so no strength work."};
  return {s:mid-5, e:mid+5, g, name:MB_EX[g].n, reps:MB_EX[g].reps(), why: restDay ? "Rest day, light dose: about 40% of your max, slow and clean. It does not cost recovery." : why};
}
function weekCounts(monday){
  const P = weekPlan(monday); let planned = 0, done = 0;
  for(const d of P.days) if(d.session){ planned++; if(isDone(dateKey(d.date), d.session.def)) done++; }
  return {planned, done};
}

/* ================= strain (0 to 21, Whoop style) ================= */
// cardio load = minutes in each HR zone weighted 1..5 (Edwards TRIMP), plus steps; strain = 21 * (1 - e^(-load/150))
const STRAIN_K = 150;
function workoutLoad(w){
  if(w.zones && w.min) return w.zones.reduce((n,p,i)=>n + w.min*p/100*(i+1), 0);
  if(w.hrAvg && w.min){ const z = clamp(Math.floor((w.hrAvg/profile.body.maxHr - 0.5)*10), 0, 4); return w.min*(z+1); }
  return w.min ? w.min*2 : 0;
}
// heart rate effort outside watch workouts (drumming lessons, carrying, stairs): minutes above 115 bpm (zone 2+)
// from the all day heart rate, minus the zone 2+ minutes of that day's watch workouts
function offWorkoutMin(k){ const m = health.days[k]?.paiMin; if(!m) return 0; const inW = workoutsFor(k).reduce((n,w)=>n + (w.zones? w.min*(100-w.zones[0])/100 : 0), 0); return Math.max(0, (m[1]||0) + (m[2]||0) - inW); }
function offWorkoutLoad(k){ return offWorkoutMin(k) * 2.2; }
function strainOf(load){ return Math.round(21*(1-Math.exp(-Math.max(0,load)/STRAIN_K))*10)/10; }
function dayLoad(k){
  const ws = workoutsFor(k); let load = ws.reduce((n,w)=>n+workoutLoad(w), 0);
  if(!ws.length){ const d = defForKey(k); if(d){ const done = doneCount(k,d); if(done) load += d.type==="strength" ? done*3.5 : expectedLoad(d)*done/d.total; } }
  const st = health.days[k]?.steps; if(st) load += Math.min(40, st/1000*3);
  load += offWorkoutLoad(k);
  return load;
}
function strainFor(k){ const hasData = workoutsFor(k).length || health.days[k]?.steps!=null || health.days[k]?.paiMin || (logData.days[k]?.sets && Object.keys(logData.days[k].sets).length); return hasData ? strainOf(dayLoad(k)) : null; }
function expectedLoad(def){
  if(!def) return 0;
  if(def.type==="sport") return 260;
  if(def.type==="strength") return def.total*3.5;
  if(def.sessionKey==="intervals") return def.name==="Intervals" ? 150 : def.name.includes("10k") ? 230 : 170;
  const easyMin = def.blocks.filter(b=>/min easy/.test(b.n)).reduce((n,b)=>n+parseInt(b.n),0), tempo = def.blocks.filter(b=>/tempo/.test(b.n)).reduce((n,b)=>n+parseInt(b.n),0);
  const sprints = def.blocks.some(b=>/sprint/.test(b.n)) ? 12 : 0;
  return easyMin*2.3 + tempo*4 + sprints;
}
const STRAIN_TARGET = {g:[14,18], y:[10,14], r:[4,9], none:[8,12]};
function strainTarget(level){ return STRAIN_TARGET[level] || STRAIN_TARGET.none; }

/* ================= Oti Age (habit based, Whoop Age style) ================= */
// Not a measurement: habits mapped to published risk associations, expressed in years vs. your real age.
function ageInputs(days){
  const now = new Date(), keys = [...Array(days)].map((_,i)=>dateKey(addDays(now,-(i+1))));
  const H = keys.map(k=>health.days[k]).filter(Boolean);
  const vals = f => H.map(h=>h[f]).filter(x=>x!=null);
  const wakeSd = sd(vals("wakeAt")), onsetSd = sd(vals("onset").map(x=>x<720?x+1440:x));
  const wos = (health.workouts||[]).filter(w=>keys.includes(w.date) && w.type!=="Walk");
  const weeks = Math.max(1, days/7);
  const z2 = wos.reduce((n,w)=>n + (w.zones? w.min*(w.zones[1]+w.zones[2]+w.zones[3]+w.zones[4])/100 : (w.hrAvg && w.hrAvg>=0.6*profile.body.maxHr ? w.min : 0)), 0)/weeks;
  const vig = wos.reduce((n,w)=>n + (w.zones? w.min*(w.zones[3]+w.zones[4])/100 : 0), 0)/weeks;
  const strengthDays = new Set([...keys.filter(k=>{ const d = logData.days[k]?.done||{}; return d.strengthA || d.strengthB || d.strengthAB; }), ...wos.filter(w=>/strength/i.test(wType(w))).map(w=>w.date)]).size;
  return {n:H.length, sleep:mean(vals("sleepMin")), sleepSd: wakeSd!=null && onsetSd!=null ? (wakeSd+onsetSd)/2 : (wakeSd ?? onsetSd), rhr:mean(vals("rhr")), steps:mean(vals("steps")), z2, vig, strength:strengthDays/weeks, vo2: vo2Estimate()?.value ?? vdot(secs(latest("t5k")))};
}
function ageContrib(I){
  const c = [], add = (k, t, v, d, tip) => c.push({k, t, v, d: Math.round(clamp(d.val, d.lo, d.hi)*10)/10, tip});
  add("vo2","Fitness (VO2max, blended estimate)", I.vo2? `${I.vo2.toFixed(0)} ml/kg/min` : "–", {val: I.vo2? -(I.vo2-42)/3.5*0.9 : 0, lo:-4, hi:4}, "Cardiorespiratory fitness is the strongest single predictor in large cohort studies. 42 is roughly average for your age.");
  if(I.rhr) add("rhr","Resting heart rate", `${Math.round(I.rhr)} bpm`, {val:(I.rhr-60)*0.1, lo:-2, hi:3}, "Lower resting heart rate goes with lower cardiovascular risk.");
  if(I.steps!=null) add("steps","Steps per day", `${Math.round(I.steps).toLocaleString("de-DE")}`, {val: I.steps<8000 ? (8000-I.steps)/1000*0.4 : -Math.min(1,(I.steps-8000)/4000), lo:-1, hi:3}, "Benefits rise steeply up to about 8,000 steps a day and flatten after 10,000.");
  if(I.sleep) add("sleep","Sleep duration", dur(I.sleep), {val: I.sleep<420 ? (420-I.sleep)/60*1.0 : I.sleep>540 ? (I.sleep-540)/60*0.5 : -0.3, lo:-0.5, hi:3}, "7 to 9 hours is the low risk band. Every hour below 7 counts.");
  if(I.sleepSd!=null) add("regular","Sleep regularity", `±${Math.round(I.sleepSd)} min`, {val:(I.sleepSd-45)/30*0.8, lo:-1, hi:2.5}, "How much your bed and wake times swing. Regular sleep predicts health outcomes even better than duration.");
  add("z2","Cardio minutes per week (zone 2+)", `${Math.round(I.z2)} min`, {val: I.z2<150 ? (150-I.z2)/150*1.5 : -Math.min(1.5,(I.z2-150)/150), lo:-1.5, hi:1.5}, "Guideline: at least 150 min moderate activity per week.");
  add("vig","Hard minutes per week (zone 4+)", `${Math.round(I.vig)} min`, {val: -Math.min(0.8, I.vig/75*0.8), lo:-0.8, hi:0}, "Vigorous minutes count about double.");
  add("strength","Strength sessions per week", I.strength.toFixed(1), {val: I.strength>=2 ? -0.8 : I.strength>=1 ? -0.3 : 0.5, lo:-0.8, hi:0.5}, "Two sessions a week is the guideline and lowers risk independently of cardio.");
  return c;
}
function otiAge(){
  const Ia = ageInputs(180), Ir = ageInputs(30), Ip = ageInputs(60);
  if(Ia.n < 30) return null;
  const ca = ageContrib(Ia), sum = a => a.reduce((n,x)=>n+x.d,0);
  const dAll = sum(ca), d30 = sum(ageContrib(Ir));
  const pace = Math.round(clamp(1 + (d30 - dAll)*0.6, -1, 3)*10)/10;
  const real = profile.birthYear ? (Date.now() - new Date(profile.birthYear, 6, 1)) / (365.25*864e5) : null;
  return {delta: Math.round(dAll*10)/10, age: real!=null ? Math.round((real + dAll)*10)/10 : null, real, pace, days: Ia.n, prelim: Ia.n < 150, contrib: ca.sort((a,b)=>Math.abs(b.d)-Math.abs(a.d))};
}
/* ================= PAI (own estimate in the spirit of Zepp's PAI) =================
   Points per workout minute by heart rate zone: Z1 0, Z2 0.3, Z3 0.6, Z4 1.0, Z5 1.4.
   Rolling 7 days, goal 100. Above 100 each extra point counts half (PAI rewards the first effort most).
   Not identical to the watch: Zepp's formula is closed and also counts all day heart rate. */
const PAI_W = [0, 0.3, 0.6, 1.0, 1.4];
function paiWorkout(w){
  if(!w.min) return 0;
  if(w.zones) return w.min * w.zones.reduce((n,z,i)=>n + z/100*PAI_W[i], 0);
  if(w.hrAvg){ const z = clamp(Math.floor((w.hrAvg/profile.body.maxHr - 0.5)*10), 0, 4); return w.min * PAI_W[z]; }
  return 0;
}
function paiDay(k){ const d = health.days[k]; return d?.pai!=null ? d.pai : workoutsFor(k).reduce((n,w)=>n + paiWorkout(w), 0); }
function paiWeek(endDate){ const days = [...Array(7)].map((_,i)=>dateKey(addDays(endDate, i-6))); const per = days.map(k=>({k, v:paiDay(k)})); const raw = per.reduce((n,x)=>n+x.v,0), fromHr = days.some(k=>health.days[k]?.pai!=null); return {days:per, raw, fromHr, value: Math.round(fromHr ? raw : (raw<=100 ? raw : 100 + (raw-100)*0.5))}; }
function paiHtml(){
  const P = paiWeek(new Date()), max = Math.max(20, ...P.days.map(d=>d.v)), lvl = P.value>=100?"g":P.value>=60?"y":"r";
  const bars = P.days.map(d=>{ const dt = fromKey(d.k); return `<div style="display:grid;gap:4px;justify-items:center"><div style="height:64px;width:100%;display:flex;align-items:flex-end"><i style="display:block;width:100%;border-radius:6px 6px 2px 2px;height:${Math.max(3, d.v/max*64)}px;background:${d.v?"var(--strain)":"var(--track)"}"></i></div><span class="small muted mono">${Math.round(d.v)}</span><span class="small muted">${SHORT[dt.getDay()]}</span></div>`; }).join("");
  return `<div class="card"><div class="spread" style="flex-wrap:nowrap"><div><div class="eyebrow">Heart health</div><h3 style="margin-top:4px">PAI</h3><p class="small muted" style="margin-top:6px">Last 7 days. Goal: stay at 100 or more.</p></div>
    ${ring(P.value/100, REC_COLOR[lvl], 92, 9, String(P.value), "of 100", 26)}</div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">${bars}</div>
    <p class="small muted">${P.value>=100 ? "At 100 or more you are in the range large studies link with clearly lower heart risk." : `${Math.max(0,100-P.value)} points missing. Easiest: one run with 20 min in zone 3 or higher.`} ${P.fromHr ? "Calculated from your all day heart rate with the thresholds of your watch (89, 115, 154 bpm). Close to the watch, not identical." : "Own estimate from your watch workouts, so it can differ from the PAI on your watch."}</p>
    ${(()=>{ const t = health.days[dateKey(new Date())]?.paiB; return t ? `<div class="kv"><div><b style="color:var(--run)">${Math.round(t[0])}</b><span>low</span></div><div><b style="color:var(--sleep)">${Math.round(t[1])}</b><span>moderate</span></div><div><b style="color:var(--rec-r)">${Math.round(t[2])}</b><span>intense</span></div></div><p class="small muted">Today so far, updated with every upload.</p>` : ""; })()}</div>`;
}
function vo2Html(){
  const E = vo2Estimate(); if(!E) return "";
  const vo = Object.entries(health.days).filter(([,v])=>v.vo2).sort().slice(-60).map(([k,v])=>[k,v.vo2]);
  return `<div class="card"><div class="spread"><div><div class="eyebrow">Fitness</div><h3 style="margin-top:4px">VO2max</h3></div>
    <div style="text-align:right"><div style="font-family:var(--display);font-size:40px;font-weight:700;line-height:1">${E.value.toFixed(0)}</div><div class="small muted mono">range ${E.lo} to ${E.hi} ml/kg/min</div></div></div>
    <div style="display:grid;gap:10px">${E.parts.map(p=>`<div class="src"><span>${esc(p.t)} <span class="muted small">· weight ${Math.round(p.w*100)}%</span></span><span class="mono">${p.v.toFixed(1)}</span>
      <div class="bar" style="grid-column:1/-1"><i style="width:${clamp((p.v-30)/35*100,2,100)}%;background:var(--strain)"></i></div><span class="w">${esc(p.note)}</span></div>`).join("")}</div>
    ${vo.length>1? lineChart(vo,"Watch VO2max","ml/kg/min","var(--strain)") : ""}
    <p class="small muted">Blended from three sources. Training paces still come from your race times on purpose: they keep your easy runs easy.</p></div>`;
}
function ageHtml(){
  const A = otiAge();
  if(!A) return `<div class="card"><h3>Oti Age</h3><p class="small muted">Needs at least 30 days of sleep, heart rate and step data.</p></div>`;
  const big = A.age!=null ? A.age.toFixed(1) : `${A.delta>0?"+":""}${A.delta.toFixed(1)}`;
  const col = A.delta<=0 ? "var(--rec-g)" : A.delta<2 ? "var(--rec-y)" : "var(--rec-r)", pc = A.pace<0.9 ? "var(--rec-g)" : A.pace<=1.1 ? "var(--rec-y)" : "var(--rec-r)";
  return `<div class="card"><div class="spread"><h3>Oti Age</h3>${A.prelim?`<span class="chip">preliminary · ${A.days}/180 days</span>`:""}</div>
    <div class="kv"><div><b style="color:${col}">${big}</b><span>${A.age!=null?`${A.delta>0?"+":""}${A.delta.toFixed(1)} vs real age`:"years vs real age"}</span></div>
      <div><b style="color:${pc}">${A.pace.toFixed(1)}×</b><span>pace of ageing, 30 days</span></div></div>
    ${A.age==null?`<p class="small muted">Add your birth year in Setup to see an age.</p>`:""}
    <div class="list">${A.contrib.map((x,i)=>`<button type="button" class="lrow" data-age="${i}"><span class="t">${esc(x.t.replace(/ \(.*\)$/,""))}</span><span class="m">${esc(x.v)}</span><span class="v" style="color:${x.d<0?"var(--rec-g)":x.d>0.2?"var(--rec-r)":"var(--muted)"}">${x.d>0?"+":""}${x.d.toFixed(1)} y</span></button>`).join("")}</div>
    <p class="small muted">Habits mapped to published risk associations. A trend, not a medical measurement.</p></div>`;
}

/* ================= journal ================= */
// asked each morning about YESTERDAY; its effect shows up in the next morning's recovery
const JOURNAL = [
  {k:"coffeeLate", t:"Coffee after 14:00"},
  {k:"lateMeal", t:"Big meal within 3 h of bed"},
  {k:"screenBed", t:"Phone or screen in bed"},
  {k:"alcohol", t:"Alcohol"},
  {k:"stress", t:"Stressful day"},
  {k:"windDown", t:"Wind down routine (reading, prayer, no screen)"},
  {k:"nap", t:"Nap during the day"}
];
const JOURNAL_AUTO = [
  {k:"fast", t:"Fast day", f:k=>isFast(fromKey(k))},
  {k:"lateNight", t:"Event until late (lights out after 23:30)", f:k=>{ const d = dayFromPlan(fromKey(k)); return !!(d?.bed.late && d.bed.bed >= 23*60+30); }},
  {k:"eveningTraining", t:"Training after 19:00", f:k=>workoutsFor(k).some(w=>toMin(w.start)>=19*60)},
  {k:"hardDay", t:"Strain 14 or more", f:k=>{ const x = strainFor(k); return x!=null && x>=14; }}
];
function journalYes(k, item){ return item.f ? item.f(k) : !!logData.days[k]?.j?.[item.k]; }
function journalAnswered(k){ return !!logData.days[k]?.j; }
function journalInsights(){
  const out = [], today = new Date();
  const keys = [...Array(90)].map((_,i)=>dateKey(addDays(today,-(i+1))));
  const rec = {}; for(const k of keys){ const nx = dateKey(addDays(fromKey(k),1)); const r = recovery(fromKey(nx)); if(r.score!=null) rec[k] = {score:r.score, sleep:sleepMinFor(nx)}; }
  for(const item of [...JOURNAL, ...JOURNAL_AUTO]){
    const yes = [], no = [];
    for(const k of keys){ if(!rec[k]) continue; if(!item.f && !journalAnswered(k)) continue; (journalYes(k,item)? yes : no).push(rec[k]); }
    const ready = yes.length>=4 && no.length>=4;
    const dR = ready ? mean(yes.map(x=>x.score)) - mean(no.map(x=>x.score)) : null;
    const sy = yes.map(x=>x.sleep).filter(Boolean), sn = no.map(x=>x.sleep).filter(Boolean);
    const dS = ready && sy.length && sn.length ? mean(sy) - mean(sn) : null;
    out.push({...item, yes:yes.length, no:no.length, ready, dR, dS});
  }
  return out.sort((a,b)=> (b.ready - a.ready) || Math.abs(b.dR||0) - Math.abs(a.dR||0));
}
function journalHtml(){
  const ins = journalInsights(), ready = ins.filter(x=>x.ready), wait = ins.filter(x=>!x.ready);
  let h = `<div class="card"><div class="spread"><h3>What moves your recovery</h3><span class="small muted">last 90 days</span></div>
    <p class="small muted">Each behaviour from the morning check in, compared with your recovery the next morning. Needs at least 4 days with and 4 without.</p>`;
  if(ready.length) h += `<div style="display:grid;gap:8px">${ready.map(x=>{ const c = Math.abs(x.dR)<3 ? "" : x.dR>0 ? "g" : "r"; const w = clamp(Math.abs(x.dR)/25*100, 4, 100);
    return `<div class="block"><div class="bh"><span class="bn">${esc(x.t)}${x.f?` <span class="chip" style="font-size:10.5px;padding:2px 8px">auto</span>`:""}</span><span class="mono small ${c==="g"?"":""}" style="color:${c==="g"?"var(--rec-g)":c==="r"?"var(--rec-r)":"var(--muted)"}">${x.dR>0?"+":""}${Math.round(x.dR)}%</span></div>
      <div class="bar"><i style="width:${w}%;background:${c==="g"?"var(--rec-g)":c==="r"?"var(--rec-r)":"var(--muted)"}"></i></div>
      <div class="bd">Recovery next morning ${x.dR>0?"higher":"lower"} by ${Math.abs(Math.round(x.dR))} points${x.dS!=null?`, sleep ${x.dS>=0?"+":"−"}${Math.abs(Math.round(x.dS))} min`:""} · ${x.yes} days yes, ${x.no} no</div></div>`; }).join("")}</div>`;
  else h += `<div class="banner">No pattern yet. Answer the journal in the morning check in for about 3 weeks.</div>`;
  if(wait.length) h += `<details><summary>Still collecting (${wait.length})</summary><div class="small muted" style="margin-top:8px;display:grid;gap:4px">${wait.map(x=>`<span>${esc(x.t)}: ${x.yes}/4 yes · ${x.no}/4 no</span>`).join("")}</div></details>`;
  return h + `</div>`;
}

/* ================= views ================= */
let openDial = null, trainOpen = false;
function openTraining(){ trainOpen = true; const v = $("#v-train"); v.hidden = false; v.scrollTop = 0; document.body.classList.add("training"); const w = $(".wrap"); if(w) w.inert = true; $("#trBack")?.focus({preventScroll:true}); }
function closeTraining(silent){ if(!trainOpen && silent) return; trainOpen = false; const v = $("#v-train"); if(v) v.hidden = true; document.body.classList.remove("training"); const w = $(".wrap"); if(w) w.inert = false; if(!silent){ window.scrollTo(0,0); $("#btnTrain")?.focus({preventScroll:true}); } }
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && trainOpen && $("#sheet")?.hidden !== false) closeTraining(); });
function tomorrowCardHtml(){
  // v68: "Tomorrow" card under "Your day": calendar, training, music, fast day, tasks due tomorrow
  const t = addDays(new Date(), 1), kt = dateKey(t), dt = dayFromPlan(t);
  if(!dt) return "";
  const s = dt.session, items = [];
  const dname = LANG==="de" ? t.toLocaleDateString("de-DE",{weekday:"long", day:"numeric", month:"long"}) : t.toLocaleDateString("en-GB",{weekday:"long", day:"numeric", month:"long"});
  if(isFast(t)) items.push(`<div class="banner"><b>${L("Fast day","Fastentag")}.</b> ${L("Water, tea, coffee only until dinner. Big dinner with carbs and protein tonight.","Nur Wasser, Tee, Kaffee bis zum Abendessen. Heute Abend großes Abendessen mit Kohlenhydraten und Eiweiß.")}</div>`);
  items.push(`<div class="spread"><span>${L("Training","Training")}</span><span>${s ? `<b>${esc(s.def.name)}</b> <span class="mono">${fmt(s.start)}</span>` : esc(dt.conflict ? L("No slot","Kein Platz") : L("Rest day","Ruhetag"))}</span></div>`);
  let mu = []; try{ mu = musicPlanned(t); }catch(e){}
  for(const m of mu) items.push(`<div class="spread"><span>${L("Music","Musik")}</span><span>${esc((KIND[m.kind]||[m.kind,m.kind])[LANG==="de"?1:0])} <span class="mono">${esc(m.time||"")}${m.min?` · ${m.min} min`:""}</span></span></div>`);
  let due = []; try{ due = tasksDoc.tasks.filter(x=>!x.done && !x.review && (x.due===kt || x.today===kt)); }catch(e){}
  const allDay = allDayFor(t);
  return `<details class="card" id="tomorrowCard"><summary>${L("Tomorrow","Morgen")}</summary>
    <div class="eyebrow">${esc(dname)}</div>
    ${allDay.length?`<div class="small muted">${L("All day","Ganztägig")}: ${allDay.map(esc).join(", ")}</div>`:""}
    <div style="display:grid;gap:6px;font-size:14px">${items.join("")}</div>
    ${due.length?`<div class="tk-subh">${L("Due tomorrow","Morgen fällig")}</div><div class="list">${due.map(x=>`<button type="button" class="lrow" data-tk-open="${esc(x.id)}" style="min-height:44px"><span class="t">${esc(x.title)}</span><span class="m">${esc(x.area||"")}${x.due===kt?` · ${L("due","fällig")}`:""}${x.today===kt?" · ★":""}</span><span class="v"></span></button>`).join("")}</div>`:`<p class="small muted">${L("Nothing due tomorrow in your tasks.","Morgen ist in deinen Aufgaben nichts fällig.")}</p>`}
    ${dayCal(dt,"tomorrow")}<span class="small muted">${calState.status==="ok"?L("Calendar + template","Kalender + Vorlage"):L("Template only","Nur Vorlage")}</span></details>`;
}
function renderToday(){
  const now = new Date(), k = dateKey(now), d = dayFromPlan(now), R = recovery(now), w = weekIndex(now), lg = logData.days[k]||{};
  const s0 = d.session, s = s0 ? {...s0, def: formDef(s0.def, formLevel(k))} : null, adj = s && !s.def.formNote && !lg.fullPlan ? adjust(s.def, R.level) : null, wc = weekCounts(mondayOf(now));
  const sm = sleepMinFor(k), loadDone = s ? doneCount(k, s.def) : 0, hk = health.days[k]||{};
  const tgt = isFast(now) ? [6,10] : strainTarget(R.level), yk = dateKey(addDays(now,-1)), yStrain = strainFor(yk), sessStrain = s ? strainOf(expectedLoad(s.def) + 25) : null;
  const ySteps = health.days[yk]?.steps ?? null, yKcal = health.days[yk]?.kcal ?? null;
  const prot = lg.protein||0, pt = profile.proteinTarget;
  const blockTxt = w<1 ? `Block 1 starts ${fromKey(profile.blockStart).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}` : w>12 ? "Block complete" : `Week ${w}/12${DELOAD(w)?" · deload":""}`;
  let html = `<div class="spread" style="padding:2px 2px 0"><div><div class="eyebrow">${DAY_NAMES[now.getDay()]} · ${now.toLocaleDateString("en-GB",{day:"numeric",month:"long"})}</div><h2>Today</h2></div><div class="row" style="gap:6px;flex-wrap:nowrap"><span class="chip">${blockTxt}</span><button type="button" class="ghost fall" id="foldAll"></button></div></div>`;
  if(calState.status==="err") html += `<div class="banner y">${esc(calState.msg)}</div>`;
  // next thing today (Oti 23.10.): one line instead of reading the day plan
  { const nm = now.getHours()*60 + now.getMinutes(), hide = typeof WK_HIDE !== "undefined" ? WK_HIDE : /lunch|dinner|mittag|abendessen/i;
    const cand = calEventsForDay(now).filter(e=>e.e > nm && !hide.test(e.t) && !/bewegungspause|movement break/i.test(e.t)).map(e=>({s:e.s, t:e.t, now:e.s<=nm}));
    if(d.session && d.session.end > nm) cand.push({s:d.session.start, t:formDef(d.session.def, formLevel(k)).name, now:d.session.start<=nm, tr:true});
    cand.sort((a,b)=>a.s-b.s); const n = cand.find(x=>!x.now) || cand[0];
    html += `<button type="button" class="nextln" data-daycal="${k}"><span class="eyebrow">${n?(n.now?L("Now","Jetzt"):L("Next","Als Nächstes")):L("Today","Heute")}</span><span class="nt">${n?`${fmt(Math.max(n.s,0))} · ${esc(n.t)}`:L("Nothing more in the calendar","Nichts mehr im Kalender")}</span><span class="small muted">${L("Day plan","Tagesplan")} ›</span></button>`; }

  // ---- hero: three dials, each explains itself on tap ----
  let why = "";
  if(openDial==="rec") why = `${R.parts.length?`<div class="row" style="gap:6px">${R.parts.map(p=>`<span class="chip ${p[0]}">${esc(p[1])}</span>`).join("")}</div>`:""}
    <p>Recovery weighs HRV against your 21 day normal (40%), resting heart rate (30%) and sleep against your 7:30 need (30%). How you feel in the check in moves it a little.${R.estimated&&R.score!=null?" Estimated: not enough HRV history yet.":""}</p>`;
  if(openDial==="strain"){ const ws = workoutsFor(yk);
    why = `<p><b>Yesterday ${yStrain!=null?yStrain.toFixed(1):"–"}</b> · target today <b>${tgt[0]} to ${tgt[1]}</b>${isFast(now)?" (fast day, capped)":""}.</p>
    ${ws.length? ws.map(x=>`<div class="row" style="gap:10px;flex-wrap:nowrap">${tbadge(wType(x),"sm")}<div style="flex:1;display:grid;gap:5px"><div class="spread"><span>${esc(wType(x))} ${x.start} · ${x.min} min</span><span class="mono small">load ${Math.round(workoutLoad(x))}</span></div>${zbar(x)}</div></div>`).join("") : `<p class="small">No watch workout yesterday.</p>`}
    ${offWorkoutMin(yk)>=5?`<div class="spread"><span>${Math.round(offWorkoutMin(yk))} min above 115 bpm outside workouts (e.g. drumming)</span><span class="mono small">load ${Math.round(offWorkoutLoad(yk))}</span></div>`:""}
    ${ySteps!=null?`<div class="spread"><span>${ySteps.toLocaleString("de-DE")} steps</span><span class="mono small">load ${Math.round(Math.min(40,ySteps/1000*3))}</span></div>`:""}
    <p class="small">Strain 0 to 21 from heart rate zones and steps. Watch workouts arrive the next morning, so this dial shows yesterday.</p>`; }
  if(openDial==="sleep") why = sm ? `<p><b>${dur(sm)}</b> asleep, ${Math.round(sm/profile.asleepNeed*100)}% of your 7:30 need.${hk.onset!=null&&hk.wakeAt!=null?` Asleep ${fmt(hk.onset)}, awake ${fmt(hk.wakeAt)}.`:""}</p><p>Tonight: last coffee ${esc(profile.coffeeCutoff)}, lights out <b>${fmt(d.bed.bed)}</b> for ${dur(d.bed.inBed)} until ${fmt(d.bed.nextWake)}.</p>` : `<p>No sleep synced for last night. Log it below so recovery isn't blind.</p>`;
  const coachLine = R.ill ? `${R.ill.text}. Keep today very easy.` : R.score==null ? "No data for last night yet. Do the check in below." :
    isFast(now) ? `Fast day. Keep strain between ${tgt[0]} and ${tgt[1]}.` : `${({g:"Green. Your body can take load.",y:"Yellow. Train, but hold something back.",r:"Red. Recovery beats training today."})[R.level]} Strain target ${tgt[0]} to ${tgt[1]}.`;
  // ---- week strip (MCI style): tap a day for its calendar ----
  { const mon = mondayOf(now), P = weekPlan(mon);
    html += `<div class="wkstrip" role="group" aria-label="${L("This week","Diese Woche")}">${P.days.map(x=>`<span class="wd ${dateKey(x.date)===k?"now":""}">${SHORT[x.date.getDay()]}</span>`).join("")}
      ${P.days.map(x=>{ const xk = dateKey(x.date), def = x.session?.def, dn = def && isDone(xk, def);
        return `<button type="button" class="dy ${xk<k?"past":""} ${xk===k?"now":""} ${def?"tr":""} ${dn?"done":""}" data-daycal="${xk}" aria-label="${esc(x.date.toLocaleDateString(L("en-GB","de-DE"),{weekday:"long",day:"numeric",month:"long"}))}${def?` · ${esc(def.name)}`:""}"><b>${x.date.getDate()}</b><i></i></button>`; }).join("")}</div>`; }
  // ---- body today: four tiles, tap one for the why ----
  const st0 = stagesOf(health.days[k]);
  // rings like MCI (Oti 23.10.: circles, not bars); one ink colour, rust only for red recovery
  const tile = (id, title, pct, col, val, sub, extra) => `<button type="button" class="btile" data-dial="${id}" aria-expanded="${openDial===id}" aria-controls="why"><span class="bt">${title}</span><div class="rrow">${ring(pct, col, 76, 8, val, "", 19)}</div>${extra||""}<span class="bs">${sub}</span></button>`;
  const bsum = [R.score!=null?`${L("Recovery","Erholung")} ${R.score}%`:"", sm?`${L("Sleep","Schlaf")} ${Math.floor(sm/60)}:${pad(Math.round(sm%60))}`:"", yStrain!=null?`Strain ${yStrain.toFixed(1)}`:"", `Protein ${prot}/${pt} g`].filter(Boolean).join(" · ");
  html += `<section class="fsec" data-fold="body" data-ftitle="${L("Body today","Körper heute")}" data-fsum="${esc(bsum)}"><div class="spread"><span class="sec">${L("Body today","Körper heute")}</span><span class="small muted">${wc.done}/${wc.planned} ${L("sessions this week","Einheiten diese Woche")}</span></div>
  <div class="btiles">
    ${tile("rec", L("Recovery","Erholung"), R.score==null?0:R.score/100, REC_COLOR[R.level]||"var(--muted)", R.score==null?"–":`${R.score}<span style="font-size:.55em">%</span>`, R.score==null? L("check in below","Check in unten") : ({g:L("Green · train as planned","Grün · wie geplant"),y:L("Yellow · hold back a little","Gelb · etwas zurückhalten"),r:L("Red · recover","Rot · erholen")})[R.level]||"")}
    ${tile("sleep", L("Sleep","Schlaf"), sm?sm/profile.asleepNeed:0, "var(--sleep)", sm?`${Math.floor(sm/60)}:${pad(Math.round(sm%60))}`:"–", st0?`Deep ${dur(st0.deep)} · REM ${dur(st0.rem)}`:L("no stages yet","noch keine Phasen"), stageBar(st0))}
    ${tile("strain", L("Strain yesterday","Strain gestern"), yStrain!=null? yStrain/21 : 0, "var(--strain)", yStrain!=null?yStrain.toFixed(1):"–", `${L("target today","Ziel heute")} ${tgt[0]} ${L("to","bis")} ${tgt[1]}${ySteps!=null?` · ${(ySteps/1000).toFixed(1)}k ${L("steps","Schritte")}`:""}`)}
    <div class="btile"><span class="bt">${L("Protein","Protein")}</span><div class="rrow">${ring(prot/pt, "var(--protein)", 76, 8, `${prot}`, "", 19)}<span class="bs">/ ${pt} g</span></div>
      <div class="grid2" style="gap:6px">${[20,30,40].map(g=>`<button class="ghost" data-prot="${g}" style="min-height:34px;padding:4px 0;font-size:12px">+${g} g</button>`).join("")}<button class="ghost" data-prot="-10" aria-label="Remove 10 g" style="min-height:34px;padding:4px 0;font-size:12px">−10</button></div></div>
  </div>
  <div class="why" id="why" ${openDial?"":"hidden"}>${why}</div>
  <p class="small muted" style="padding:0 4px">${esc(coachLine)}</p></section>`;
  // ---- morning briefing, read aloud on tap ----
  if(briefing && briefing.date===k){
    const lines = (briefing.lines && briefing.lines.length ? briefing.lines : String(briefing.text||"").split(/\n+/)).filter(Boolean);
    html += `<div class="card brief" data-fold="brief" data-ftitle="${L("Morning briefing","Morgenbriefing")}" data-fsum=""><div class="spread" style="flex-wrap:nowrap"><button type="button" class="btxt" id="briefTxt" aria-expanded="false" aria-controls="briefBody"><span class="eyebrow">Morning briefing${briefing.time?` · ${esc(briefing.time)}`:""}</span><span class="small">${L("Show text","Text zeigen")} ›</span></button>
      <button type="button" id="btnSpeak" class="primary play" aria-label="Read the briefing aloud">▶ Play</button></div>
      <div id="briefBody" hidden><div class="lines" data-notr style="margin-top:4px">${lines.map(x=>`<p>${esc(x.replace(/\[(Certain|Likely|Guessing)\]\s*/gi,""))}</p>`).join("")}</div>
      <label class="f" style="grid-template-columns:auto 1fr;align-items:center;gap:8px">Voice<select id="voiceSel" aria-label="Briefing voice"></select></label></div></div>`;
  }
  // ---- today's training: one hero card, the session itself opens full screen ----
  const exN = s ? s.def.blocks.filter(b=>!b.skip).length : 0, done0 = s && isDone(k, s.def);
  // same order as the banners in the training view, so both screens give the same advice
  const heroNote = !s ? "" : (R.ill && s.def.hard) ? `<b>${esc(R.ill.text)}.</b> Swap today's hard session for 30 min very easy or a walk.`
    : isFast(now) ? `<b>Fast day.</b> Truly easy, HR under 145.` : (R.level==="y" && isFast(addDays(now,-1))) ? `<b>Yellow after a fast day is expected.</b> Train as planned, eat before the session.`
    : s.def.formNote ? `<b>${esc(s.def.formNote)}</b>` : adj ? `<b>${esc(adj.t)}.</b> ${esc(adj.lines[0]||"")}` : (lg.fullPlan && (R.level==="y"||R.level==="r")) ? `<b>Full plan today, your choice.</b>` : "";
  const chgBtn = `<button type="button" class="ghost" id="btnTrain">${L("Change today's training","Training heute ändern")}</button>`;
  // fold (Oti 23.10.): the card can shrink to one line; remembered for the day on this device
  const folded = foldGet("train");
  html += `<div class="card thero ${folded?"folded":""} ${s?`ty-${typeKey(s.def.type)}`:""}">
    <button type="button" class="tfold" id="tFold" aria-expanded="${!folded}" aria-label="${folded?L("Show workout","Workout zeigen"):L("Fold workout","Workout zuklappen")}"><span class="tfl">${s? `${esc(s.def.name)} · ${fmt(s.start)} · ${loadDone}/${s.def.total}` : esc(d.conflict? L("No slot today","Heute kein Platz") : L("Rest day","Ruhetag"))}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
    <div class="spread tfull" style="flex-wrap:nowrap"><span class="eyebrow">${s?`${esc(s.def.type==="strength"?L("Strength","Kraft"):s.def.type==="run"?L("Run","Lauf"):s.def.type)} · ${fmt(s.start)} to ${fmt(s.end)}`:L("Today's training","Training heute")}</span>${s?`<span class="small">${L("Strain","Strain")} ≈ ${sessStrain.toFixed(0)}</span>`:""}</div>
    <div class="tfull"><h2>${s? esc(s.def.name) : d.conflict? L("No slot today","Heute kein Platz") : L("Rest day","Ruhetag")}</h2>${s?.def.sub?`<div class="small">${esc(s.def.sub)}${s.moved?` · moved from ${s.fromDay}`:""}${s.override?` · ${L("your change","deine Änderung")}`:""}</div>`:""}</div>
    <div class="tfull tbody">${s?`<div class="tnums"><div><b>${Math.round(s.end - s.start)}</b><span>${L("minutes","Minuten")}</span></div><div><b>${exN}</b><span>${L("exercises","Übungen")}</span></div><div><b>${loadDone}/${s.def.total}</b><span>${L("sets","Sätze")}</span></div></div>
      ${heroNote ? `<div class="banner">${heroNote}</div>` : ""}
      <button type="button" class="bigbtn" id="btnTrain"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>${done0? L("Training done · open","Training erledigt · öffnen") : loadDone? L("Continue training","Training fortsetzen") : L("Start training","Training starten")}</button>`
    : d.conflict ? `<p class="small">The calendar left no room for ${esc(d.conflict)} today or on a flex day. Skip it rather than cramming it into a late night.</p>${chgBtn}`
    : isFast(now) ? `<p class="small">Fast day. No run planned: nothing refills your tank until dinner. Walk 30 to 45 min, keep coffee before ${esc(profile.coffeeCutoff)}.</p>${chgBtn}`
    : `<p class="small">${now.getDay()===6?"Your day off. Walk, family, no training guilt.":"Recovery is where the adaptation happens. A 20 to 30 min walk is plenty."}</p>${chgBtn}`}</div>
  </div>`;

  html += `<div data-tk-slot></div>`;
  if(k >= (profile.creatineFrom||"9999")) html += `<div class="card" style="gap:6px" data-fold="crea" data-ftitle="${L("Creatine 5 g","Kreatin 5 g")}" data-fsum="${lg.crea?L("taken ✓","genommen ✓"):L("open","offen")}"><div class="spread" style="flex-wrap:nowrap"><div><div style="font-weight:700">Creatine 5 g</div><div class="small muted">Daily with a meal or water, also on fast and rest days.</div></div><button type="button" class="check mbc ${lg.crea?"on":""}" id="creaCheck" aria-pressed="${!!lg.crea}" aria-label="Creatine taken">${CHECK_SVG}</button></div></div>`;
  // ---- movement break in the middle of deep work ----
  { const mb = microBreak(d);
    if(mb){ const done = !!lg.mb, red = R.level==="r";
      html += `<div class="card" style="gap:10px" data-fold="mb" data-ftitle="${L("Movement break","Bewegungspause")} · ${fmt(mb.s)}" data-fsum="${done?L("done ✓","erledigt ✓"):esc(mb.reps+" "+mb.name)}"><div class="spread" style="flex-wrap:nowrap"><div class="row" style="gap:12px;flex-wrap:nowrap;min-width:0">${tbadge("strength")}<div style="min-width:0"><div class="eyebrow">Movement break · ${fmt(mb.s)}</div><div style="font-weight:700">${esc(mb.reps)} ${esc(mb.name)}${red?` <span class="chip r" style="margin-left:4px">half today</span>`:""}</div></div></div>
        <button type="button" class="check mbc ${done?"on":""}" id="mbCheck" aria-pressed="${done}" aria-label="Movement break done">${CHECK_SVG}</button></div>
        ${mb.why?`<p class="small muted">${esc(mb.why)}</p>`:""}</div>`; } }

  // ---- the session itself: full screen view (#v-train) ----
  let th = "";
  if(s){
    if(R.ill && s.def.hard) th += `<div class="banner r"><b>${esc(R.ill.text)}.</b> Swap today's hard session for 30 min very easy or a walk. If the values are normal tomorrow, the plan continues.</div>`;
    else if(isFast(now)) th += `<div class="banner"><b>Fast day.</b> Truly easy, HR under 145. Break the fast with 40 g protein right after.</div>`;
    else if(R.level==="y" && isFast(addDays(now,-1))) th += `<div class="banner"><b>Yellow after a fast day is expected.</b> Train as planned, eat before the session.</div>`;
    else if(s.def.formNote) th += `<div class="banner ${s.def.form}"><b>${esc(s.def.formNote)}</b> <button type="button" class="ghost" id="btnFull" style="margin-top:8px">Use full plan today</button></div>`;
    else if(adj) th += `<div class="banner ${R.level}"><b>${esc(adj.t)}.</b> ${adj.lines.map(esc).join(". ")}.</div>`;
    if(false) th += `<div class="banner ${s.def.form}"><b>${esc(s.def.formNote)}</b> <button type="button" class="ghost" id="btnFull" style="margin-top:8px">Use full plan today</button></div>`;
    else if(lg.fullPlan && (R.level==="y"||R.level==="r")) th += `<div class="banner"><b>Full plan today, your choice.</b> It counts normally for your progression. <button type="button" class="ghost" id="btnFull" style="margin-top:8px">Adjust to my recovery again</button></div>`;
    th += `<p class="small muted">This session ≈ strain ${sessStrain.toFixed(0)} for the day, target ${tgt[0]} to ${tgt[1]}.${sessStrain > tgt[1]+1 ? " Above what recovery allows: trim it." : sessStrain < tgt[0]-2 && R.level==="g" && !isFast(now) ? " Room for a 20 to 30 min walk on top." : ""}</p>`;
    th += blocksHtml(s.def, k);
    th += rirHtml(s.def, k);
    th += `<div class="row"><label class="f" for="rpe" style="grid-auto-flow:column;align-items:center;gap:8px">Session effort (RPE)<select id="rpe"><option value="">–</option>${[...Array(10)].map((_,i)=>`<option ${lg.rpe==i+1?"selected":""}>${i+1}</option>`).join("")}</select></label></div>`;
  } else if(d.conflict) th += `<p class="small muted">The calendar left no room for ${esc(d.conflict)} today or on a flex day. Skip it rather than cramming it into a late night.</p>`;
  else if(isFast(now)) th += `<p class="small muted">Fast day. No run planned: nothing refills your tank until dinner. Walk 30 to 45 min, keep coffee before ${esc(profile.coffeeCutoff)}.</p>`;
  else th += `<p class="small muted">${now.getDay()===6?"Your day off. Walk, family, no training guilt.":"Recovery is where the adaptation happens. A 20 to 30 min walk is plenty."}</p>`;
  const ov = (profile.overrides||{})[k];
  th += `<details class="chg"><summary class="small">Change today's training</summary>
    <div class="grid2" style="margin-top:10px"><label class="f" for="ovKey">Training<select id="ovKey">${[["","As planned"],["rest","Rest"],["easyRun","Easy run"],["long","Long run"],["intervals","Intervals"],["strengthA","Strength A"],["strengthB","Strength B"],["strengthAB","Strength A+B"]].map(([v,t])=>`<option value="${v}" ${(ov?.key||"")===v?"selected":""}>${t}</option>`).join("")}</select></label>
    <label class="f" for="ovStart">Start<input id="ovStart" type="time" value="${ov?.start || (s? fmt(s.start) : "17:00")}"></label>
    <label class="f" for="ovMin">Minutes (easy run)<input id="ovMin" type="number" min="15" max="120" step="5" value="${ov?.min||30}"></label></div>
    <button id="btnOv" style="margin-top:10px">Save change</button></details>`;

  if(s){
    const segs = s.def.blocks.map((b,bi)=>{ if(b.skip) return ""; let on=0; for(let i=0;i<b.s;i++) if((lg.sets||{})[`${s.def.sessionKey}:${bi}:${i}`]) on++; return on===b.s?"d":""; }).filter((x,i)=>!s.def.blocks[i].skip);
    { const ni = segs.indexOf(""); if(ni>=0) segs[ni] = "n"; }
    const cur = Math.min(segs.length, segs.filter(x=>x==="d").length + 1);
    $("#v-train").innerHTML = `<div class="tin"><div class="trhead"><button type="button" class="rbtn" id="trBack" aria-label="${L("Back to Today","Zurück zu Heute")}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><h2>${esc(s.def.name)}</h2><span></span></div>
      <div class="trseg" aria-hidden="true">${segs.map(x=>`<i class="${x}"></i>`).join("")}</div>
      <div class="trmeta"><div><span>TIME</span><b>${fmt(s.start)}</b></div><div><span>${L("EXERCISE","ÜBUNG")}</span><b>${cur}/${segs.length}</b></div></div>
      ${th}</div>
      <div class="trfoot"><button type="button" id="trDone">${isDone(k,s.def)? L("Done · back to Today","Fertig · zurück zu Heute") : L("Back to Today","Zurück zu Heute")}</button></div>`;
  } else $("#v-train").innerHTML = `<div class="tin"><div class="trhead"><button type="button" class="rbtn" id="trBack" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><h2>${L("Training","Training")}</h2><span></span></div><div class="card">${th}</div></div>`;
  $("#v-train").hidden = !trainOpen; document.body.classList.toggle("training", trainOpen); { const w = $(".wrap"); if(w) w.inert = trainOpen; }

  // ---- morning: check in, journal, protein in one place ----
  html += `<div class="card" data-fold="morning" data-ftitle="${L("Morning check in","Morgen Check in")}" data-fsum="${lg.feel?L("checked in ✓","eingecheckt ✓"):L("open · 20 seconds","offen · 20 Sekunden")}"><div class="spread"><h3>Morning</h3><span class="small muted">${lg.feel?"checked in ✓":"20 seconds"}</span></div>
    <p class="small muted">${hk.sleepMin? "Sleep came in automatically. Add how you feel." : "No synced sleep for last night yet. Log it so recovery isn't blind."}</p>
    <div class="grid2"><label class="f" for="ciSleep">Hours slept<input id="ciSleep" type="number" inputmode="decimal" step="0.25" min="0" max="14" value="${lg.sleepH??""}" placeholder="${hk.sleepMin?(hk.sleepMin/60).toFixed(1):"7.5"}"></label>
    <label class="f" for="ciFeel">How you feel<select id="ciFeel"><option value="">Pick</option>${["1 · wrecked","2 · flat","3 · normal","4 · good","5 · great"].map((t,i)=>`<option value="${i+1}" ${lg.feel==i+1?"selected":""}>${t}</option>`).join("")}</select></label></div>
    <div class="eyebrow">Yesterday</div>
    <div class="row" style="gap:8px">${JOURNAL.map(x=>`<button type="button" class="ghost jbtn ${logData.days[yk]?.j?.[x.k]?"on":""}" data-j="${x.k}" aria-pressed="${!!logData.days[yk]?.j?.[x.k]}" style="padding:7px 12px;font-size:13px">${esc(x.t)}</button>`).join("")}</div>
    <button id="btnCheckin" class="primary">Save check in</button></div>`;

  html += rhythmCardHtml();
  html += tomorrowCardHtml();
  $("#v-today").innerHTML = html;

  document.querySelectorAll("#v-today [data-dial]").forEach(b=>b.onclick = ()=>{ openDial = openDial===b.dataset.dial ? null : b.dataset.dial; renderToday(); injectTodayTasks(); });
  bindChecks("#v-train", defForKey);
  $("#btnTrain")?.addEventListener("click", ()=>openTraining());
  $("#briefTxt")?.addEventListener("click", ()=>{ const bb = $("#briefBody"), o = bb.hidden; bb.hidden = !o; $("#briefTxt").setAttribute("aria-expanded", String(o)); $("#briefTxt .small").textContent = o ? L("Hide text","Text ausblenden")+" ‹" : L("Show text","Text zeigen")+" ›"; });
  $("#tFold")?.addEventListener("click", ()=>{ const c = $("#tFold").closest(".thero"), f = !c.classList.contains("folded"); c.classList.toggle("folded", f);
    $("#tFold").setAttribute("aria-expanded", String(!f)); $("#tFold").setAttribute("aria-label", f?L("Show workout","Workout zeigen"):L("Fold workout","Workout zuklappen")); foldSet("train", f); foldBar(); });
  $("#trBack")?.addEventListener("click", ()=>closeTraining());
  $("#trDone")?.addEventListener("click", ()=>closeTraining());
  $("#btnFull")?.addEventListener("click", async ()=>{ const L = logData.days[k] = logData.days[k]||{}; if(L.fullPlan) delete L.fullPlan; else L.fullPlan = true; if(!Object.keys(L.sets||{}).length) delete L.form; else if(!L.form) L.form = recLevel(k);
    for(const e of Object.values(L.prog||{})) e.full = !!L.fullPlan;
    bumpLog(); planCache.clear(); render(); await saveDoc("log", logData); });
  bindRhythmCard($("#v-today"));
  document.querySelectorAll("#tomorrowCard [data-tk-open]").forEach(b=>b.onclick = ()=>openTask(b.dataset.tkOpen));
  $("#btnOv").onclick = async ()=>{ const key = $("#ovKey").value; logData.overrides = logData.overrides||{}; profile.overrides = profile.overrides||{};
    if(!key){ delete logData.overrides[k]; delete profile.overrides[k]; } else logData.overrides[k] = profile.overrides[k] = {key, start: $("#ovStart").value||null, min: Number($("#ovMin").value)||30};
    for(const x of Object.keys(logData.overrides)) if(x < dateKey(addDays(new Date(),-14))) delete logData.overrides[x];
    planCache.clear(); render(); await saveDoc("log", logData); writeSchedule(true); };
  $("#rpe")?.addEventListener("change", async e=>{ const L = logData.days[k] = logData.days[k]||{}; L.rpe = Number(e.target.value)||null; await saveDoc("log", logData); });
  document.querySelectorAll("[data-prot]").forEach(b=>b.onclick = async ()=>{ const L = logData.days[k] = logData.days[k]||{}; L.protein = Math.max(0,(L.protein||0)+Number(b.dataset.prot)); render(); await saveDoc("log", logData); });
  document.querySelectorAll("#v-today .jbtn").forEach(b=>b.onclick = ()=>{ const on = !b.classList.contains("on"); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  const cr = $("#creaCheck"); if(cr) cr.onclick = async ()=>{ const L = logData.days[k] = logData.days[k]||{}; L.crea = !L.crea; render(); await saveDoc("log", logData); };
  $("#btnCheckin").onclick = async ()=>{ const L = logData.days[k] = logData.days[k]||{}; L.sleepH = Number($("#ciSleep").value)||null; L.feel = Number($("#ciFeel").value)||null;
    const Y = logData.days[yk] = logData.days[yk]||{}; Y.j = {}; document.querySelectorAll("#v-today .jbtn.on").forEach(b=>Y.j[b.dataset.j] = true);
    render(); await saveDoc("log", logData); };
  const sp = $("#btnSpeak"); if(sp) sp.onclick = ()=>speakBriefing(sp);
  fillVoices();
  const mc = $("#mbCheck"); if(mc) mc.onclick = async ()=>{ const L = logData.days[k] = logData.days[k]||{}; L.mb = !L.mb; const m = microBreak(d); if(L.mb && m) L.mbEx = m.g; render(); await saveDoc("log", logData); };
}
