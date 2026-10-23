/* Exercise figures in the training view: a small moving 3D figure instead of a YouTube search.
   three.js, the body and the exercises load on the first tap only (fig/). */
const FIG_V = "20261023f";
const FIG_RE = [[/pull ups/i,"pullup"],[/chin ups/i,"chinup"],[/hanging knee/i,"kneeraise"],[/false grip/i,"falsegrip"],[/^dips/i,"dips"],
  [/archer push/i,"archer"],[/decline push/i,"decline"],[/pike push/i,"pike"],[/^push ups/i,"pushup"],[/hollow/i,"hollow"],[/bulgarian/i,"bulgarian"],
  [/pistol/i,"pistol"],[/nordic/i,"nordic"],[/copenhagen/i,"copenhagen"],[/broad jump/i,"broad"],[/hammer curl/i,"hammer"],[/db curls|dumbbell curl|^curls/i,"curl"],
  [/overhead triceps/i,"ohtri"],[/warm up/i,"warmup"]];
const figId = n => (FIG_RE.find(([re])=>re.test(n||""))||[])[1] || null;
let figLoading = null, figCur = null;
function figLoad(){
  if(figLoading) return figLoading;
  const js = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = `${src}?v=${FIG_V}`; s.onload = ok; s.onerror = () => no(new Error("load " + src)); document.head.appendChild(s); });
  figLoading = js("fig/three-r149.min.js").then(()=>js("fig/fig3.js")).then(()=>js("fig/ex3.js"))
    .then(()=>fetch(`fig/body.json?v=${FIG_V}`)).then(r=>{ if(!r.ok) throw new Error("body " + r.status); return r.json(); })
    .then(m=>{ FIG3.setModel(m); })
    .catch(e=>{ figLoading = null; throw e; });
  return figLoading;
}
function figStop(){ if(figCur){ try{ figCur.dispose(); }catch(e){} figCur = null; } }
function openFigure(name){
  const id = figId(name); if(!id) return;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  openSheet(name, `<div class="figstage" id="figStage" role="img" aria-label="${esc(L("Moving figure: ","Bewegte Figur: ")+name)}"><span class="small muted" id="figMsg">${L("Loading the figure…","Figur wird geladen…")}</span></div>
    <div id="figInfo"></div>`, body => {
    figLoad().then(()=>{
      if($("#sheet").hidden || !body.querySelector("#figStage")) return;
      const st = body.querySelector("#figStage"), E = EX3.EX[id]; st.innerHTML = "";
      const w = Math.min(560, st.clientWidth || 340);
      figStop(); figCur = EX3.make(st, id, {w, h: Math.round(w*.82)});
      const de = LANG === "de";
      body.querySelector("#figInfo").innerHTML = `<div class="figmus"><span class="dot"></span>${esc(de?E.mus.de:E.mus.en)}</div>
        <ol class="figcues">${(de?E.cues.de:E.cues.en).map(c=>`<li>${esc(c)}</li>`).join("")}</ol>
        ${reduce?`<button type="button" class="ghost" id="figPlay">${L("Play the movement","Bewegung abspielen")}</button>`:""}`;
      if(reduce){ figCur.draw(1, 0); body.querySelector("#figPlay").onclick = () => figCur && figCur.play(); }
      else figCur.play();
    }).catch(()=>{ const m = body.querySelector("#figMsg"); if(m) m.textContent = L("The figure could not be loaded. Check the connection.","Die Figur konnte nicht geladen werden. Prüfe die Verbindung."); });
  });
}
// stop drawing as soon as the sheet closes
new MutationObserver(()=>{ if($("#sheet").hidden) figStop(); }).observe($("#sheet"), {attributes:true, attributeFilter:["hidden"]});
document.addEventListener("click", e=>{ const b = e.target.closest("[data-fig]"); if(b){ e.preventDefault(); openFigure(b.dataset.fig); } });
// replaces the YouTube link in the set blocks
howto = function(n){ return figId(n) ? `<button type="button" class="figbtn" data-fig="${esc(n)}" aria-label="${esc(L("Show how: ","So geht's: ")+n)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>${L("Form","Ausführung")}</button>` : ""; };
