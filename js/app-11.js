/* Today (Oti 23.10.2026): every window on the first page folds to one line and stays folded until he opens it again.
   One store for all cards, a button "Fold all / Open all" in the header. Per device (localStorage). */
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
  const ch = [...el.querySelectorAll(".check")]; if(!ch.length) return "";
  const open = ch.filter(c=>!c.classList.contains("on")).length;
  return open ? `${open} ${L("open","offen")}` : L("all done ✓","alles erledigt ✓");
}
function foldApply(el){
  const k = el.dataset.fold, f = foldGet(k);
  if(el.tagName === "DETAILS"){
    el.open = !f;
    if(!el.dataset.fbound){ el.dataset.fbound = 1; el.addEventListener("toggle", ()=>{ if(foldGet(k) === !el.open) return; foldSet(k, !el.open); foldBar(); }); }
    return;
  }
  el.classList.toggle("folded", f);
  let b = el.querySelector(":scope > .fhd");
  if(!b){ b = document.createElement("button"); b.type = "button"; b.className = "fhd"; el.prepend(b);
    b.addEventListener("click", ()=>{ foldSet(k, !foldGet(k)); foldApply(el); foldBar(); }); }
  const title = el.dataset.ftitle || "", sum = el.dataset.fsum || foldAutoSum(el);
  b.setAttribute("aria-expanded", String(!f));
  b.setAttribute("aria-label", f ? `${title}: ${L("open","öffnen")}` : `${title}: ${L("fold","zuklappen")}`);
  b.innerHTML = f ? `<span class="fht">${esc(title)}</span>${sum?`<span class="fhs">${esc(sum)}</span>`:""}${FOLD_CHEV}` : FOLD_CHEV;
}
function foldAllEls(v){ return [...v.querySelectorAll("[data-fold]")]; }
// header button: fold all when anything is open, otherwise open all
function foldBar(){
  const v = $("#v-today"), b = v && v.querySelector("#foldAll"); if(!b) return;
  const keys = foldAllEls(v).map(e=>e.dataset.fold).concat(v.querySelector(".thero") ? ["train"] : []);
  const anyOpen = keys.some(k=>!foldGet(k));
  b.textContent = anyOpen ? L("Fold all","Alle zu") : L("Open all","Alle auf");
  b.setAttribute("aria-label", anyOpen ? L("Fold all windows","Alle Fenster zuklappen") : L("Open all windows","Alle Fenster öffnen"));
  b.onclick = () => { for(const k of keys) foldSet(k, anyOpen); foldAllEls(v).forEach(foldApply); foldTrain(v); foldBar(); };
}
// the training card has its own one line view; keep it in step with the store
function foldTrain(v){
  const c = v.querySelector(".thero"), t = v.querySelector("#tFold"); if(!c || !t) return;
  const f = foldGet("train"); c.classList.toggle("folded", f); t.setAttribute("aria-expanded", String(!f));
  t.setAttribute("aria-label", f ? L("Show workout","Workout zeigen") : L("Fold workout","Workout zuklappen"));
}
function todayFold(){
  const v = $("#v-today"); if(!v) return;
  foldTag(v); foldAllEls(v).forEach(foldApply); foldTrain(v); foldBar();
}
{ const rt = renderToday; renderToday = function(){ const r = rt.apply(this, arguments); todayFold(); return r; }; }
// the old per day fold of the workout card moves into the new store once
try{ const old = localStorage.getItem("ohc-tfold"); if(old){ if(old === dateKey(new Date())) foldSet("train", true); localStorage.removeItem("ohc-tfold"); } }catch(e){}
