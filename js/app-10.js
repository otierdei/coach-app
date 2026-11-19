/* Exercise figures in the training view: a small moving 3D figure instead of a YouTube search.
   three.js, the body and the exercises load on the first tap only (fig/). */
const FIG_V = "20261119a";
// name -> figure; first match wins, so the more specific names come first ("Band hammer curls" before "Hammer curls")
const FIG_RE = [[/band assisted pull/i,"bandpull"],[/band assisted chin/i,"bandchin"],[/pull ups/i,"pullup"],[/chin ups/i,"chinup"],
  [/hanging knee/i,"kneeraise"],[/lying leg raise/i,"legraise"],[/false grip/i,"falsegrip"],[/dead hang/i,"deadhang"],[/chair dips/i,"chairdip"],[/^dips/i,"dips"],
  [/band resisted push/i,"bandpush"],[/close grip push/i,"closepush"],[/archer push/i,"archer"],[/decline push/i,"decline"],[/pike push/i,"pike"],[/^push ups/i,"pushup"],
  [/floor press/i,"floorpress"],[/overhead press/i,"ohpress"],[/overhead triceps/i,"ohtri"],[/triceps pushdown/i,"pushdown"],[/band rows/i,"bandrow"],[/inverted row/i,"invrow"],
  [/hollow/i,"hollow"],[/dead bug/i,"deadbug"],[/bulgarian/i,"bulgarian"],[/reverse lunge/i,"revlunge"],[/step ups/i,"stepup"],[/pistol/i,"pistol"],[/skater squat/i,"skater"],
  [/cossack/i,"cossack"],[/romanian deadlift/i,"slrdl"],[/band hamstring curl/i,"bandham"],[/copenhagen/i,"copenhagen"],[/adductor pull/i,"bandadd"],
  [/broad jump/i,"broad"],[/squat jump/i,"squatjump"],[/band hammer/i,"bandhammer"],[/hammer curl/i,"hammer"],[/band curls/i,"bandcurl"],[/db curls|dumbbell curl|^curls/i,"curl"],
  [/warm up/i,"warmup"]];
const figId = n => (FIG_RE.find(([re])=>re.test(n||""))||[])[1] || null;
let figLoading = null, figCur = null, figTok = 0;
function figLoad(){
  if(figLoading) return figLoading;
  const js = (src, have) => have() ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = `${src}?v=${FIG_V}`; s.onload = ok; s.onerror = () => no(new Error("load " + src)); document.head.appendChild(s); });
  figLoading = js("fig/three-r149.min.js", ()=>window.THREE).then(()=>js("fig/fig3.js", ()=>window.FIG3)).then(()=>js("fig/ex3.js", ()=>window.EX3))
    .then(()=>fetch(`fig/body.json?v=${FIG_V}`)).then(r=>{ if(!r.ok) throw new Error("body " + r.status); return r.json(); })
    .then(m=>{ FIG3.setModel(m); })
    .catch(e=>{ figLoading = null; throw e; });
  return figLoading;
}
function figStop(){ if(figCur){ try{ figCur.dispose(); }catch(e){} figCur = null; } }
function openFigure(name){
  const id = figId(name); if(!id) return;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, tok = ++figTok;
  openSheet(typeof tr==="function" ? tr(name) : name, `<div class="figstage" id="figStage"><span class="small muted" id="figMsg" role="status">${L("Loading the figure…","Figur wird geladen…")}</span></div>
    <div id="figInfo"></div>`, body => {
    figLoad().then(()=>{
      if(tok !== figTok || $("#sheet").hidden || !body.querySelector("#figStage")) return;
      const st = body.querySelector("#figStage"), E = EX3.EX[id]; st.innerHTML = "";
      const w = Math.min(560, st.clientWidth || 340);
      // stage in the app's own tones: dark figure stage in dark mode, floor one step off the stage (19.11.2026)
      const cs = getComputedStyle(st), rgb = (cs.backgroundColor.match(/\d+(\.\d+)?/g)||[255,255,255]).map(Number), dark = (rgb[0]*.299 + rgb[1]*.587 + rgb[2]*.114) < 110;
      const floor = getComputedStyle(document.documentElement).getPropertyValue("--card-3").trim() || null;
      figStop(); figCur = EX3.make(st, id, {w, h: Math.round(w*.82), dark, floor});
      const cv = st.querySelector("canvas"); if(cv){ cv.setAttribute("role","img"); cv.setAttribute("aria-label", L("Moving figure: ","Bewegte Figur: ") + (typeof tr==="function" ? tr(name) : name)); }
      const de = LANG === "de";
      const err = E.err ? (de ? E.err.de : E.err.en) : "";
      body.querySelector("#figInfo").innerHTML = `<div class="figmus"><span class="dot"></span>${esc(de?E.mus.de:E.mus.en)}</div>
        <div class="fighow"><h4>${L("How to","So geht's")}</h4><ol class="figcues">${(de?E.cues.de:E.cues.en).map(c=>`<li>${esc(c)}</li>`).join("")}</ol></div>
        ${err ? `<p class="figerr"><b>${L("Common mistake","Häufiger Fehler")}:</b> ${esc(err)}</p>` : ""}
        <button type="button" class="ghost" id="figPlay"></button>`;
      const pb = body.querySelector("#figPlay"), lab = () => { pb.textContent = figCur && figCur.running ? L("Pause","Pause") : L("Play the movement","Bewegung abspielen"); };
      pb.onclick = () => { if(!figCur) return; figCur.running ? figCur.stop() : figCur.play(); lab(); };
      if(reduce) figCur.draw(1, 0); else figCur.play();
      lab();
    }).catch(()=>{ const m = body.querySelector("#figMsg"); if(m) m.textContent = L("The figure could not be loaded. Check the connection.","Die Figur konnte nicht geladen werden. Prüfe die Verbindung."); });
  });
}
// stop drawing as soon as the sheet closes
new MutationObserver(()=>{ if($("#sheet").hidden) figStop(); }).observe($("#sheet"), {attributes:true, attributeFilter:["hidden"]});
document.addEventListener("click", e=>{ const b = e.target.closest("[data-fig]"); if(b){ e.preventDefault(); openFigure(b.dataset.fig); } });
// replaces the YouTube link in the set blocks
howto = function(n){ return figId(n) ? `<button type="button" class="figbtn" data-fig="${esc(n)}" aria-label="${esc(L("Form: ","Ausführung: ")+n)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>${L("Form","Ausführung")}</button>` : ""; };
