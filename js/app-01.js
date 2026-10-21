/* Oti Hybrid Coach, GitHub version. Generated from the claude.ai artifact v67 by tools/build_from_v67.py.
   db, mcp and sample are provided by api.js (Google Apps Script backend).
   The code is split into several classic scripts that share one global scope; load them in order. */
"use strict";
const CAL_SERVER = "Google Calendar", DRIVE_SERVER = "Google Drive";
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const PROFILE_VERSION = 2;
const DEFAULT_PROFILE = {
  version: PROFILE_VERSION,
  wake: "07:15", sleepNeed: 465, asleepNeed: 450, prepMin: 60,
  blockStart: "2026-09-28", planFrom: "2026-09-24",
  body: {age:"25 to 29", heightCm:185, weightKg:81, maxHr:192, goal:"Recomposition", priority:"Compete with myself"},
  proteinTarget: 150, stepGoal: 8000, coffeeCutoff: "14:00",
  week: {},
  sessions: {"1":{key:"strengthA",pref:"11:10"},"3":{key:"intervals",pref:"11:10"},"5":{key:"strengthB",pref:"14:00"},"6":{key:"easy",pref:"16:00"},"0":{key:"long",pref:"15:30"}},
  flex: [{dow:2,pref:"18:45"}],
  overrides: {},
  fastDays: [4],
  footballDates: [], football: {s:"19:00", e:"22:00"},
  calendars: ["primary"],
  baselines: {t5k:"24:00", t10k:"49:30", pullups:7, pushups:35, pistol:0, muscleUp:0},
  targets: {t5k:"22:15", t10k:"44:59", pullups:12, pushups:50, pistol:5, muscleUp:1},
  dream: {t5k:"19:59", t10k:"44:59", t10kBy:"2027-03-31"},
  tests: []
};
const METRICS = [
  {k:"t5k", n:"5k time", lower:true, fmt:"mm:ss"},
  {k:"t10k", n:"10k time", lower:true, fmt:"mm:ss"},
  {k:"pullups", n:"Pull ups", unit:"reps"},
  {k:"pushups", n:"Push ups", unit:"reps"},
  {k:"pistol", n:"Pistol squats", unit:"per leg"},
  {k:"muscleUp", n:"Muscle ups", unit:"reps"}
];
let profile = structuredClone(DEFAULT_PROFILE);
let health = {days:{}, workouts:[], importedAt:null, sources:[], driveSeen:{}};
let logData = {days:{}};
let briefing = null, LANG = "en";
let calEvents = {}, calState = {status:"idle", msg:""}, driveState = {status:"idle", msg:""};
let db = null, sample = null, mcp = null;
let tab = "today", weekOffset = 0, sheetFocus = null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const toMin = hm => { if(!hm) return null; const [h,m] = hm.split(":").map(Number); return h*60+(m||0); };
const fmt = m => { m = Math.round(m); m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m/60))+":"+pad(m%60); };
const dur = m => { m=Math.round(m); const h=Math.floor(m/60), r=m%60; return h? `${h}h ${pad(r)}` : `${r} min`; };
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y,m,d] = k.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const w = (x.getDay()+6)%7; return addDays(x,-w); };
const secs = t => { if(t==null||t==="") return null; if(typeof t==="number") return t; const p=String(t).split(":").map(Number); return p.length===3? p[0]*3600+p[1]*60+p[2] : p[0]*60+(p[1]||0); };
const mmss = s => `${Math.floor(s/60)}:${pad(Math.round(s%60))}`;
const pace = s => `${Math.floor(s/60)}:${pad(Math.round(s%60))}/km`;
const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const sd = a => { if(a.length<2) return null; const m=mean(a); return Math.sqrt(mean(a.map(x=>(x-m)**2))); };
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem("ohc:"+k)); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem("ohc:"+k, JSON.stringify(v)); }catch(e){} }
};

/* ================= persistence ================= */

const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
/* ================= persistence ================= */
async function saveDoc(name, obj){
  store.set(name, obj); try{ bumpLog(); }catch(e){}
  if(!db) return;
  try{ await db.doc("app/"+name).set(JSON.parse(JSON.stringify(obj))); }
  catch(e){ setSync("y", e.code==="quota_exceeded" ? "Storage full" : "Not saved"); }
}
async function loadDocs(){
  const get = async name => { let v=null; if(db){ try{ const s=await db.doc("app/"+name).get(); if(s.exists) v=s.data(); }catch(e){} } return v || store.get(name); };
  const p = await get("profile");
  if(p && p.version===PROFILE_VERSION){ profile = {...structuredClone(DEFAULT_PROFILE), ...JSON.parse(JSON.stringify(p))};
    for(const g of ["baselines","targets","dream"]) profile[g] = {...DEFAULT_PROFILE[g], ...(profile[g]||{})}; }
  else if(p){ profile = structuredClone(DEFAULT_PROFILE); if(Array.isArray(p.calendars)) profile.calendars = p.calendars; if(Array.isArray(p.tests)) profile.tests = p.tests.filter(t=>METRICS.some(m=>m.k===t.metric)); }
  const h = await get("health"); if(h) health = {days:{},workouts:[],sources:[],driveSeen:{},...JSON.parse(JSON.stringify(h))};
  const l = await get("log"); if(l) logData = {days:{},...JSON.parse(JSON.stringify(l))}; try{ bumpLog(); }catch(e){}
  const b = await get("briefing"); if(b) briefing = JSON.parse(JSON.stringify(b));
  const hb = await get("habits"); if(hb && hb.version===HABITS_VERSION) habits = mergeHabits(hb);
  const tk = await get("tasks"); if(tk && tk.version===TASKS_VERSION) tasksDoc = mergeTasks(tk);
  applyLang(logData.ui?.lang || "en", false);
  // one off training changes are stored in the log doc; merged over the defaults
  profile.overrides = {...(profile.overrides||{}), ...(logData.overrides||{})};
}
function setSync(kind, text){ const p=$("#syncPill"); p.className="chip "+kind; p.innerHTML=`<span class="dot"></span>${esc(text)}`; }

/* ================= training model ================= */
function latest(k){
  const t = (profile.tests||[]).filter(x=>x.metric===k).sort((a,b)=>a.date<b.date?1:-1)[0];
  return t ? t.value : profile.baselines[k];
}
/* ================= adaptive training (19.10.2026) =================
   1) Progression from logged sets: each main exercise has a rep offset over its test based base.
      Logged at the moment you tick a set (log day .prog[id] = {sk, bi, sets, reps, lvl, dl, full}), so history never
      depends on how the plan is computed later. Rules (double progression with reps in reserve, checked by a reviewer):
      all sets full + RIR 2 or more -> +1 rep next time; full but RIR 0/1 or no RIR -> hold; any set reduced or open -> miss,
      two misses in a row -> -1. Neutral: deload weeks, yellow/red days without "full plan", watch ticked sessions.
      Gap over 10 days -> -1, over 21 days -> back to the base. A new valid max test starts from the base again.
      Cap about 75% of your max; at the cap the note suggests a harder variant instead of more reps.
   2) Day form rewrites the numbers of today's session (formDef). */
function validTest(metric){
  // a max test logged on a red recovery day does not count (it would lower the base)
  const ts = (profile.tests||[]).filter(x=>x.metric===metric).sort((a,b)=>a.date<b.date?1:-1);
  for(const t of ts){ if(!t.red) return t.value; }
  return profile.baselines[metric];
}
function testDate(metric){
  const ts = (profile.tests||[]).filter(x=>x.metric===metric && !x.red).sort((a,b)=>a.date<b.date?1:-1);
  return ts[0]?.date || null;
}
const PROG_METRIC = {pullups:"pullups", chinups:"pullups", push0:"pushups", push1:"pushups", push2:"pushups"};
const PROG_NEXT = {pullups:"At the cap: keep the reps and make every set explosive to the chest (muscle up prep).", chinups:"At the cap: slow 3 s lowering on every rep.", push0:"At the cap: next phase moves to decline push ups.", push1:"At the cap: next phase moves to archer push ups.", push2:"At the cap: add a 2 s pause at the bottom.", pike0:"At the cap: elevate your feet.", pike1:"At the cap: higher feet or a slower lowering."};
// walk the logged history of one exercise before a date; returns {off, note}
function progHistory(id, beforeKey){
  const m = PROG_METRIC[id], td = m ? testDate(m) : null, bs = profile.blockStart || "";
  const days = Object.keys(logData.days||{}).filter(k=>k>=bs && (!td || k>td) && k<beforeKey && logData.days[k]?.prog?.[id]).sort();
  let off = 0, miss = 0, last = null, note = "";
  const gapRule = k => { if(!last) return; const g = (fromKey(k) - fromKey(last))/864e5;
    if(g > 21){ off = 0; miss = 0; note = "Back to your base after more than 3 weeks off."; } else if(g > 10){ off -= 1; miss = 0; note = "One rep less after more than 10 days off."; } };
  for(const k of days){
    const L = logData.days[k], e = L.prog[id], st = L.sets||{};
    const states = [...Array(e.sets)].map((_,i)=>st[`${e.sk}:${e.bi}:${i}`]);
    if(!states.some(Boolean)) continue;                       // session not trained that day
    gapRule(k); last = k;
    if(e.dl){ note = "Held: deload week."; continue; }
    if((e.lvl==="y" || e.lvl==="r") && !e.full){ note = `Held: ${e.lvl==="y"?"yellow":"red"} day.`; continue; }
    const full = states.every(x=>x===true), rir = L.rir?.[e.sk];
    if(full){ miss = 0;
      if(rir!=null && rir>=2){ off += 1; note = `+1 rep: all sets last time, ${rir>=3?"3+":rir} in reserve.`; }
      else note = rir==null ? "Held: all sets done, but no reserve given." : `Held: all sets done, only ${rir} in reserve.`;
    } else { miss += 1;
      if(miss >= 2){ off -= 1; miss = 0; note = "−1 rep: sets reduced or open twice in a row."; }
      else note = "Held: some sets reduced or open last time.";
    }
  }
  if(last) gapRule(beforeKey);
  off = clamp(off, -3, 8);
  return {off, note};
}
const progMemo = new Map();
function progReps(id, base, cap, beforeKey, dl){
  const sig = id+"|"+base+"|"+cap+"|"+beforeKey+"|"+progSig();
  if(progMemo.has(sig)) return progMemo.get(sig);
  const h = progHistory(id, beforeKey);
  let reps = Math.max(2, base + h.off), note = h.note;
  if(reps >= cap && !dl){ reps = cap; note = (note ? note + " " : "") + (PROG_NEXT[id] || ""); }
  const r = {reps, note, off:h.off};
  if(progMemo.size > 400) progMemo.clear();
  progMemo.set(sig, r); return r;
}
// changes when anything that the progression reads changes (used in the plan cache key)
let progSigCache = {at:-1, v:""};
function progSig(){
  const days = logData.days||{};
  if(progSigCache.at === logRev) return progSigCache.v;
  let s = (profile.blockStart||"") + JSON.stringify(profile.tests||[]) + ":";
  for(const k of Object.keys(days)){ const L = days[k]; if(!L.prog) continue; s += k + JSON.stringify(L.prog) + JSON.stringify(L.rir||{}) + (L.form||"") + (L.fullPlan?"F":"");
    for(const e of Object.values(L.prog)) for(let i=0;i<e.sets;i++) s += String(L.sets?.[`${e.sk}:${e.bi}:${i}`] ?? "-"); s += ";"; }
  progSigCache = {at:logRev, v:String(hashStr(s))}; return progSigCache.v;
}
let logRev = 0; function bumpLog(){ logRev++; try{ progMemo.clear(); }catch(e){} }
function hashStr(s){ let h = 0; for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i))|0; } return h; }

// day form: yellow and red change the numbers of the session itself; "Use full plan today" keeps the plan
// the raw recovery level of a day (yellow right after a fast day is expected and counts as green)
function recLevel(k){
  try{ const l = recovery(fromKey(k)).level; if(l==="y" && isFast(addDays(fromKey(k),-1))) return "g"; return l==="y"||l==="r" ? l : "g"; }catch(e){ return "g"; }
}
function formLevel(k){
  const L = logData.days[k]||{};
  if(L.fullPlan) return "g";
  if(L.form && (k !== dateKey(new Date()) || Object.keys(L.sets||{}).length)) return L.form;   // once you trained, the level of that moment stays
  return recLevel(k);
}
function formDef(def, lvl){
  if(!def || (lvl!=="y" && lvl!=="r") || def.type==="sport") return def;
  const d = structuredClone(def); d.form = lvl;
  const isMain = (b,bi) => bi>0 && !/warm up|cool down|break the fast/i.test(b.n);
  let mains = d.blocks.map((b,bi)=>isMain(b,bi)?bi:-1).filter(i=>i>=0);
  // the anchor is the main strength lift (the first exercise with progression, e.g. pull ups), not a jump drill
  const anchor = mains.find(bi=>d.blocks[bi].prog); if(anchor!=null) mains = [anchor, ...mains.filter(bi=>bi!==anchor)];
  if(d.type==="strength"){
    if(lvl==="y"){
      let cut = 0; mains.slice(1).forEach(bi=>{ const b = d.blocks[bi]; if(b.s>=3){ b.d = b.d.replace(new RegExp("^"+b.s+" × "), (b.s-1)+" × "); b.s -= 1; cut++; } });
      if(!cut){ d.formNote = "Yellow: the session is already short, keep it as shown and stop every set 2 reps before failure."; }
      else d.formNote = `Adjusted for yellow: ${d.blocks[mains[0]]?.n || "the main lift"} as planned, one set less on the other exercises, stop every set 2 reps before failure.`;
    } else {
      mains.forEach((bi,i)=>{ const b = d.blocks[bi]; if(i===0){ b.d = b.d.replace(new RegExp("^"+b.s+" × "), "2 × "); b.s = Math.min(2,b.s); b.d += " (easy)"; } else { b.s = 0; b.skip = true; } });
      d.blocks.push({n:"Mobility · 15 min", d:MOB_ROUTINE_LONG, s:1});
      d.formNote = `Adjusted for red: only ${d.blocks[mains[0]]?.n || "the main lift"}, 2 easy sets, then mobility. Recovery beats training today.`;
    }
  } else if(d.type==="run"){
    if(def.keySession) return def;                             // key sessions keep their numbers; the banner offers to move them on red
    if(lvl==="y"){
      d.blocks.forEach(b=>{ const m = /^(\d+) min easy$/.exec(b.n); if(m){ const n = Math.max(20, Math.round(Number(m[1])*0.8/5)*5); b.n = `${n} min easy`; } else if(/tempo|hill sprints/i.test(b.n)){ b.s = 0; b.skip = true; } });
      d.min = Math.max(25, Math.round((d.min||0)*0.8)); d.formNote = "Adjusted for yellow: the run is 20% shorter and truly easy, no tempo or sprints today.";
    } else {
      let first = true;
      d.blocks.forEach((b,bi)=>{ if(bi===0) return; if(first && /min easy/.test(b.n)){ b.n = "30 to 45 min walk"; b.d = "Brisk walk instead of running, nose breathing"; first = false; } else if(!/break the fast/i.test(b.n)){ b.s = 0; b.skip = true; } });
      d.formNote = "Adjusted for red: walk instead of running.";
    }
  } else return def;
  d.lines = d.blocks.filter(b=>!b.skip).map(b=>`${b.n}${b.s>1?` (${b.s} sets)`:""}: ${b.d}`); d.total = d.blocks.reduce((n,b)=>n+b.s,0);
  return d;
}
const MOB_ROUTINE_LONG = "2 rounds: 10 cat cow, 3 world's greatest stretch per side, 60 s deep squat hold, 5 hip 90/90 switches per side, 10 shoulder circles with a towel, 30 s dead hang";
function paces(){
  const p5 = secs(latest("t5k"))/5;
  return { E1:p5*1.215, E2:p5*1.424, T:p5*1.06, I:p5*0.985, R:p5*0.94, G:secs(profile.targets.t5k)/5 };
}
const FB_RE = /fu(ß|ss)ball|football|kicken/i;
function isFootball(date){ const k = dateKey(date); return (profile.footballDates||[]).includes(k) || calEventsForDay(date).some(e=>FB_RE.test(e.t)); }
function dbKg(){ return profile.body?.dbKg ?? 15; }
// every session starts with 5 min warm up and mobility (injury prevention)
const WARMUP = {
  strength: "1 min skipping or jumping jacks, arm circles, cat cow, 10 hip hinges, 10 bodyweight squats, 5 scapula pull ups, 10 wall slides",
  run: "leg swings 10 per side, hip circles, 10 walking lunges with a twist, calf raises, ankle hops, then 1 min brisk walk",
  sport: "leg swings, hip openers, lunges with a twist, short sideways shuffles, then the jog below"
};
function finishDef(d){
  if(!d.blocks.some(b=>/mobility/i.test(b.n))){
    d.blocks.unshift({n:"Warm up + mobility · 5 min", d:WARMUP[d.type] || WARMUP.strength, s:1});
    // runs that already start with a 15 min easy warm up: jog 10 min instead, so the session keeps its length
    const wu = d.blocks.find(b=>b.n==="Warm up" && /^15 min easy/.test(b.d));
    if(wu) wu.d = wu.d.replace(/^15 min easy/, "10 min easy"); else d.min = (d.min||0) + 5;
  } d.lines = d.blocks.map(b=>`${b.n}${b.s>1?` (${b.s} sets)`:""}: ${b.d}`); d.total = d.blocks.reduce((n,b)=>n+b.s,0); return d; }
function footballDef(){ return finishDef({name:"Football", sub:"Match, counts as a hard session", hard:true, keySession:false, min:180, type:"sport", sessionKey:"football", blocks:[
  {n:"Warm up", d:"10 min jog, leg swings, 3 short sprints before kick off", s:1},
  {n:"Play", d:"Full effort. Drink about 500 ml per hour.", s:1},
  {n:"After", d:"30 to 40 g protein within an hour, lights out as the app says", s:1}]}); }
function afterFootball(def){ const d = structuredClone(def);
  d.blocks = d.blocks.filter(b=>!/Nordic|Pistol|Broad jump|Copenhagen/.test(b.n)).map(b=>/Bulgarian/.test(b.n)? {...b, s:2, d:b.d+" (legs tired from football: 2 sets only)"} : b);
  d.sub = "Pull + arms, light legs after football"; return finishDef(d); }
// compact strength (Oti, 19.10.2026): when the normal session does not fit its day (Monday lessons now start 13:00),
// one set less on every exercise with 3 or more sets and no core finisher, so it fits 11:10 to 12:00 before lunch
function compactDef(def){ const d = structuredClone(def);
  d.blocks = d.blocks.filter(b=>!/Hollow body|Hanging knee/.test(b.n)).map(b=>b.s>=3? {...b, s:b.s-1, d:b.d.replace(new RegExp("^"+b.s+" × "), (b.s-1)+" × ")} : b);
  d.name = def.name+" compact"; d.sub = (def.sub||"")+" · compact to fit the day"; d.min = 50; d.compact = true;
  d.lines = d.blocks.map(b=>`${b.n}${b.s>1?` (${b.s} sets)`:""}: ${b.d}`); d.total = d.blocks.reduce((n,b)=>n+b.s,0); return d; }
function isFastDow(date){ return (profile.fastDays||[]).includes(date.getDay()); }
// public holidays Baden-Wuerttemberg (no fast on these days)
function bwHoliday(date){
  const y=date.getFullYear(), a=y%19, b=Math.floor(y/100), c=y%100, d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), kk=c%4, l=(32+2*e+2*i-h-kk)%7, m=Math.floor((a+11*h+22*l)/451), mo=Math.floor((h+l-7*m+114)/31), da=((h+l-7*m+114)%31)+1;
  const easter=new Date(y,mo-1,da), E=n=>dateKey(addDays(easter,n)), F=(mm,dd)=>`${y}-${pad(mm)}-${pad(dd)}`;
  const H={[F(1,1)]:["New Year","Neujahr"],[F(1,6)]:["Epiphany","Heilige Drei Könige"],[E(-2)]:["Good Friday","Karfreitag"],[E(1)]:["Easter Monday","Ostermontag"],[F(5,1)]:["Labour Day","Tag der Arbeit"],[E(39)]:["Ascension","Christi Himmelfahrt"],[E(50)]:["Whit Monday","Pfingstmontag"],[E(60)]:["Corpus Christi","Fronleichnam"],[F(10,3)]:["German Unity Day","Tag der Deutschen Einheit"],[F(11,1)]:["All Saints","Allerheiligen"],[F(12,25)]:["Christmas","Weihnachten"],[F(12,26)]:["Boxing Day","2. Weihnachtstag"]};
  return H[dateKey(date)]||null;
}
const NOFAST_RE = /reise|travel|flug|flight|konferenz|conference|bundestagung|tagung|kongress|congress|retreat|urlaub|vacation|holiday trip/i;
// reason why a fast day is cancelled: manual list in habits.noFast, public holiday, or travel/conference in the calendar
function fastSkip(date){
  if(!isFastDow(date)) return null;
  const k = dateKey(date);
  try{ const r = (habits.noFast||[]).find(x=>x.from<=k && (x.to||x.from)>=k); if(r) return r.why || L("No fast","Kein Fasten"); }catch(e){}
  const h = bwHoliday(date); if(h) return L(h[0],h[1]);
  const t = [...allDayFor(date), ...calEventsForDay(date).map(e=>e.t)].find(x=>NOFAST_RE.test(x));
  return t || null;
}
function isFast(date){ return isFastDow(date) && !fastSkip(date); }
function weekIndex(date){ return Math.floor((mondayOf(date) - mondayOf(fromKey(profile.blockStart))) / (7*864e5)) + 1; }
const DELOAD = w => w===4 || w===8;
// Strength A+B in one session (Oti, 21.10.2026): when a strength day is lost, the next one combines both.
// Main lifts of A (pull ups) and B (push variation) keep their sets and progression, everything else 2 sets
// (pike 3), no jumps, pistols, Nordics, chin ups, curls or core finishers, so it stays about 65 min.
function comboDef(w){
  const A = sessionDef("strengthA", w), B = sessionDef("strengthB", w);
  const pick = (D, re, cap, extra) => { const b = D.blocks.find(x=>re.test(x.n)); if(!b) return null; const c = structuredClone(b);
    if(cap && c.s > cap){ c.d = c.d.replace(new RegExp("^"+c.s+" × "), cap+" × "); c.s = cap; } if(extra) c.d += extra; return c; };
  const blocks = [
    pick(A, /^Pull ups/), B.blocks.find(x=>x.prog && /^push/.test(x.prog.id)) && structuredClone(B.blocks.find(x=>x.prog && /^push/.test(x.prog.id))),
    pick(A, /^Bulgarian/, 2, " (legs still sore: keep 3 reps in reserve, skip if stairs still hurt)"), pick(B, /^Pike/, 3), pick(B, /^Dips/, 2),
    pick(A, /^Copenhagen/, 2), pick(A, /^Hammer/, 2), pick(B, /^DB overhead/, 2), pick(B, /^False grip/, 2)].filter(Boolean);
  const d = {name:"Strength A+B", sub:"Pull + push + light legs, combined", hard:true, min:65, type:"strength", blocks};
  d.sessionKey = "strengthAB"; if(A.deload) d.deload = true;
  return finishDef(d);
}
function sessionDef(key, w){
  if(key==="strengthAB") return comboDef(w);
  const P = paces(), wb = clamp(w,1,12), dl = DELOAD(wb), cyc = (wb-1)%4, phase = wb<=3?0:wb<=7?1:2;
  const E = `${pace(P.E2)} to ${pace(P.E1)}, HR under 150`;
  let d;
  if(key==="test5k") d = {name:"5k test", hard:true, keySession:true, min:55, type:"run", blocks:[
      {n:"Warm up", d:"15 min easy + 4 strides", s:1},{n:"5k time trial", d:"All out, even pacing: start at about 4:35/km, speed up after 3 km. Log the time in Progress, it resets all your paces.", s:1},{n:"Cool down", d:"10 min easy", s:1}]};
  else if(key==="intervals"){
    const plan = [[5,"400 m","I","90 s jog"],[5,"800 m","I","2 min jog"],[6,"800 m","I","2 min jog"],[4,"400 m","I","easy, deload"],[5,"1000 m","I","2:30 jog"],[6,"800 m","I","2 min jog"],[4,"1200 m","I","3 min jog"],[6,"400 m","R","full recovery, deload"],[3,"1600 m","I","3 min jog"],[6,"1000 m","G","2 min jog, goal pace"],[5,"1200 m","I","2:30 jog"],["TEST"]][wb-1];
    if(wb===3 || wb===7) d = {name:"Hill repeats", hard:true, keySession:true, min:55, type:"run", blocks:[
      {n:"Warm up", d:"15 min easy to your hill + 4 strides", s:1},
      {n:`${wb===3?8:10} × 60 s uphill`, d:"Hard but controlled, about 5k effort, tall posture, jog back down", s:wb===3?8:10},
      {n:"Cool down", d:"10 min easy", s:1}]};
    else if(plan[0]==="TEST" && wb===12) d = {name:"10k test", hard:true, keySession:true, min:75, type:"run", blocks:[
      {n:"Warm up", d:"15 min easy + 4 strides", s:1},{n:"10k time trial", d:`Even pacing, start at ${pace(secs(latest("t5k"))/5*1.045)}, speed up after 7 km. Log it in Progress.`, s:1},{n:"Cool down", d:"10 min easy", s:1}]};
    else if(plan[0]==="TEST") d = {name:"5k test", hard:true, keySession:true, min:55, type:"run", blocks:[
      {n:"Warm up", d:"15 min easy + 4 strides", s:1},{n:"5k time trial", d:"All out, even pacing. Log it in Progress.", s:1},{n:"Cool down", d:"10 min easy", s:1}]};
    else d = {name:"Intervals", hard:true, keySession:true, min:60, type:"run", blocks:[
      {n:"Warm up", d:"15 min easy + 4 strides", s:1},
      {n:`${plan[0]} × ${plan[1]}`, d:`@ ${pace(P[plan[2]])} · ${plan[3]}`, s:plan[0]},
      {n:"Cool down", d:"10 min easy", s:1}]};
  } else if(key==="easy"){
    const m = [35,40,40,30,45,30,45,35,45,50,45,30][wb-1];
    const hs = [4,5,6,4,6,5,8,5,8,10,10,6][wb-1], hsec = wb>=7?10:8;
    d = {name:"Easy run + hill sprints", hard:false, min:m+15, type:"run", blocks:[{n:`${m} min easy`, d:E, s:1},{n:`${hs} × ${hsec} s hill sprints`, d:"Max effort uphill, walk back down, full 2 min rest. Stop if form breaks.", s:hs}]};
  } else if(key==="long"){
    const m = [50,60,65,50,70,55,75,55,80,80,85,50][wb-1], tempo = [2,5,7,9,10].includes(wb);
    d = {name:"Long run", hard:tempo, min:m+10, type:"run", blocks:[{n:`${tempo? m-(wb>=9?15:10) : m} min easy`, d:E, s:1}].concat(tempo? [{n:`${wb>=9?15:10} min tempo finish`, d:`@ ${pace(P.T)}`, s:1}] : [])};
  } else {
    const maxPU = Number(validTest("pullups"))||7, maxPush = Number(validTest("pushups"))||35;
    const sets = dl? 3 : 4 + (cyc>=2?1:0);
    // reps of the main exercises: test based base, then the progression offset from your logged sets (no fixed weekly step any more)
    const wkStart = dateKey(addDays(fromKey(profile.blockStart), (Math.max(1,w)-1)*7));
    const pr = progReps("pullups", Math.max(2, Math.round(maxPU*0.55) + (dl?-1:0)), Math.max(3, Math.round(maxPU*0.75)), wkStart, dl);
    const pu = pr.reps;
    if(key==="strengthA"){
      d = {name:"Strength A", sub:"Pull + legs", hard:true, min:60, type:"strength", blocks:[
        {n:"Broad jumps + lateral bounds", d:"5 broad jumps, then 5 bounds per side, full intent, 90 s rest (soccer power)", s:dl?2:3},
        {n:"Pull ups", d: wb>=5 ? `${sets} × ${pu}: strict, but pull the last 2 sets explosively to the chest (muscle up prep), 2 min rest` : `${sets} × ${pu} strict, 2 min rest`, s:sets, prog:{id:"pullups", reps:pu, note:pr.note}},
        {n:"Bulgarian split squat", d:["12 per leg, bodyweight","10 per leg, 3 s lowering","8 per leg, pause at the bottom, then explode"][phase], s:dl?2:3},
        {n:"Pistol progression", d:["Box pistol to knee height, 5 per leg","Box pistol to a lower box, 5 per leg","Pistol holding a door frame, 4 per leg"][phase], s:3},
        {n:"Nordic curl negatives", d:`${3+phase} reps, feet under the sofa, lower slowly`, s:3},
        {n:"Copenhagen plank", d:`${[15,20,25][phase]} s per side, knee version first (groin injury prevention for soccer)`, s:dl?2:3},
        {n:"Hammer curls", d:`8 to 10 @ ${dbKg()} kg`, s:3},
        {n:"Hollow body hold", d:`${30+phase*10} s`, s:3}]};
    } else {
      const pvBase = [["Push ups", Math.max(8,Math.round(maxPush*0.6)+(dl?-3:0)), Math.round(maxPush*0.75)],
                      ["Decline push ups (feet on chair)", Math.max(6,Math.round(maxPush*0.45)+(dl?-3:0)), Math.round(maxPush*0.6)],
                      ["Archer push ups", 5+(dl?-1:0), 8]][phase];
      const pp = progReps("push"+phase, pvBase[1], Math.max(pvBase[1], pvBase[2]), wkStart, dl);
      const pk = progReps("pike"+(phase===0?0:1), dl?6:8, 12, wkStart, dl);
      const cu = progReps("chinups", Math.max(3,Math.round(maxPU*0.5)) + (dl?-1:0), Math.max(4, Math.round(maxPU*0.75)), wkStart, dl);
      d = {name:"Strength B", sub:"Push + arms", hard:true, min:60, type:"strength", blocks:[
        {n:pvBase[0], d:`${sets} × ${pp.reps}${phase===2?" per side":""}`, s:sets, prog:{id:"push"+phase, reps:pp.reps, note:pp.note}},
        {n:"Pike push ups", d:phase===0?`${pk.reps} reps`:`${pk.reps} reps, feet elevated`, s:4, prog:{id:"pike"+(phase===0?0:1), reps:pk.reps, note:pk.note}},
        {n:"Dips", d:`${[6,8,10][phase]} to ${[8,10,12][phase]} reps on the parallel bars at the calisthenics park (two chairs if you train at home), full depth`, s:3},
        {n:"Chin ups", d:`${cu.reps} reps, underhand`, s:3, prog:{id:"chinups", reps:cu.reps, note:cu.note}},
        {n:"DB overhead triceps extension", d:`10 to 12 @ ${dbKg()} kg, one dumbbell`, s:3},
        {n:"DB curls", d:`8 to 10 @ ${dbKg()} kg`, s:3},
        {n:"Hanging knee raises", d:phase===2?"10, try 3 toes to bar":"10 reps", s:3},
        {n:"False grip hang", d:"20 s, wrists over the bar, shoulders pulled down (muscle up prep)", s:3}]};
    }
  }
  d.sessionKey = key; if(dl) d.deload = true;
  return finishDef(d);
}
function easyRunDef(min, fast){
  const P = paces(), E = `${pace(P.E2)} to ${pace(P.E1)}, HR under ${fast?145:150}`;
  const blocks = [{n:`${min} min easy`, d: fast? E+". Fasted: truly easy, walk if it feels hard." : E, s:1}];
  if(fast) blocks.push({n:"Break the fast", d:"40 g protein as the first thing you eat, right after the run", s:1});
  return finishDef({name: fast? "Easy run (fasted)" : "Easy run", sub:"", hard:false, keySession:false, min, type:"run", sessionKey:"easyRun", blocks});
}
function calRange(){
  const mon = mondayOf(new Date());
  return {start: addDays(mon,-1), end: addDays(mon,15)};
}
function parsePayload(p){
  if(p==null) return [];
  if(typeof p==="string"){ try{ p = JSON.parse(p); }catch(e){ return []; } }
  if(Array.isArray(p)) return p;
  return p.events || p.items || [];
}
function calEventsForDay(date){
  const k0 = date.getTime(), out = [];
  for(const list of Object.values(calEvents)){
    for(const ev of list){
      if(ev.status==="cancelled" || !ev.start || !ev.start.dateTime) continue;
      // training blocks the app itself exported to the calendar are not outside commitments
      if(/Quelle: Coach App/i.test(ev.description||"")) continue;
      const s = new Date(ev.start.dateTime), e = new Date(ev.end?.dateTime || ev.start.dateTime);
      const sm = (s - k0)/6e4, em = (e - k0)/6e4;
      if(em <= 0 || sm >= 1440) continue;
      out.push({t:ev.summary||"Busy", s:Math.max(sm,0), e:em, src:"cal"});
    }
  }
  // student lessons ("Name - Musikunterricht") become one "Music lessons" block; a gap of 60 min or more splits it
  const LES = /musikunterricht|music lesson|schlagzeugunterricht/i;
  const les = out.filter(e=>LES.test(e.t)).sort((a,b)=>a.s-b.s), merged = [];
  for(const e of les){ const last = merged[merged.length-1]; if(last && e.s - last.e < 60) last.e = Math.max(last.e, e.e); else merged.push({t:"Music lessons", s:e.s, e:e.e, src:"cal"}); }
  return [...out.filter(e=>!LES.test(e.t)), ...merged];
}
function allDayFor(date){
  const k = dateKey(date), out = [];
  for(const list of Object.values(calEvents)) for(const ev of list){ if(ev.start?.date && ev.start.date<=k && (ev.end?.date||ev.start.date)>k) out.push(ev.summary||"All day"); }
  return out;
}
function startCalendar(){
  if(!mcp){ calState={status:"off",msg:"Calendar not available in this view"}; return; }
  const {start,end} = calRange();
  calState = {status:"loading", msg:"Reading calendar…"};
  for(const cid of profile.calendars){
    const input = {startTime:start.toISOString(), endTime:end.toISOString(), orderBy:"startTime", pageSize:250, timeZone:"Europe/Berlin"};
    if(cid!=="primary") input.calendarId = cid;
    mcp.watchTool(CAL_SERVER, "list_events", input, ev => {
      if(ev.type==="data"){
        calEvents[cid] = parsePayload(ev.result.payload);
        calState = {status:"ok", msg:"Calendar synced", at: ev.result.cache?.storedAt || Date.now()};
      } else {
        const c = ev.error?.code;
        if(["needs_reauth","server_not_connected","blocked_by_policy","approval_required","not_in_manifest"].includes(c)) delete calEvents[cid];
        calState = {status:"err", code:c, msg: calMsg(c)};
      }
      render();
    }, {refetchInterval: 15*60*1000});
  }
}
function calMsg(c){
  return ({needs_reauth:"Backend key rejected: check the key in Setup.",
    server_not_connected:"Connect the backend in Setup (gear icon).",
    selection_required:"Choose which Google Calendar connector to use in the prompt above.",
    not_in_manifest:"Calendar access was declined for this page. Reload to allow it.",
    blocked_by_policy:"Your organization blocks calendar access here.",
    server_unavailable:"Google Calendar did not answer. Showing your weekly template only."})[c] || "Calendar could not be read. Showing your weekly template only.";
}

/* ================= plan engine ================= */
// ILD teaching Saturdays: from the Arbeit calendar, with the known dates as a fallback beyond the loaded weeks
const ILD_RE = /\bILD\b/i;
const ILD_DATES = ["2026-10-10","2026-11-07","2026-12-05","2027-01-16","2027-02-13","2027-03-13","2027-04-10","2027-06-12"];
function isILD(date){ return ILD_DATES.includes(dateKey(date)) || calEventsForDay(date).some(e=>ILD_RE.test(e.t)) || allDayFor(date).some(t=>ILD_RE.test(t)); }
function busyFor(date){
  const t = (profile.week[String(date.getDay())]||[]).map(x=>({t:x.t,s:toMin(x.s),e:toMin(x.e),src:"tmpl"}));
  const cal = calEventsForDay(date).filter(e=>!/bewegungspause|movement break/i.test(e.t));
  if(cal.some(e=>e.t==="Music lessons")) for(let i=t.length-1;i>=0;i--) if(/music lessons/i.test(t[i].t)) t.splice(i,1);
  for(const re of [/deep ?work/i, /lunch|mittag/i, /dinner|abendessen/i]) if(cal.some(e=>re.test(e.t))) for(let i=t.length-1;i>=0;i--) if(re.test(t[i].t)) t.splice(i,1);
  if((profile.footballDates||[]).includes(dateKey(date)) && !cal.some(e=>FB_RE.test(e.t))) t.push({t:"Football", s:toMin(profile.football.s), e:toMin(profile.football.e), src:"tmpl"});
  if(isILD(date)) for(let i=t.length-1;i>=0;i--) if(/songwriting/i.test(t[i].t)) t.splice(i,1);
  if(isILD(date) && !cal.some(e=>ILD_RE.test(e.t))) cal.push({t:"ILD", s:toMin("09:00"), e:toMin("16:00"), src:"cal"});
  return [...t, ...cal].sort((a,b)=>a.s-b.s);
}
function wakeFor(date){
  const anchor = toMin(profile.wake), busy = busyFor(date);
  const first = busy.find(b=>b.e>240);
  if(first && first.s < anchor + profile.prepMin){ const wk = first.s - profile.prepMin; return {wake: wk, early: anchor - wk > 30, reason:first.t}; }
  return {wake: anchor, early:false};
}
function bedFor(date){
  const next = wakeFor(addDays(date,1));
  const ideal = next.wake + 1440 - profile.sleepNeed;
  const rw = Math.max(1, weekIndex(date)), ramp = Math.max(1395, 1470 - 15*(rw-1));
  let target = Math.max(ideal, Math.min(date.getDay()===6 ? Math.min(ramp, 1425) : ramp, next.wake + 1440 - 390));
  if(typeof isEveningDay==="function" && habits && isEveningDay(date)) target = Math.min(target, toMin(habits.evening.time) + 45);
  const lastEnd = Math.max(0, ...busyFor(date).filter(b=>b.e>=17*60).map(b=>b.e));
  if(lastEnd && lastEnd + 45 > target) return {bed:lastEnd+60, late:true, reason:"late event", nextWake:next.wake, inBed: next.wake+1440-(lastEnd+60), early: next.early, earlyReason: next.reason};
  return {bed:target, late:false, ramp:target>ideal, nextWake:next.wake, inBed: next.wake+1440-target, early: next.early, earlyReason: next.reason};
}
function findSlot(busy, pref, len, earliest, latest){
  // lunch may be cut into by 10 min, deep work only needs a 10 min gap after it, everything else 20 min
  const free = t => busy.every(b => { const lunch = /lunch|mittag/i.test(b.t), focus = /deep ?work/i.test(b.t);
    return t + len + (lunch? -10 : 20) <= b.s || t >= b.e + (focus? 10 : lunch? 0 : 20); });
  for(let t=pref; t+len<=latest; t+=15) if(t>=earliest && free(t)) return t;
  for(let t=pref-15; t>=earliest; t-=15) if(t+len<=latest && free(t)) return t;
  return null;
}
const planCache = new Map();
function weekPlan(monday){
  const key = dateKey(monday)+"|"+(profile.footballDates||[]).join()+"|"+Object.keys(calEvents).length+"|"+JSON.stringify(profile.sessions)+"|"+profile.blockStart+"|"+JSON.stringify(profile.overrides||{})+"|"+Object.values(calEvents).reduce((n,l)=>n+l.length,0)+"|"+progSig();
  if(planCache.has(key)) return planCache.get(key);
  const w = weekIndex(monday);
  const days = [...Array(7)].map((_,i)=>{ const d=addDays(monday,i); const wk=wakeFor(d), bd=bedFor(d); return {date:d, busy:busyFor(d), wake:wk, bed:bd, session:null}; });
  const byDow = dow => days.find(x=>x.date.getDay()===dow);
  const unplaced = [];
  for(const [dow, s] of Object.entries(profile.sessions)){
    let day = byDow(Number(dow)); if(profile.planFrom && dateKey(day.date) < profile.planFrom) continue; let def = sessionDef(s.key, w), pref = toMin(s.pref), moved = false;
    const sun = byDow(0), fbSun = isFootball(sun.date);
    if(fbSun && s.key==="easy" && Number(dow)===6) continue;
    if(fbSun && s.key==="long"){ day = byDow(6); pref = toMin("16:00"); moved = true; }
    if(s.key==="strengthA" && isFootball(addDays(day.date,-1))) def = afterFootball(def);
    let t = findSlot(day.busy, pref, def.min, day.wake.wake+45, day.bed.bed - (def.hard?150:90));
    if(t==null && def.type==="strength"){ const c = compactDef(def), tc = findSlot(day.busy, pref, c.min, day.wake.wake+45, day.bed.bed-150); if(tc!=null){ def = c; t = tc; } }
    if(t!=null) day.session = {def, start:t, end:t+def.min, moved, fromDay: moved? "Sun" : undefined};
    else unplaced.push({def, from:day});
  }
  for(const u of unplaced){
    let done = false;
    for(const f of profile.flex){
      const day = byDow(f.dow); if(day.session || (profile.planFrom && dateKey(day.date) < profile.planFrom)) continue;
      const t = findSlot(day.busy, toMin(f.pref), u.def.min, day.wake.wake+45, day.bed.bed-(u.def.hard?150:90));
      if(t!=null){ day.session = {def:u.def, start:t, end:t+u.def.min, moved:true, fromDay: SHORT[u.from.date.getDay()]}; done=true; break; }
    }
    if(!done) u.from.conflict = u.def.name;
  }
  for(const d of days){ if(isFootball(d.date) && !(profile.planFrom && dateKey(d.date) < profile.planFrom)){ const fb = d.busy.find(x=>FB_RE.test(x.t)) || {s:toMin(profile.football.s), e:toMin(profile.football.e)}; if(d.session && d.session.def.sessionKey!=="football") unplaced.push({def:d.session.def, from:d}); d.session = {def:footballDef(), start:fb.s, end:fb.e, moved:false}; } }
  // one off changes for single days (Today → Change today's training)
  for(const d of days){
    const o = (profile.overrides||{})[dateKey(d.date)]; if(!o) continue;
    if(o.key==="rest"){ d.session = null; d.conflict = null; d.override = true; continue; }
    let def = o.key==="easyRun" ? easyRunDef(o.min||30, isFast(d.date)) : sessionDef(o.key, w);
    if(o.key==="strengthA" && isFootball(addDays(d.date,-1))) def = afterFootball(def);
    let st = o.start ? toMin(o.start) : findSlot(d.busy, toMin("17:00"), def.min, d.wake.wake+45, d.bed.bed-(def.hard?150:90));
    if(st==null) st = toMin("17:00");
    d.session = {def, start:st, end:st+def.min, moved:false, override:true}; d.conflict = null;
  }
  // ILD Saturday: training moves to 17:30 and stays easy (no sprints, no tempo, no intervals)
  for(const d of days){
    if(!d.session || d.session.override || d.session.def.type==="sport" || !isILD(d.date)) continue;
    let def = d.session.def;
    if(def.type==="run"){
      const easyMin = def.blocks.map(b=>/^(\d+) min easy$/.exec(b.n)).filter(Boolean).reduce((n,m)=>n+Number(m[1]),0) || 30;
      def = easyRunDef(Math.min(easyMin, 60), false); def.name = "Easy run after ILD"; def.sub = "ILD day: easy only, sprints and tempo dropped";
    }
    const st = toMin("17:30");
    d.session = {...d.session, def, start:st, end:st+def.min, ild:true}; d.conflict = null;
  }
  // hard day after a late night becomes a flag
  days.forEach((d,i)=>{ const prev = i>0? days[i-1] : {bed:bedFor(addDays(d.date,-1))}; d.afterLate = prev.bed.late && prev.bed.bed >= 23*60+30; });
  const res = {w, days}; planCache.clear(); planCache.set(key,res); return res;
}
function dayFromPlan(date){ return weekPlan(mondayOf(date)).days.find(d=>dateKey(d.date)===dateKey(date)); }

/* ================= recovery ================= */
function baselines(date){
  const keys = [...Array(21)].map((_,i)=>dateKey(addDays(date,-(i+1))));
  return { rhr: mean(keys.map(x=>health.days[x]?.rhr).filter(Boolean)), hrv: mean(keys.map(x=>health.days[x]?.hrv).filter(Boolean)) };
}
// Validated on Oti's own history (Jun to Sep 2026): the old one night rule fired 6 times in 87 nights, 5 of them travel (USA flights in July)
// or noise and 1 real illness (30/31 Aug). Rule now: RISK = night pulse up two nights in a row, or breathing AND pulse up the same night.
// A single raised night is only a "watch" note (no training change).
function illFlags(date){
  const k = dateKey(date), h = health.days[k]||{}, keys = [...Array(21)].map((_,i)=>dateKey(addDays(date,-(i+1))));
  const base = f => { const v = keys.map(x=>health.days[x]?.[f]).filter(x=>x!=null); return v.length>=5 ? mean(v) : null; };
  const bR = base("rr"), bH = base("hrn");
  return {rr: h.rr!=null && bR!=null && h.rr - bR > 0.8, hrn: h.hrn!=null && bH!=null && h.hrn - bH > 5, h, bR, bH};
}
function illness(date){
  const t = illFlags(date); if(!t.rr && !t.hrn) return null;
  const y = illFlags(addDays(date,-1)), out = [];
  if(t.rr) out.push(`breathing ${t.h.rr.toFixed(1)}/min (normal ${t.bR.toFixed(1)})`);
  if(t.hrn) out.push(`night pulse ${Math.round(t.h.hrn)} (normal ${Math.round(t.bH)})`);
  const risk = (t.hrn && y.hrn) || (t.rr && t.hrn);
  return risk ? {level:"risk", text:"Illness risk: " + out.join(", ") + (t.hrn && y.hrn ? ", second night in a row" : "")}
              : {level:"watch", text:"Watch: " + out.join(", ") + ". One night alone is often travel, a late night or alcohol. Go easy only if you feel off."};
}
function sleepMinFor(k){ const h = health.days[k]||{}, lg = logData.days[k]||{}; return h.sleepMin ?? (lg.sleepH ? lg.sleepH*60 : null); }
function recovery(date){
  const k = dateKey(date), h = health.days[k]||{}, lg = logData.days[k]||{}, B = baselines(date);
  const parts = []; let ws = 0, ss = 0;
  if(h.hrv && B.hrv){ const s = clamp(50 + (h.hrv/B.hrv-1)*250, 0, 100); ws+=.4; ss+=.4*s; const p=Math.round((h.hrv/B.hrv-1)*100); parts.push([s>=50?"g":s>=30?"y":"r", `HRV ${Math.round(h.hrv)} ms (${p>=0?"+":""}${p}%)`]); }
  if(h.rhr && B.rhr){ const dlt = h.rhr - B.rhr, s = clamp(60 - dlt*9, 0, 100); ws+=.3; ss+=.3*s; parts.push([dlt<3?"g":dlt<6?"y":"r", `RHR ${Math.round(h.rhr)} (${dlt>=0?"+":""}${Math.round(dlt)})`]); }
  const sm = sleepMinFor(k);
  if(sm){ const s = clamp(sm/profile.asleepNeed*100, 0, 100); ws+=.3; ss+=.3*s; parts.push([s>=88?"g":s>=75?"y":"r", `Slept ${dur(sm)}`]); }
  let score = ws ? ss/ws : null;
  if(lg.feel){ const f = [15,35,55,75,90][lg.feel-1]; score = score==null ? f : score + (lg.feel-3)*6; parts.push([lg.feel>=3?"g":lg.feel===2?"y":"r", ["Feeling wrecked","Feeling flat","Feeling normal","Feeling good","Feeling great"][lg.feel-1]]); }
  const d = dayFromPlan(date);
  if(d?.afterLate){ if(score!=null) score -= 5; parts.push(["y","Late night before"]); }
  if(score==null) return {score:null, parts, level:"none", estimated:true};
  score = Math.round(clamp(score,1,99));
  const ill0 = illness(date), ill = ill0?.level==="risk" ? ill0 : null; if(ill0) parts.unshift([ill ? "r" : "y", ill0.text]);
  let level = score>=67?"g":score>=34?"y":"r"; if(ill && level==="g") level = "y";
  return {score, parts, level, ill, estimated: !(h.hrv && B.hrv)};
}
function adjust(def, level){
  if(!def) return null;
  if(def.type==="sport") return level==="r"? {t:"Red before football", lines:["Play at most one half","Skip the sprint duels and drink a lot"]} : null;
  if(level==="r"){
    if(def.keySession) return {t:"Protect the key session", lines:["Move it to tomorrow or the next free slot, don't drop it","Today: 30 min walk + 10 min mobility"]};
    if(def.type==="strength") return {t:"Minimum dose", lines:["Only the first exercise, 2 easy sets","Then 15 min mobility and done"]};
    return {t:"Swap", lines:["Walk 30 to 45 min instead of running"]};
  }
  if(level==="y"){
    if(def.keySession) return {t:"Key session stays", lines:["Do it fully","Stop if two reps come in 5 s/km slower than target"]};
    if(def.type==="strength") return {t:"Trim", lines:["Drop the last set of every exercise after the first","Stop every set 2 reps before failure"]};
    return {t:"Trim", lines:["Cut the run by 20%, keep it truly easy"]};
  }
  return null;
}
const REC_COLOR = {g:"var(--rec-g)", y:"var(--rec-y)", r:"var(--rec-r)", none:"var(--muted)"};
const VERDICT = {g:"Green. Your body can take load today. Go after it.", y:"Yellow. Train, but hold something back.", r:"Red. Recovery beats training today.", none:"No data for last night yet. Do the check in below."};

/* ================= rings ================= */
function ring(pct, color, size, stroke, valueHtml, label, vSize){
  const r = (size-stroke)/2, c = 2*Math.PI*r, p = pct==null ? 0 : clamp(pct,0,1);
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    <circle class="arc" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c*(1-p)).toFixed(1)}" /></svg>
    <div class="c"><div class="v" style="font-size:${vSize||Math.round(size*0.26)}px">${valueHtml}</div>${label?`<div class="l">${label}</div>`:""}</div></div>`;
}
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

/* ================= logging ================= */
function doneCount(k, def){ const s = logData.days[k]?.sets || {}; let n = 0; def.blocks.forEach((b,bi)=>{ for(let i=0;i<b.s;i++) if(s[`${def.sessionKey}:${bi}:${i}`]) n++; }); return n; }
// a session counts as done when all training sets are ticked; meal blocks ("Break the fast") do not count
function trainingDone(k, def){ const st = logData.days[k]?.sets || {}; return def.blocks.every((b,bi)=>/break the fast/i.test(b.n) || [...Array(b.s)].every((_,i)=>st[`${def.sessionKey}:${bi}:${i}`])); }
function watchConfirmed(k){ const L = logData.days[k]; return !!(L?.autoDone && L.auto && Object.keys(L.auto).length); }
function isDone(k, def){ return !!logData.days[k]?.done?.[def.sessionKey] || watchConfirmed(k); }
// short technique videos: opens a YouTube search for a good tutorial (no fixed video that could disappear)
const HOWTO = [[/broad jump/i,"broad jump lateral bound technique"],[/pull ups/i,"strict pull up technique tutorial"],[/chin ups/i,"chin up technique tutorial"],[/bulgarian/i,"bulgarian split squat bodyweight technique"],[/pistol/i,"box pistol squat progression tutorial"],[/nordic/i,"nordic curl negative at home tutorial"],[/copenhagen/i,"copenhagen plank knee version tutorial"],[/hammer curl/i,"dumbbell hammer curl technique"],[/db curls/i,"dumbbell curl technique"],[/hollow/i,"hollow body hold tutorial"],[/archer push/i,"archer push up progression tutorial"],[/decline push/i,"decline push up technique"],[/pike push/i,"pike push up tutorial"],[/^push ups/i,"perfect push up technique"],[/^dips/i,"parallel bar dips technique"],[/overhead triceps/i,"dumbbell overhead triceps extension technique"],[/hanging knee/i,"hanging knee raise technique"],[/false grip/i,"false grip hang muscle up tutorial"],[/warm up \+ mobility/i,"5 minute full body warm up mobility routine"]];
function howto(n){ const h = HOWTO.find(([re])=>re.test(n)); return h ? `<a class="small" href="https://www.youtube.com/results?search_query=${encodeURIComponent(h[1])}" target="_blank" rel="noopener" style="color:var(--lift);font-weight:600;text-decoration:none;white-space:nowrap">▶ Video</a>` : ""; }
function blocksHtml(def, k){
  const s = logData.days[k]?.sets || {}, str = def.type==="strength";
  return def.blocks.map((b,bi)=>{
    if(b.skip) return "";
    let on = 0; const boxes = [...Array(b.s)].map((_,i)=>{ const id=`${def.sessionKey}:${bi}:${i}`, v = s[id], c=!!v, rd = v==="r"; if(c) on++;
      return `<button class="check ${c?"on":""} ${rd?"rd":""}" data-k="${k}" data-id="${id}" aria-pressed="${c}" aria-label="${esc(b.n)} set ${i+1}${rd?" reduced":""}"><span class="n">${i+1}</span>${rd?`<span class="rdm">−</span>`:CHECK_SVG}</button>`; }).join("");
    const note = b.prog?.note ? `<div class="small" style="color:var(--lift);margin-top:2px">${esc(b.prog.note)}</div>` : "";
    return `<div class="block ${on===b.s?"done":""}"><div class="bh"><span class="bn">${esc(b.n)}</span><span class="row" style="gap:10px;flex-wrap:nowrap">${str?howto(b.n):""}<span class="small muted mono">${on}/${b.s}</span></span></div><div class="bd">${esc(b.d)}</div>${note}<div class="sets">${boxes}</div></div>`;
  }).join("") + (str ? `<p class="small muted" style="margin:4px 2px 0">Tap a set once for done, twice for reduced reps, a third time to clear.</p>` : "");
}
// reps in reserve after the last sets of a strength session (0, 1, 2, 3+); drives the progression
function rirHtml(def, k){
  if(!def || def.type!=="strength") return "";
  const L = logData.days[k]||{}, v = L.rir?.[def.sessionKey];
  if(!doneCount(k, def)) return "";
  return `<div class="card" style="gap:8px"><div style="font-weight:700">How many more reps could you have done on your last sets?</div>
    <div class="row" style="gap:8px">${[0,1,2,3].map(n=>`<button type="button" class="${v===n?"primary":"ghost"}" data-rir="${n}" data-k="${k}" data-sk="${def.sessionKey}">${n===3?"3+":n}</button>`).join("")}</div>
    <p class="small muted">2 or more with every set done means one rep more next time.</p></div>`;
}
function bindRir(root){
  document.querySelectorAll(root+" [data-rir]").forEach(b=>b.onclick = async ()=>{ const L = logData.days[b.dataset.k] = logData.days[b.dataset.k]||{}; L.rir = L.rir||{}; L.rir[b.dataset.sk] = Number(b.dataset.rir); bumpLog(); planCache.clear(); render(); await saveDoc("log", logData); });
}
function bindChecks(root, defFor){
  document.querySelectorAll(root+" .check:not(.mbc)").forEach(btn=>btn.addEventListener("click", async ()=>{
    const k = btn.dataset.k, id = btn.dataset.id, L = logData.days[k] = logData.days[k]||{};
    const def = defFor(k);
    L.sets = L.sets||{};
    const cur = L.sets[id];
    if(def && def.type==="strength"){ if(!cur) L.sets[id] = true; else if(cur===true) L.sets[id] = "r"; else delete L.sets[id]; }
    else { if(cur) delete L.sets[id]; else L.sets[id] = true; }
    L.manual = true;
    if(def){
      L.done = L.done||{}; const was = !!L.done[def.sessionKey]; L.done[def.sessionKey] = trainingDone(k,def) || watchConfirmed(k); if(!was && L.done[def.sessionKey]) L.doneAt = Date.now();
      // remember what this block was when you trained it (for the progression) and the day form
      const [sk, bi] = id.split(":"), b = def.blocks[Number(bi)];
      if(!L.form) L.form = recLevel(k);          // the real recovery level of that day, kept once you trained
      if(b && b.prog){ L.prog = L.prog||{}; L.prog[b.prog.id] = {sk, bi:Number(bi), sets:b.s, reps:b.prog.reps, lvl: L.form, dl: !!def.deload, full: !!L.fullPlan}; }
    }
    bumpLog(); planCache.clear(); render(); await saveDoc("log", logData);
  }));
  bindRir(root);
}
function defForKey(k){ const d = dayFromPlan(fromKey(k)); return d?.session?.def ? formDef(d.session.def, formLevel(k)) : null; }

/* ================= timeline ================= */
function lastMealFor(d){
  const din = d.busy.find(b=>/dinner|abendessen/i.test(b.t)); if(din) return din.s;
  let lm = d.bed.bed - 180;
  for(const b of d.busy) if(b.s >= 17*60 && b.s < lm && b.e > lm - 60) lm = Math.min(lm, b.s - 15);
  return lm;
}
function strip(d, withAxis){
  const S=5*60, E=25*60, W=E-S, pct = m => ((clamp(m,S,E)-S)/W*100).toFixed(2)+"%", wid = (a,b) => ((clamp(b,S,E)-clamp(a,S,E))/W*100).toFixed(2)+"%";
  let h = "";
  for(let t=6*60;t<E;t+=180) h += `<i class="tick" style="left:${pct(t)}"></i>`;
  if(d.wake.wake > S) h += `<div class="blk sleepb" style="left:0;width:${wid(S,d.wake.wake)}"></div>`;
  h += `<div class="blk sleepb" style="left:${pct(d.bed.bed)};width:${wid(d.bed.bed,E)}"></div>`;
  const FO = /deep ?work/i;
  for(const b of d.busy) h += `<div class="blk ${FO.test(b.t)?"focus":/lunch|mittag|dinner|abendessen/i.test(b.t)?"meal":"busy"}" style="left:${pct(b.s)};width:${wid(b.s,b.e)}" title="${esc(b.t)}">${esc(b.t)}</div>`;
  if(d.session) h += `<div class="blk train" style="left:${pct(d.session.start)};width:${wid(d.session.start,d.session.end)}">${esc(d.session.def.name)}</div>`;
  if(dateKey(d.date)===dateKey(new Date())){ const n=new Date(); h += `<i class="now" style="left:${pct(n.getHours()*60+n.getMinutes())}"></i>`; }
  const ax = withAxis ? `<div class="axis" aria-hidden="true">${[6,9,12,15,18,21,24].map(x=>`<span style="left:${pct(x*60)}">${pad(x%24)}</span>`).join("")}</div>` : "";
  return `<div class="strip" role="img" aria-label="Day timeline">${h}</div>${ax}`;
}
function agenda(d){
  const it = [{s:d.wake.wake, h:`<span class="t sl">${fmt(d.wake.wake)}</span><span class="sl">Wake${d.wake.early?` early for ${esc(d.wake.reason)}`:""}, daylight within 30 min</span>`}];
  for(const b of d.busy){ const c = /deep ?work/i.test(b.t)? "fo" : /lunch|mittag|dinner|abendessen/i.test(b.t)? "me" : ""; it.push({s:b.s, h:`<span class="t${c?" "+c:""}">${fmt(b.s)} to ${fmt(b.e)}</span><span class="${c}">${esc(b.t)}</span>`}); }
  if(d.session) it.push({s:d.session.start, h:`<span class="t tr">${fmt(d.session.start)} to ${fmt(d.session.end)}</span><span class="tr">${esc(d.session.def.name)}${d.session.moved?` (moved from ${d.session.fromDay})`:""}</span>`});
  const cc = toMin(profile.coffeeCutoff); it.push({s:cc, h:`<span class="t fd">${fmt(cc)}</span><span class="fd">Last coffee</span>`});
  const fast = isFast(d.date), preFast = isFast(addDays(d.date,1));
  if(fast){ it.push({s:d.wake.wake+1, h:`<span class="t fd">all day</span><span class="fd">Fast: water, tea, coffee only. Walk 30 to 45 min for your steps</span>`}); }
  if(!d.busy.some(b=>/dinner|abendessen/i.test(b.t)) || fast || preFast) it.push({s:lastMealFor(d), h:`<span class="t fd">${fmt(lastMealFor(d))}</span><span class="fd">${fast?"Break the fast: 40 g protein first, then a normal dinner":preFast?"Last meal before the fast: big, carbs + 50 g protein":"Last big meal"}</span>`});
  it.push({s:d.bed.bed-60, h:`<span class="t sl">${fmt(d.bed.bed-60)}</span><span class="sl">Wind down, screens away</span>`});
  it.push({s:d.bed.bed, h:`<span class="t sl">${fmt(d.bed.bed)}</span><span class="sl">Lights out · ${dur(d.bed.inBed)} until ${fmt(d.bed.nextWake)}</span>`});
  return `<div class="agenda">${it.sort((a,b)=>a.s-b.s).map(i=>`<div>${i.h}</div>`).join("")}</div>`;
}

/* ================= day calendar: blocks sized by time, rules as markers, everything opens a window ================= */
const CAL_ITEMS = {};
const RICON = {
  coffee:'<path d="M4 9h12v5a5 5 0 0 1 -5 5h-2a5 5 0 0 1 -5 -5z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v3M12 3v3"/>',
  meal:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 2-2 6 0 8v10"/>',
  wind:'<path d="M3 8h11a3 3 0 1 0 -3 -3"/><path d="M3 12h15a3 3 0 1 1 -3 3"/><path d="M3 16h7"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  fast:'<path d="M12 3v18M5 8h14M7 13h10"/>' };
const ricon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RICON[k]}</svg>`;
