/* Oti Hybrid Coach, GitHub version. Generated from the claude.ai artifact v67 by tools/build_from_v67.py.
   db, mcp and sample are provided by api.js (Google Apps Script backend).
   The code is split into several classic scripts that share one global scope; load them in order. */
function vdot(t){ const m = t/60, v = 5000/m; const vo = -4.6 + 0.182258*v + 0.000104*v*v; const pct = 0.8 + 0.1894393*Math.exp(-0.012778*m) + 0.2989558*Math.exp(-0.1932605*m); return vo/pct; }
function lineChart(points, label, unit, color){ color = color || "var(--load)";
  const W=620,H=200,L=40,R=12,T=14,B=28; const vals = points.map(p=>p[1]);
  let lo = Math.floor(Math.min(...vals)-2), hi = Math.ceil(Math.max(...vals)+2);
  const n = points.length, x = i => L + (n===1?0.5:i/(n-1))*(W-L-R), y = v => T + (hi-v)/(hi-lo)*(H-T-B);
  let g = ""; const step = Math.max(1, Math.round((hi-lo)/4));
  for(let v=lo; v<=hi; v+=step) g += `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${v}</text>`;
  const d = points.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const area = d + `L${x(n-1)},${H-B}L${x(0)},${H-B}Z`;
  const last = points[n-1];
  const hits = points.map((p,i)=>`<rect data-tip="${esc(fromKey(p[0]).toLocaleDateString("en-GB",{day:"numeric",month:"short"}))}: ${Math.round(p[1])} ${unit}" x="${x(i)-(W-L-R)/n/2}" y="${T}" width="${(W-L-R)/n}" height="${H-T-B}" fill="transparent"/>`).join("");
  const lbl = points.map((p,i)=> (i%Math.ceil(n/6)===0||i===n-1)?`<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="var(--mono)">${fromKey(p[0]).getDate()}.${fromKey(p[0]).getMonth()+1}</text>`:"").join("");
  return `<div class="chart" data-chart><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${g}<path d="${area}" fill="${color}" opacity=".12"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/><circle cx="${x(n-1)}" cy="${y(last[1])}" r="4.5" fill="${color}" stroke="var(--card)" stroke-width="2"/>${lbl}${hits}</svg><div class="tip" hidden></div></div>`;
}
function bindTips(root){
  document.querySelectorAll(root+" [data-chart]").forEach(ch=>{
    const tip = ch.querySelector(".tip");
    const show = e => { const t = e.target.closest("[data-tip]"); if(!t){ tip.hidden=true; return; } const r = ch.getBoundingClientRect(), b = t.getBoundingClientRect(); tip.textContent = t.dataset.tip; tip.style.left = Math.min(Math.max(b.left - r.left + b.width/2, 70), r.width-70)+"px"; tip.style.top = (b.top - r.top)+"px"; tip.hidden=false; };
    ch.addEventListener("pointermove", show); ch.addEventListener("pointerdown", show); ch.addEventListener("pointerleave", ()=>tip.hidden=true);
  });
}
function newAgg(cutoff){ return {cutoff, sleep:{}, steps:{}, rhr:{}, hrv:{}, weight:{}, hr:{}, workouts:[], zsleep:{}, zsteps:{}, bodyfat:{}, lines:0, sources:new Set()}; }
function parseHK(s){ return new Date(s.replace(" ","T").replace(/ ([+-]\d{2})(\d{2})$/,"$1:$2")); }
const ATTR = /(\w+)="([^"]*)"/g;
function attrs(line){ const o={}; let m; ATTR.lastIndex=0; while((m=ATTR.exec(line))) o[m[1]]=m[2]; return o; }
function handleLine(line, A){
  A.lines++;
  const i = line.indexOf("<Record "), w = line.indexOf("<Workout ");
  if(i<0 && w<0) return;
  const sd = line.indexOf('startDate="'); if(sd<0) return;
  if(line.substr(sd+11,10) < A.cutoff) return;
  const a = attrs(line);
  if(w>=0){ const s=parseHK(a.startDate); const min = a.durationUnit==="min"? Number(a.duration): Number(a.duration)/60;
    A.workouts.push({date:dateKey(s), type:(a.workoutActivityType||"").replace("HKWorkoutActivityType",""), min, km: a.totalDistance? Number(a.totalDistance)*(a.totalDistanceUnit==="mi"?1.609:a.totalDistanceUnit==="m"?0.001:1) : null}); A.sources.add("Apple Health"); return; }
  const t = a.type, src = a.sourceName || "?";
  if(t==="HKCategoryTypeIdentifierSleepAnalysis"){
    const s = parseHK(a.startDate), e = parseHK(a.endDate), sh = s.getHours();
    if(sh>=11 && sh<19) return;             // naps
    const key = dateKey(new Date(e.getTime()+8*36e5));
    const v = a.value||""; const asleep = /Asleep/.test(v), stage = /Deep/.test(v)?"deep":/REM/.test(v)?"rem":null;
    if(/Awake/.test(v)) return;
    const n = ((A.sleep[key] = A.sleep[key]||{})[src] = A.sleep[key]?.[src] || {asleep:0,inbed:0,on:null,off:null,deep:0,rem:0});
    const mins = (e-s)/6e4;
    if(asleep){ n.asleep += mins; if(stage) n[stage]+=mins; if(!n.on||s<n.on) n.on=s; if(!n.off||e>n.off) n.off=e; }
    else { n.inbed += mins; if(!n.ion||s<n.ion) n.ion=s; if(!n.ioff||e>n.ioff) n.ioff=e; }
    A.sources.add("Apple Health"); return;
  }
  const day = a.startDate.substr(0,10), val = Number(a.value);
  if(t==="HKQuantityTypeIdentifierStepCount"){ const d=(A.steps[day]=A.steps[day]||{}); d[src]=(d[src]||0)+val; }
  else if(t==="HKQuantityTypeIdentifierRestingHeartRate") (A.rhr[day]=A.rhr[day]||[]).push(val);
  else if(t==="HKQuantityTypeIdentifierHeartRateVariabilitySDNN") (A.hrv[day]=A.hrv[day]||[]).push(val);
  else if(t==="HKQuantityTypeIdentifierBodyMass") A.weight[day] = a.unit==="lb"? val*0.4536 : val;
  else return;
  A.sources.add("Apple Health");
}
function lineFeeder(A, status){
  let buf = "", n = 0;
  return text => { buf += text; const parts = buf.split("\n"); buf = parts.pop(); for(const p of parts) handleLine(p, A); if(++n % 40 === 0) status(`Reading Apple Health… ${(A.lines/1e6).toFixed(1)} M lines`); };
}
function streamZipEntry(entry, feed){
  return new Promise((res, rej)=>{ const dec = new TextDecoder(); entry.internalStream("uint8array").on("data", c=>feed(dec.decode(c,{stream:true}))).on("error", rej).on("end", ()=>{ feed(dec.decode()+"\n"); res(); }).resume(); });
}
async function streamFile(file, feed){
  const reader = file.stream().getReader(), dec = new TextDecoder();
  for(;;){ const {done, value} = await reader.read(); if(done) break; feed(dec.decode(value,{stream:true})); }
  feed(dec.decode()+"\n");
}
function csvRows(text){
  const lines = text.replace(/\r/g,"").split("\n").filter(Boolean); if(lines.length<2) return {h:[],rows:[]};
  const split = l => { const out=[]; let cur="", q=false; for(const ch of l){ if(ch==='"'){q=!q;continue;} if(ch===","&&!q){out.push(cur);cur="";} else cur+=ch; } out.push(cur); return out; };
  const h = split(lines[0]).map(x=>x.trim());
  return {h, rows: lines.slice(1).map(l=>{ const c=split(l); const o={}; h.forEach((k,i)=>o[k]=c[i]); return o; })};
}
function parseAnyDate(v){
  if(v==null||v==="") return null;
  if(/^\d{10,13}$/.test(v)) return new Date(Number(v) * (v.length===10?1000:1));
  let s = v.trim().replace(" ","T"); if(/[+-]\d{4}$/.test(s)) s = s.replace(/([+-]\d{2})(\d{2})$/,"$1:$2");
  const d = new Date(s); return isNaN(d)? null : d;
}
function parseZepp(text, name, A){
  const {h, rows} = csvRows(text); const H = h.map(x=>x.toLowerCase());
  const has = k => H.includes(k.toLowerCase()), col = k => h[H.indexOf(k.toLowerCase())];
  if(has("deepSleepTime") && has("start") && has("stop")){
    for(const r of rows){ const s = parseAnyDate(r[col("start")]), e = parseAnyDate(r[col("stop")]); if(!s||!e||e<=s) continue;
      const key = dateKey(new Date(e.getTime()+8*36e5)); if(key < A.cutoff) continue;
      const deep = Number(r[col("deepSleepTime")])||0, light = Number(r[col("shallowSleepTime")])||0, rem = has("REMTime")? Number(r[col("REMTime")])||0 : 0;
      if(deep+light+rem < 60) continue;
      A.zsleep[key] = {asleep:deep+light+rem, deep, rem, on:s, off:e}; }
    A.sources.add("Zepp sleep"); return true;
  }
  if(has("steps") && has("date")){
    for(const r of rows){ const d = r[col("date")]; if(d>=A.cutoff) A.zsteps[d] = Number(r[col("steps")])||0; }
    A.sources.add("Zepp activity"); return true;
  }
  if(has("heartRate") && has("date")){
    for(const r of rows){ const d = r[col("date")], v = Number(r[col("heartRate")]); if(d>=A.cutoff && v>30) (A.hr[d]=A.hr[d]||[]).push(v); }
    A.sources.add("Zepp heart rate"); return true;
  }
  const hv = H.findIndex(x=>x.includes("hrv"));
  if(hv>=0 && (has("date")||has("time"))){
    for(const r of rows){ const dt = parseAnyDate(r[col(has("date")?"date":"time")]); const v = Number(r[h[hv]]); if(dt && v>0){ const d=dateKey(dt); if(d>=A.cutoff) (A.hrv[d]=A.hrv[d]||[]).push(v);} }
    A.sources.add("Zepp HRV"); return true;
  }
  if(has("weight")){
    const tc = has("time")? "time" : has("date")? "date" : null;
    if(tc) for(const r of rows){ const dt=parseAnyDate(r[col(tc)]); const v=Number(r[col("weight")]); if(dt&&v>20){ const d=dateKey(dt); if(d>=A.cutoff) A.weight[d]=v; } }
    A.sources.add("Zepp body"); return true;
  }
  return false;
}
function finalize(A){
  const days = {};
  const put = (k, obj) => { days[k] = {...(days[k]||{}), ...obj}; };
  for(const [k, bySrc] of Object.entries(A.sleep)){
    const best = Object.values(bySrc).sort((a,b)=>(b.asleep||b.inbed)-(a.asleep||a.inbed))[0];
    const on = best.on || best.ion, off = best.off || best.ioff; if(!on||!off) continue;
    const mins = best.asleep || best.inbed; if(mins < 90) continue;
    put(k, {sleepMin: Math.round(mins), onset: on.getHours()*60+on.getMinutes(), wakeAt: off.getHours()*60+off.getMinutes(), deep: best.deep?Math.round(best.deep):undefined, rem: best.rem?Math.round(best.rem):undefined});
  }
  for(const [k, z] of Object.entries(A.zsleep)){
    const cur = days[k]||{};
    put(k, {sleepMin: cur.sleepMin || Math.round(z.asleep), onset: cur.onset ?? (z.on.getHours()*60+z.on.getMinutes()), wakeAt: cur.wakeAt ?? (z.off.getHours()*60+z.off.getMinutes()), deep: z.deep>0? Math.round(z.deep) : undefined, rem: z.rem>0? Math.round(z.rem) : undefined, light: z.light>0? Math.round(z.light) : undefined, awake: z.awake!=null? Math.round(z.awake) : undefined});
  }
  for(const [k, bySrc] of Object.entries(A.steps)) put(k, {steps: Math.round(Math.max(...Object.values(bySrc)))});
  for(const [k, v] of Object.entries(A.zsteps)) if(!days[k]?.steps || v > days[k].steps) put(k, {steps: v});
  for(const [k, arr] of Object.entries(A.rhr)) put(k, {rhr: Math.round(mean(arr))});
  for(const [k, arr] of Object.entries(A.hr)) if(!days[k]?.rhr && arr.length>20){ const s=[...arr].sort((a,b)=>a-b); put(k, {rhr: s[Math.floor(s.length*0.05)]}); }
  for(const [k, arr] of Object.entries(A.hrv)) put(k, {hrv: Math.round(mean(arr))});
  for(const [k, v] of Object.entries(A.weight)) put(k, {weight: Math.round(v*10)/10});
  for(const [k, v] of Object.entries(A.kcal||{})) put(k, {kcal: v});
  for(const [k, v] of Object.entries(A.rr||{})) put(k, {rr: Math.round(v*10)/10});
  for(const [k, v] of Object.entries(A.hrn||{})) put(k, {hrn: Math.round(v)});
  for(const [k, v] of Object.entries(A.vo2||{})) put(k, {vo2: Math.round(v*10)/10});
  for(const [k, v] of Object.entries(A.bodyfat||{})) put(k, {bodyfat: Math.round(v*10)/10});
  return days;
}
async function importFiles(files){
  const st = $("#impStatus"), status = t => { st.textContent = t; };
  if(!files.length) return;
  const cutoff = dateKey(addDays(new Date(), -120));
  const A = newAgg(cutoff), feed = lineFeeder(A, status);
  let unknown = [];
  try{
    for(const f of files){
      const nm = f.name.toLowerCase();
      if(nm.endsWith(".zip")){
        if(!window.JSZip) throw new Error("The zip reader didn't load. Unzip the file and pick export.xml instead.");
        status(`Opening ${f.name}…`);
        const zip = await JSZip.loadAsync(f);
        const entries = Object.values(zip.files).filter(e=>!e.dir);
        const xml = entries.find(e=>/(^|\/)(export|exportieren)\.xml$/i.test(e.name)) || entries.find(e=>/\.xml$/i.test(e.name) && !/cda/i.test(e.name));
        if(xml){ status("Reading Apple Health… this can take a minute"); await streamZipEntry(xml, feed); }
        for(const e of entries.filter(e=>/\.csv$/i.test(e.name))){ if(!parseZepp(await e.async("string"), e.name, A)) unknown.push(e.name); }
      } else if(nm.endsWith(".xml")){ status("Reading Apple Health… this can take a minute"); await streamFile(f, feed); }
      else if(nm.endsWith(".json")){ parseHAE(JSON.parse(await f.text()), A); }
      else if(nm.endsWith(".txt")){ parseShortcutTxt(await f.text(), A); }
      else if(nm.endsWith(".csv")){ if(!parseZepp(await f.text(), f.name, A)) unknown.push(f.name); }
      else unknown.push(f.name);
    }
    const days = finalize(A);
    for(const [k,v] of Object.entries(days)) health.days[k] = {...(health.days[k]||{}), ...v};
    for(const k of Object.keys(health.days)) if(k < dateKey(addDays(new Date(), -400))) delete health.days[k];
    const seen = new Set((health.workouts||[]).map(w=>w.date+w.type+Math.round(w.min)));
    health.workouts = [...(health.workouts||[]), ...A.workouts.filter(w=>!seen.has(w.date+w.type+Math.round(w.min)) && !(health.workouts||[]).some(x=>x.manual && x.date===w.date && x.start===w.start))].sort((a,b)=>a.date<b.date?-1:1).slice(-400);
    health.sources = [...new Set([...(health.sources||[]), ...A.sources])];
    health.importedAt = Date.now();
    await saveDoc("health", health);
    const cnt = Object.keys(days).length;
    const got = ["sleepMin","rhr","hrv","steps","weight"].map(f=>[f, Object.values(days).filter(d=>d[f]!=null).length]);
    render(); tab==="setup" || switchTab("setup");
    $("#impStatus").textContent = `Imported ${cnt} days: ${got.map(([f,n])=>`${({sleepMin:"sleep",rhr:"resting HR",hrv:"HRV",steps:"steps",weight:"weight"})[f]} ${n}`).join(", ")}, workouts ${A.workouts.length}.${unknown.length?` Skipped: ${unknown.slice(0,4).join(", ")}${unknown.length>4?"…":""}`:""}`;
  }catch(e){ status("Import failed: " + (e.message||e)); }
}


/* ================= Health Auto Export (JSON) ================= */
function parseHAE(json, A){
  const d = json?.data || json || {};
  for(const m of d.metrics||[]){
    const name = String(m.name||"").toLowerCase(), units = String(m.units||"").toLowerCase();
    for(const p of m.data||[]){
      const dt = p.date ? parseHK(String(p.date)) : null, day = p.date ? String(p.date).slice(0,10) : null;
      if(day && day < A.cutoff) continue;
      if(name.includes("sleep")){
        if(p.totalSleep!=null || p.asleep!=null){
          const s = parseAnyHK(p.sleepStart||p.inBedStart||p.startDate), e = parseAnyHK(p.sleepEnd||p.inBedEnd||p.endDate);
          const toMinU = v => v==null? 0 : (units.startsWith("min") || v>24 ? Number(v) : Number(v)*60);
          const tot = toMinU(p.totalSleep ?? p.asleep);
          const key = e ? dateKey(new Date(e.getTime()+8*36e5)) : day;
          if(tot < 90) continue;
          A.zsleep[key] = {asleep:tot, deep:toMinU(p.deep), rem:toMinU(p.rem), on: s || new Date(fromKey(key).getTime()-60*6e4), off: e || new Date(fromKey(key).getTime()+7*60*6e4)};
        } else if(p.startDate && p.endDate){
          const s = parseAnyHK(p.startDate), e = parseAnyHK(p.endDate); if(!s||!e) continue;
          const v = String(p.value||""), sh = s.getHours(); if(sh>=11 && sh<19) continue; if(/awake/i.test(v)) continue;
          const key = dateKey(new Date(e.getTime()+8*36e5)), src = p.source||"HAE";
          const bucket = (A.sleep[key] = A.sleep[key]||{}); const n = bucket[src] = bucket[src] || {asleep:0,inbed:0,on:null,off:null,deep:0,rem:0};
          const mins = (e-s)/6e4;
          if(/in ?bed/i.test(v)){ n.inbed += mins; if(!n.ion||s<n.ion) n.ion=s; if(!n.ioff||e>n.ioff) n.ioff=e; }
          else { n.asleep += mins; if(/deep/i.test(v)) n.deep+=mins; if(/rem/i.test(v)) n.rem+=mins; if(!n.on||s<n.on) n.on=s; if(!n.off||e>n.off) n.off=e; }
        }
        A.sources.add("Health Auto Export"); continue;
      }
      const q = Number(p.qty);
      if(name==="resting_heart_rate" && q>25) (A.rhr[day]=A.rhr[day]||[]).push(q);
      else if(name.includes("heart_rate_variability") && q>0) (A.hrv[day]=A.hrv[day]||[]).push(q);
      else if(name==="step_count" && q>=0){ const b=(A.steps[day]=A.steps[day]||{}); b.HAE=(b.HAE||0)+q; }
      else if((name.includes("body_mass") && !name.includes("index") && !name.includes("lean")) && q>20) A.weight[day] = units.includes("lb")? q*0.4536 : q;
      else if(name.includes("body_fat") && q>0) A.bodyfat[day] = q<1? q*100 : q;
      else if(name==="heart_rate" && p.Min) (A.hr[day]=A.hr[day]||[]).push(Number(p.Min));
      else continue;
      A.sources.add("Health Auto Export");
    }
  }
  for(const w of d.workouts||[]){
    const s = parseAnyHK(w.start); if(!s) continue; const day = dateKey(s); if(day < A.cutoff) continue;
    let min = Number(w.duration)||0; if(min > 400) min = min/60;
    let km = null; const dist = w.distance; if(dist && dist.qty!=null){ const u=String(dist.units||"km").toLowerCase(); km = Number(dist.qty)*(u.startsWith("mi")?1.609:u==="m"?0.001:1); }
    A.workouts.push({date:day, type:String(w.name||"Workout"), min, km});
  }
}
function parseShortcutTxt(text, A){
  const kv = {}, multi = {}; let lastKey = null;
  for(const line of String(text).split(/\r?\n/)){ const i = line.indexOf("=");
    if(i>0){ lastKey = line.slice(0,i).trim().toLowerCase(); kv[lastKey] = line.slice(i+1).trim(); multi[lastKey] = [kv[lastKey]]; }
    else if(lastKey && /\d/.test(line)) multi[lastKey].push(line.trim()); }
  const nums = k => (multi[k]||[]).flatMap(v=>String(v).split(/[;\n]/)).map(v=>{ const m = String(v).replace(",",".").match(/-?\d+(\.\d+)?/); return m? Number(m[0]) : null; }).filter(x=>x!=null);
  const median = a => { if(!a.length) return null; const b=[...a].sort((x,y)=>x-y), m=Math.floor(b.length/2); return b.length%2? b[m] : (b[m-1]+b[m])/2; };
  const num = v => { if(v==null||v==="") return null; const m = String(v).replace(",",".").match(/-?\d+(\.\d+)?/); return m? Number(m[0]) : null; };
  const dt = v => { if(!v) return null; const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2})[:.](\d{2})/); return m? new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]) : null; };
  const day = (kv.date||"").slice(0,10); if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < A.cutoff) return false;
  const s = dt(kv.sleep_start), e = dt(kv.sleep_end);
  const stg = {deep:num(kv.deep), rem:num(kv.rem), light:num(kv.light ?? kv.core), awake:num(kv.awake)};
  if(s && e && e > s && e.getHours() < 13){ const mins = (e-s)/6e4; const zk = dateKey(new Date(e.getTime()+8*36e5));
    const tot = (stg.deep||0)+(stg.rem||0)+(stg.light||0);
    if(mins >= 90 && mins < 16*60 && !A.zsleep[zk]) A.zsleep[zk] = {asleep: tot>=90 && tot<=mins+5 ? tot : mins, deep:stg.deep||0, rem:stg.rem||0, light:stg.light, awake:stg.awake, on:s, off:e}; }
  const hrvs = nums("hrv").filter(x=>x>0 && x<300), rhr = num(kv.rhr), hrv = hrvs.length? mean(hrvs) : null, steps = num(kv.steps), wt = num(kv.weight), kcal = num(kv.kcal);
  if(rhr && rhr>25 && rhr<90) (A.rhr[day]=A.rhr[day]||[]).push(rhr);
  if(hrv && hrv>0 && hrv<300) (A.hrv[day]=A.hrv[day]||[]).push(hrv);
  if(steps!=null && steps>=0) A.zsteps[dateKey(addDays(fromKey(day),-1))] = Math.round(steps);
  if(kcal!=null && kcal>0 && kcal<6000) (A.kcal = A.kcal||{})[dateKey(addDays(fromKey(day),-1))] = Math.round(kcal);
  if(wt && wt>30) A.weight[day] = wt;
  const rrv = nums("rr").filter(x=>x>=6 && x<=35), rr = rrv.length? mean(rrv) : null; if(rr) (A.rr = A.rr||{})[day] = rr;
  const hrn = median(nums("hrn").filter(x=>x>=30 && x<=100)); if(hrn) (A.hrn = A.hrn||{})[day] = hrn;
  const vo2 = nums("vo2").find(x=>x>=20 && x<=90); if(vo2) (A.vo2 = A.vo2||{})[day] = vo2;
  A.sources.add("Apple Shortcuts"); return true;
}
function parseAnyHK(v){ if(!v) return null; const d = /^\d{4}-\d{2}-\d{2} /.test(v) ? parseHK(String(v)) : new Date(v); return isNaN(d) ? null : d; }
function mergeAgg(A, cutoff){
  const days = finalize(A);
  for(const [k,v] of Object.entries(days)) health.days[k] = {...(health.days[k]||{}), ...Object.fromEntries(Object.entries(v).filter(([,x])=>x!=null))};
  for(const k of Object.keys(health.days)) if(k < dateKey(addDays(new Date(), -400))) delete health.days[k];
  const seen = new Set((health.workouts||[]).map(w=>w.date+w.type+Math.round(w.min)));
  health.workouts = [...(health.workouts||[]), ...A.workouts.filter(w=>!seen.has(w.date+w.type+Math.round(w.min)) && !(health.workouts||[]).some(x=>x.manual && x.date===w.date && x.start===w.start))].sort((a,b)=>a.date<b.date?-1:1).slice(-400);
  health.sources = [...new Set([...(health.sources||[]), ...A.sources])];
  health.importedAt = Date.now();
  return Object.keys(days).length;
}
function decodeDrive(p){
  if(p==null) throw new Error("empty file");
  if(typeof p==="string"){ const t = p.trim(); if(t.startsWith("{")||t.startsWith("[")||/^date\s*=/m.test(t)) return t; const bin = atob(t.replace(/\s/g,"")); return new TextDecoder().decode(Uint8Array.from(bin, c=>c.charCodeAt(0))); }
  if(typeof p==="object"){ if(p.data && (p.data.metrics||p.data.workouts)) return JSON.stringify(p); for(const k of ["content","base64Content","contentBase64","fileContent","data","text","body"]) if(typeof p[k]==="string") return decodeDrive(p[k]); }
  throw new Error("unexpected file format");
}
async function syncDrive(manual){
  if(!mcp){ driveState = {status:"off", msg:"Google Drive isn't available in this view."}; return; }
  driveState = {status:"loading", msg:"Looking for your health files in Google Drive…"}; if(tab==="setup") renderSetup();
  const cutoff = dateKey(addDays(new Date(), -120));
  try{
    const since = new Date(Date.now()-5*864e5).toISOString().slice(0,19)+"Z";
    const q = query => mcp.callTool(DRIVE_SERVER, "search_files", {query, pageSize:25, excludeContentSnippets:true}, {cache:false}).then(r=>(r.payload||{}).files||[]).catch(()=>[]);
    let found = await q(`title contains 'health' and modifiedTime > '${since}'`);
    const folders = (await q(`title = 'Oti Health' and mimeType = 'application/vnd.google-apps.folder'`));
    for(const fo of folders) found = found.concat(await q(`parentId = '${fo.id}' and modifiedTime > '${since}'`));
    const inFolder = new Set(); folders.forEach(fo=>found.forEach(f=>{ if(f.parentId===fo.id) inFolder.add(f.id); }));
    const seenIds = new Set();
    const files = found.filter(f=>{ if(seenIds.has(f.id)) return false; seenIds.add(f.id); const t=f.title||""; const typeOk = /\.(txt|json)$/i.test(t) || /json|text\/plain/.test(f.mimeType||""); return typeOk && !/health-raw/i.test(t) && (/health/i.test(t) || inFolder.has(f.id)); }).sort((a,b)=>a.modifiedTime<b.modifiedTime?1:-1);
    const todo = files.filter(f=>manual || health.driveSeen?.[f.id]!==f.modifiedTime).slice(0,5);
    if(!files.length){ driveState = {status:"empty", msg:"No health files in Google Drive from the last 5 days. Open WhatsApp once so the Shortcuts automation runs, then tap Sync now."}; return; }
    if(!todo.length){ driveState = {status:"ok", msg:`Up to date. Newest file: ${files[0].title}`}; return; }
    const A = newAgg(cutoff), watchWorkouts = [];
    for(const f of todo.reverse()){
      const res = await mcp.callTool(DRIVE_SERVER, "download_file_content", {fileId:f.id}, {cache:false});
      const txt = decodeDrive(res.payload ?? res.content?.[0]?.text);
      if(txt.trim().startsWith("{")){ const j = JSON.parse(txt); if(j.kind==="oti-workouts"){ watchWorkouts.push(...(j.workouts||[])); if(j.pai && j.date){ health.days[j.date] = {...(health.days[j.date]||{}), pai:j.pai.total, paiB:[j.pai.low, j.pai.mod, j.pai.high], paiMin:j.pai.minutes||null}; } } else parseHAE(j, A); } else parseShortcutTxt(txt, A);
      health.driveSeen = health.driveSeen||{}; health.driveSeen[f.id] = f.modifiedTime;
    }
    const ids = Object.keys(health.driveSeen); if(ids.length>60) for(const id of ids.slice(0, ids.length-60)) delete health.driveSeen[id];
    const n = mergeAgg(A, cutoff), nw = mergeWatchWorkouts(watchWorkouts);
    await saveDoc("health", health); if(watchWorkouts.length) await saveDoc("log", logData);
    driveState = {status:"ok", msg:`Synced ${todo.length} file(s), ${n} day(s) updated${nw?`, ${nw} new workout(s)`:""}.`};
  }catch(e){
    const c = e?.code;
    driveState = {status:"err", msg: c ? calMsg(c).replace(/Google Calendar/g,"Google Drive").replace("Showing your weekly template only.","Health data not synced.") : `Health file couldn't be read: ${e.message||e}`};
  }finally{ render(); }
}

/* ================= sleep zones from the raw upload files (slp, slp_t, slp_e) ================= */
function rawSleepStages(raw){
  const L = k => String(raw[k]||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const v = L("slp"), t = L("slp_t"), e = L("slp_e");
  const dt = s => { const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/); return m? new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0)) : null; };
  const seen = new Set(), S = [];
  for(let i=0;i<Math.min(v.length,t.length);i++){
    const st = /deep|tief/i.test(v[i])?"deep" : /rem/i.test(v[i])?"rem" : /core|kern|light|leicht|asleep/i.test(v[i])?"light" : /awake|wach/i.test(v[i])?"awake" : null;
    const a = dt(t[i]), b = dt(e[i]); if(!st || !a || !b || b<a) continue;
    const id = a.getTime()+st; if(seen.has(id)) continue; seen.add(id); S.push({a, b, st});
  }
  S.sort((x,y)=>x.a-y.a);
  const out = {}; let c = null; const cl = [];
  for(const x of S){ if(c && x.a - c.e <= 3*36e5){ c.e = new Date(Math.max(c.e, x.b)); c.x.push(x); } else { c = {s:x.a, e:x.b, x:[x]}; cl.push(c); } }
  for(const c of cl){ if(c.e - c.s < 2*36e5 || c.e.getHours() >= 14) continue;
    const m = {deep:0, rem:0, light:0, awake:0}; c.x.forEach(x=>m[x.st] += (x.b - x.a + 1000)/6e4);
    if(m.deep + m.rem + m.light < 90) continue;
    out[dateKey(c.e)] = {deep:Math.round(m.deep), rem:Math.round(m.rem), light:Math.round(m.light), awake:Math.round(m.awake)}; }
  return out;
}
async function syncSleepStages(){
  if(!mcp) return 0;
  const from = dateKey(addDays(new Date(), -21));
  const need = Object.entries(health.days).filter(([k,v])=>k>=from && v.sleepMin && !(v.deep>0)).map(([k])=>k);
  if(!need.length) return 0;
  try{
    const since = new Date(Date.now()-23*864e5).toISOString().slice(0,19)+"Z";
    const r = await mcp.callTool(DRIVE_SERVER, "search_files", {query:`title contains 'health-raw-' and modifiedTime > '${since}'`, pageSize:30, excludeContentSnippets:true}, {cache:false});
    health.rawSeen = health.rawSeen || {};
    const files = ((r.payload||{}).files||[]).filter(f=>/^health-raw-\d{4}-\d{2}-\d{2}/.test(f.title||"") && health.rawSeen[f.id]!==f.modifiedTime)
      .filter(f=>{ const d = f.title.slice(11,21), n = dateKey(addDays(fromKey(d),1)); return need.includes(d) || need.includes(n); })
      .sort((a,b)=>a.title<b.title?1:-1).slice(0,6);
    let n = 0;
    for(const f of files){
      try{ const res = await mcp.callTool(DRIVE_SERVER, "download_file_content", {fileId:f.id}, {cache:false});
        const raw = JSON.parse(decodeDrive(res.payload ?? res.content?.[0]?.text));
        for(const [k,s] of Object.entries(rawSleepStages(raw))){ const cur = health.days[k]; if(!cur || cur.deep>0) continue; health.days[k] = {...cur, ...s}; n++; }
        health.rawSeen[f.id] = f.modifiedTime;
      }catch(e){}
    }
    const ids = Object.keys(health.rawSeen); if(ids.length>40) for(const id of ids.slice(0, ids.length-40)) delete health.rawSeen[id];
    if(files.length) await saveDoc("health", health);
    if(n) render();
    return n;
  }catch(e){ return 0; }
}
/* ================= health notes from the "Oti Health" calendar ================= */
async function syncHealthCalendar(){
  if(!mcp) return false;
  try{
    const cr = await mcp.callTool(CAL_SERVER, "list_calendars", {}, {cache:false});
    const cal = ((cr.payload||{}).calendars||[]).find(c=>/oti\s*health/i.test(c.summary||""));
    if(!cal) return false;
    const since = new Date(Date.now()-10*864e5).toISOString(), until = new Date(Date.now()+864e5).toISOString();
    const er = await mcp.callTool(CAL_SERVER, "list_events", {calendarId:cal.id, startTime:since, endTime:until, orderBy:"startTime", pageSize:100, timeZone:"Europe/Berlin"}, {cache:false});
    const evs = parsePayload(er.payload).filter(e=>/date\s*=/.test(e.description||""));
    if(!evs.length){ driveState = {status:"empty", msg:"Calendar Oti Health found, but no health notes yet. Run the shortcut once."}; return true; }
    const A = newAgg(dateKey(addDays(new Date(), -120)));
    for(const e of evs){ const txt = String(e.description).replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&"); parseShortcutTxt(txt, A); }
    const n = mergeAgg(A, dateKey(addDays(new Date(), -120)));
    await saveDoc("health", health);
    driveState = {status:"ok", msg:`Read ${evs.length} health note(s) from the Oti Health calendar, ${n} day(s) updated.`};
    render(); return true;
  }catch(e){ return false; }
}
/* ================= schedule for the morning briefing ================= */
function buildSchedule(n){
  const out = [], start = new Date(); start.setHours(0,0,0,0);
  for(let i=0;i<n;i++){
    const date = addDays(start,i), d = dayFromPlan(date);
    const s = d.session;
    out.push({date:dateKey(date), day:DAY_NAMES[date.getDay()], week:weekIndex(date), wake:fmt(d.wake.wake), coffeeCutoff:profile.coffeeCutoff,
      lastMeal:fmt(lastMealFor(d)), windDown:fmt(isEveningDay(date) ? Math.min(d.bed.bed-60, toMin(habits.evening.time)) : d.bed.bed-60), phoneAway: isEveningDay(date) ? habits.evening.time : null, lightsOut:fmt(d.bed.bed), nextWake:fmt(d.bed.nextWake), lateNight:d.bed.late, afterLate:!!d.afterLate, fastDay:isFast(date), afterFast:isFast(addDays(date,-1)), preFast:isFast(addDays(date,1)),
      commitments:d.busy.map(b=>`${b.t} ${fmt(b.s)}-${fmt(b.e)}`),
      session: s ? {key:s.def.sessionKey, name:s.def.name, sub:s.def.sub||"", start:fmt(s.start), end:fmt(s.end), hard:!!s.def.hard, keySession:!!s.def.keySession, sets:s.def.total, lines:s.def.lines, moved:s.moved?`from ${s.fromDay}`:""} : null,
      conflict: d.conflict||null, microBreak: (m=>m?{start:fmt(m.s), end:fmt(m.e), label: m.g==="mob" ? "Bewegungspause: 5 min Mobility (10 Katze Kuh, 3 World's Greatest Stretch pro Seite, 60 s tiefe Hocke, 5 Hüfte 90/90 pro Seite, 10 Schulterkreise mit Handtuch)" : `Bewegungspause: ${m.reps.replace("per leg","pro Bein")} ${({push:"Liegestütze",pull:"Klimmzüge",legs:"Bulgarian Split Squats"})[m.g]}`}:null)(microBreak(d))});
  }
  return out;
}
window.__buildSchedule = buildSchedule;
async function writeSchedule(force){
  if(!db) return;
  const today = dateKey(new Date());
  try{
    if(!force){ const s = await db.doc("app/schedule").get(); if(s.exists && s.data().generatedFor===today && s.data().planVersion===18) return; }
    await db.doc("app/schedule").set({generatedFor:today, planVersion:18, stepGoal:profile.stepGoal, generatedAt:Date.now(), days:buildSchedule(42),
      profile:{wake:profile.wake, proteinTarget:profile.proteinTarget, maxHr:profile.body.maxHr, weightKg:profile.body.weightKg, goal:profile.body.goal, priority:profile.body.priority, targets:profile.targets, dream:profile.dream, latest:Object.fromEntries(METRICS.map(m=>[m.k, latest(m.k)]))}});
  }catch(e){}
}

/* ================= coach ================= */
async function askCoach(){
  const out = $("#coachOut"), btn = $("#btnCoach"); out.hidden = false; out.textContent = "Thinking…"; btn.disabled = true;
  const last = [...Array(14)].map((_,i)=>dateKey(addDays(new Date(), -13+i))).map(k=>{ const {paiB, paiMin, ...h} = health.days[k]||{}; const L = logData.days[k]; return {date:k, ...h, log: L ? {done:Object.keys(L.done||{}), rpe:L.rpe??null, feel:L.feel??null, protein:L.protein??null, sets:Object.keys(L.sets||{}).length} : null}; });
  const week = buildSchedule(7);
  const prompt = `You are a blunt, evidence based hybrid coach for Oti: male, 25 to 29, 185 cm, ${profile.body.weightKg} kg, max HR ${profile.body.maxHr}. Pastoral assistant, youth leader, theology teacher, drum teacher, worship band leader in Germany. Goal: body recomposition, 5k from ${profile.baselines.t5k} to ${profile.targets.t5k} this block and under 20:00 by summer 2027, plus bodyweight strength (pull ups ${profile.targets.pullups}, push ups ${profile.targets.pushups}, pistols ${profile.targets.pistol} per leg). Dumbbells only 2 × ${dbKg()} kg, used for arms. Tiebreak priority: competing with himself (key runs protected). Eats 2 meals, protein target ${profile.proteinTarget} g. Sleep issue: irregular rhythm, sometimes trouble falling asleep, 2 to 3 coffees.
${LANG==="de"?"Answer in German (Deutsch), informal du. ":""}Rules: first sentence is the most uncomfortable truth in the data. Tag claims [Certain], [Likely] or [Guessing]. Never use dashes as punctuation. No warm up. Max 170 words. Then exactly 3 concrete adjustments for the coming days with day and time.
Test results: ${JSON.stringify(profile.tests)}.
Last 14 days (sleepMin, onset/wakeAt = minutes after midnight, rhr, hrv, steps, weight, log: sets done, done sessions, rpe, feel 1 to 5, protein g): ${JSON.stringify(last)}
Next 7 days plan: ${JSON.stringify(week.map(d=>({date:d.date, day:d.day, session:d.session?`${d.session.name} ${d.session.start}`:"rest", lightsOut:d.lightsOut, commitments:d.commitments})))}`;
  try{ const r = await API.openCoach(prompt); out.textContent = r.prefilled ? (LANG==="de" ? "Claude ist in einem neuen Tab mit deinen Daten geöffnet. Der Text liegt auch in der Zwischenablage." : "Claude opened in a new tab with your data. The prompt is also on your clipboard.") : (LANG==="de" ? "Claude ist geöffnet. Der Text war zu lang für den Link und liegt in der Zwischenablage: dort einfügen." : "Claude opened. The prompt was too long for the link and is on your clipboard: paste it there."); }
  catch(e){ out.textContent = e.code==="not_granted" ? "Coach access was declined for this page." : e.code==="rate_limited" ? "Too many requests. Try again in a minute." : (e.text || "The coach could not answer right now."); }
  finally{ btn.disabled = false; }
}


/* ================= briefing voice ================= */
// voice choice: saved choice first, then Zoe, then the best ranked English voice
function pickVoice(vs, rank){
  const want = logData.ui?.voice;
  return (want && vs.find(v=>v.name===want)) || vs.find(v=>/zoe/i.test(v.name) && /premium|enhanced/i.test(v.name)) || vs.find(v=>/zoe/i.test(v.name)) || (rank ? vs.slice().sort((a,b)=>rank(b)-rank(a))[0] : vs[0]) || null;
}
function fillVoices(){
  const sel = $("#voiceSel"), ss = window.speechSynthesis; if(!sel || !ss) return;
  const draw = ()=>{
    const vs = ss.getVoices().filter(v=>/^en/i.test(v.lang)).sort((a,b)=>a.name.localeCompare(b.name));
    if(!vs.length){ sel.innerHTML = `<option>Loading voices…</option>`; return; }
    const cur = pickVoice(vs, v=>(/premium/i.test(v.name)?40:0)+(/enhanced/i.test(v.name)?30:0));
    sel.innerHTML = vs.map(v=>`<option value="${esc(v.name)}"${cur&&v.name===cur.name?" selected":""}>${esc(v.name)} · ${esc(v.lang)}</option>`).join("");
  };
  draw(); ss.onvoiceschanged = draw;
  sel.onchange = async ()=>{ logData.ui = {...(logData.ui||{}), voice: sel.value}; await saveDoc("log", logData);
    try{ ss.cancel(); const u = new SpeechSynthesisUtterance("Hi Oti, this is your coach."); const v = ss.getVoices().find(x=>x.name===sel.value); if(v){ u.voice = v; u.lang = v.lang; } u.rate = 0.96; ss.speak(u); }catch(e){} };
}
function speakBriefing(btn){
  const ss = window.speechSynthesis;
  if(!ss || !window.SpeechSynthesisUtterance){ btn.textContent = tr("No voice on this device"); return; }
  if(ss.speaking || ss.pending){ ss.cancel(); btn.textContent = tr("▶ Play"); return; }
  const raw = briefing.spoken || (briefing.lines||[]).join(". ") || briefing.text || "";
  const txt = raw.replace(/\[(Certain|Likely|Guessing)\]\s*/gi,"").replace(/\s*·\s*/g,", ").replace(/\bHR\b/g,"heart rate").replace(/\bHRV\b/g,"H R V").replace(/\bRPE\b/g,"effort");
  const parts = txt.match(/[^.!?\n]+[.!?]?/g)?.map(x=>x.trim()).filter(Boolean) || [txt];
  // group sentences into chunks of about 220 characters: fewer gaps than one utterance per sentence, and iOS still reads them reliably
  const chunks = []; for(const p of parts){ const last = chunks[chunks.length-1]; if(last && last.length + p.length < 220) chunks[chunks.length-1] = last + " " + p; else chunks.push(p); }
  const vs = ss.getVoices().filter(v=>/^en/i.test(v.lang));
  const NICE = /(Ava|Zoe|Evan|Nathan|Tom|Allison|Susan|Serena|Jamie|Kate|Oliver|Daniel|Arthur|Samantha|Karen|Moira|Aaron|Nicky)/i;
  const rank = v => (/premium/i.test(v.name)?40:0) + (/enhanced|natural|neural/i.test(v.name)?30:0) + (NICE.test(v.name)?10:0) + (/en-(US|GB)/i.test(v.lang)?5:0) + (/compact|eloquence|novelty|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|flo|reed|sandy|eddy/i.test(v.name)?-100:0);
  const voice = pickVoice(vs, rank);
  chunks.forEach((t,i)=>{ const u = new SpeechSynthesisUtterance(t); u.lang = voice?.lang || "en-GB"; if(voice) u.voice = voice; u.rate = 0.96; u.pitch = 1;
    if(i===chunks.length-1) u.onend = ()=>{ btn.textContent = tr("▶ Play"); }; u.onerror = ()=>{ btn.textContent = tr("▶ Play"); }; ss.speak(u); });
  btn.textContent = tr("■ Stop");
}

/* ================= language: English by default, German on request ================= */
const ORIG = new WeakMap();
const NUM_RE = /[+\-−±]?\d+(?:[.,:]\d+)*/g;
const DATEW = {Mon:"Mo",Tue:"Di",Wed:"Mi",Thu:"Do",Fri:"Fr",Sat:"Sa",Sun:"So",Monday:"Montag",Tuesday:"Dienstag",Wednesday:"Mittwoch",Thursday:"Donnerstag",Friday:"Freitag",Saturday:"Samstag",Sunday:"Sonntag",
  Jan:"Jan.",Feb:"Feb.",Mar:"März",Apr:"Apr.",May:"Mai",Jun:"Juni",Jul:"Juli",Aug:"Aug.",Sep:"Sept.",Sept:"Sept.",Oct:"Okt.",Nov:"Nov.",Dec:"Dez.",
  January:"Januar",February:"Februar",March:"März",April:"April",June:"Juni",July:"Juli",August:"August",September:"September",October:"Oktober",November:"November",December:"Dezember",to:"bis"};
const DATE_TOK = new RegExp("[+\\-−±]?\\d+(?:[.,:]\\d+)*|\\b(?:"+Object.keys(DATEW).filter(w=>w!=="to").sort((a,b)=>b.length-a.length).join("|")+")\\b","g");
const dd = x=>x.replace(/\b(\d{1,2}) (?=(Jan|Feb|März|Apr|Mai|Juni|Juli|Aug|Sept|Okt|Nov|Dez|Januar|Februar|April|August|September|Oktober|November|Dezember)\b)/g,"$1. ");
function deNum(x){ return /^[+\-−±]?\d+\.\d{1,2}$/.test(x) ? x.replace(".",",") : x; }
function tr(str){
  if(LANG!=="de" || str==null) return str;
  const m = String(str).match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2];
  if(!core || !/[A-Za-z]/.test(core)) return str;
  if(DE[core]!=null) return m[1]+DE[core]+m[3];
  const fill = (tpl, toks)=>tpl.replace(/\{(\d+)\}/g,(_,i)=>{ const t = toks[i]??""; return DATEW[t] || deNum(t); });
  let toks = []; let key = core.replace(NUM_RE, x=>{ toks.push(x); return "{"+(toks.length-1)+"}"; });
  if(DE[key]!=null) return m[1]+fill(DE[key],toks)+m[3];
  toks = []; key = core.replace(DATE_TOK, x=>{ toks.push(x); return "{"+(toks.length-1)+"}"; });
  if(DE[key]!=null) return m[1]+dd(fill(DE[key],toks))+m[3];
  const words = core.match(/[A-Za-z]+/g)||[];
  if(words.every(w=>DATEW[w])) return m[1]+dd(core.replace(/[A-Za-z]+/g,w=>DATEW[w]).replace(/\.\./g,"."))+m[3];
  for(const [a,b] of DE_PREFIX) if(core.startsWith(a)) return m[1]+b+core.slice(a.length)+m[3];
  return str;
}
function trNode(root){
  if(LANG!=="de" || !root) return;
  if(root.nodeType===3){ const p = root.parentElement; if(p && !p.closest("[data-notr],script,style,textarea")){ const t = tr(root.nodeValue); if(t!==root.nodeValue){ if(!ORIG.has(root)) ORIG.set(root, root.nodeValue); root.nodeValue = t; } } return; }
  if(root.nodeType!==1 || root.closest?.("[data-notr],script,style,textarea")) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode:n=>n.parentElement?.closest("[data-notr],script,style,textarea")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  let n; while((n = tw.nextNode())){ const t = tr(n.nodeValue); if(t!==n.nodeValue){ if(!ORIG.has(n)) ORIG.set(n, n.nodeValue); n.nodeValue = t; } }
  const els = [root, ...root.querySelectorAll("[placeholder],[aria-label],[title]")];
  for(const el of els) for(const a of ["placeholder","aria-label","title"]){ const v = el.getAttribute?.(a); if(v){ const t = tr(v); if(t!==v){ el.setAttribute("data-o-"+a, el.getAttribute("data-o-"+a) || v); el.setAttribute(a, t); } } }
}
