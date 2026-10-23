/* Folding (Oti 23.10.2026): every window folds to one line and stays folded until he opens it again.
   Today first, then Fitness, Tasks, Life and the coach card in Week. One store, "Fold all / Open all" per page. Per device (localStorage). */
const FOLD_KEY = "ohc-fold";
let foldStore = null;
function foldLoad(){ if(foldStore) return foldStore; try{ foldStore = JSON.parse(localStorage.getItem(FOLD_KEY) || "{}") || {}; }catch(e){ foldStore = {}; } return foldStore; }
function foldGet(k){ return !!foldLoad()[k]; }
function foldSet(k, v){ const s = foldLoad(); if(v) s[k] = 1; else delete s[k]; try{ localStorage.setItem(FOLD_KEY, JSON.stringify(s)); }catch(e){} }
const FOLD_CHEV = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

// cards that are built elsewhere get their key here
function foldTag(v){
  const tk = v.querySelector(":scope > [data-tkcard]"); if(tk && !tk.dataset.fold){ tk.dataset.fold = "tasks"; tk.dataset.ftitle = L("Top 3 today","Top 3 heute"); }
  const rh = v.querySelector(":scope > .card [data-goto-life]")?.closest(".card"); if(rh && !rh.dataset.fold){ rh.dataset.fold = "rhythm"; rh.dataset.ftitle = L("Rhythm","Rhythmus"); }
  const tm = v.querySelector("#tomorrowCard"); if(tm && !tm.dataset.fold) tm.dataset.fold = "tomorrow";
}
// summary for cards without one: what is still open
function foldAutoSum(el){
  const ch = [...el.querySelectorAll(".check, .pw-tick")]; if(!ch.length) return "";
  const open = ch.filter(c=>!c.classList.contains("on") && c.getAttribute("aria-pressed")!=="true").length;
  return open ? `${open} ${L("open","offen")}` : L("all done ✓","alles erledigt ✓");
}
function foldApply(el){
  const k = el.dataset.fold, f = foldGet(k);
  if(el.tagName === "DETAILS"){
    el.open = !f;
    if(!el.dataset.fbound){ el.dataset.fbound = 1; el.addEventListener("toggle", ()=>{ if(foldGet(k) === !el.open) return; foldSet(k, !el.open); foldBar(el.closest(".fhost")); }); }
    return;
  }
  el.classList.toggle("folded", f);
  let b = el.querySelector(":scope > .fhd");
  if(!b){ b = document.createElement("button"); b.type = "button"; b.className = "fhd"; el.prepend(b);
    b.addEventListener("click", ()=>{ foldSet(k, !foldGet(k)); foldApply(el); foldBar(el.closest(".fhost")); }); }
  const title = el.dataset.ftitle || "", sum = el.dataset.fsum || foldAutoSum(el);
  b.setAttribute("aria-expanded", String(!f));
  b.setAttribute("aria-label", f ? `${title}: ${L("open","öffnen")}` : `${title}: ${L("fold","zuklappen")}`);
  b.innerHTML = f ? `<span class="fht">${esc(title)}</span>${sum?`<span class="fhs">${esc(sum)}</span>`:""}${FOLD_CHEV}` : FOLD_CHEV;
}
function foldAllEls(v){ return [...v.querySelectorAll("[data-fold]")]; }
// header button: fold all when anything is open, otherwise open all
function foldBar(v){
  v = v || $("#v-today"); const b = v && v.querySelector("#foldAll, [data-fall]"); if(!b) return;
  const keys = foldAllEls(v).map(e=>e.dataset.fold).concat(v.querySelector(".thero") ? ["train"] : []);
  const anyOpen = keys.some(k=>!foldGet(k));
  b.textContent = anyOpen ? L("Fold all","Alle zu") : L("Open all","Alle auf");
  b.setAttribute("aria-label", anyOpen ? L("Fold all windows","Alle Fenster zuklappen") : L("Open all windows","Alle Fenster öffnen"));
  b.onclick = () => { for(const k of keys) foldSet(k, anyOpen); foldAllEls(v).forEach(foldApply); foldTrain(v); foldBar(v); };
}
// the training card has its own one line view; keep it in step with the store
function foldTrain(v){
  const c = v.querySelector(".thero"), t = v.querySelector("#tFold"); if(!c || !t) return;
  const f = foldGet("train"); c.classList.toggle("folded", f); t.setAttribute("aria-expanded", String(!f));
  t.setAttribute("aria-label", f ? L("Show workout","Workout zeigen") : L("Fold workout","Workout zuklappen"));
}
function todayFold(){
  const v = $("#v-today"); if(!v) return;
  // days stay on top (Oti 23.10.): the "Next" line sits under the week strip
  { const n = v.querySelector(":scope > .nextln"), w = v.querySelector(":scope > .wkstrip"); if(n && w && w.nextElementSibling !== n) w.after(n); }
  v.classList.add("fhost"); foldTag(v); foldAllEls(v).forEach(foldApply); foldTrain(v); foldBar(v);
}
// the other pages: cards get a key from their title
const FOLD_VIEWS = {"v-progress":":scope > .card", "v-sleep":":scope > .card", "v-tasks":":scope > div > .card, :scope > div > details.card", "v-life":".ptw > .pw-card, .ptw > details.lmore", "v-week":":scope > details[data-fold]"};
const foldSlug = t => t.toLowerCase().replace(/[^a-z0-9äöüß]+/g,"-").replace(/^-|-$/g,"").slice(0,30);
let foldBusy = false;
function foldView(v){
  if(!v || foldBusy) return; foldBusy = true;
  try{
    v.classList.add("fhost");
    for(const el of v.querySelectorAll(FOLD_VIEWS[v.id])){
      if(el.dataset.fold){ if(!el.dataset.fold.includes(":")) el.dataset.fold = v.id + ":" + el.dataset.fold; continue; }
      const h = el.tagName === "DETAILS" ? el.querySelector(":scope > summary") : (el.querySelector("h3") || el.querySelector("h2") || el.querySelector(".eyebrow"));
      const hs = h && el.tagName === "DETAILS" ? (h.querySelector("span") || h) : h;
      const t = (hs?.childNodes[0]?.textContent || hs?.textContent || "").trim().split("\n")[0];
      if(!t || el.querySelector("#foldAll")) continue;
      el.dataset.fold = v.id + ":" + foldSlug(t); if(el.tagName !== "DETAILS") el.dataset.ftitle = t;
    }
    const els = foldAllEls(v); if(!els.length) return;
    if(v.id !== "v-week" && !v.querySelector(":scope > .fallbar")){ const d = document.createElement("div"); d.className = "fallbar"; d.innerHTML = `<button type="button" class="ghost fall" data-fall></button>`; v.prepend(d); }
    els.forEach(foldApply); foldBar(v);
  } finally { foldBusy = false; }
}
for(const id of Object.keys(FOLD_VIEWS)){ const v = document.getElementById(id); if(!v) continue;
  new MutationObserver(()=>{ if(!foldBusy) queueMicrotask(()=>foldView(v)); }).observe(v, {childList:true}); }
{ const rt = renderToday; renderToday = function(){ const r = rt.apply(this, arguments); todayFold(); return r; }; }
// the old per day fold of the workout card moves into the new store once
try{ const old = localStorage.getItem("ohc-tfold"); if(old){ if(old === dateKey(new Date())) foldSet("train", true); localStorage.removeItem("ohc-tfold"); } }catch(e){}
