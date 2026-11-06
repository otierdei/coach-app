/* Layout check (06.11.2026): on a phone, if anything is wider than the screen, show which element it is,
   so Oti can send a screenshot. Tap the box to hide it. Remove once the iPhone layout is confirmed. */
"use strict";
(function(){
  if(!matchMedia("(pointer:coarse)").matches) return;
  function desc(el){ const c = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || "").trim().split(/\s+/).slice(0,2).join("."); return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (c ? "." + c : ""); }
  function check(){
    const W = document.documentElement.clientWidth, wrap = document.querySelector(".wrap"); if(!wrap) return;
    const bad = [...wrap.querySelectorAll("*")].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > W + 1; });
    const leaves = bad.filter(el => !bad.some(o => o !== el && el.contains(o)));
    let box = document.getElementById("layoutDiag");
    if(!leaves.length && shown) return;
    shown = true;
    if(!box){ box = document.createElement("div"); box.id = "layoutDiag"; box.onclick = () => { box.remove(); clearInterval(t); }; document.body.appendChild(box); }
    const v = document.querySelector("section.view:not([hidden])");
    box.textContent = "Layout check (screenshot for Claude): screen " + W + ", view " + (v ? v.id : "?") + ", scale " + (window.visualViewport ? visualViewport.scale.toFixed(2) : "?") + "\n" +
      "build b3 · " + [".wrap","main","section.view:not([hidden])","section.view:not([hidden]) > *","#v-today .crings","#v-today .cring"].map(q => { const e = document.querySelector(q); return e ? q.replace("section.view:not([hidden])","view").replace("#v-today ","") + " " + Math.round(e.getBoundingClientRect().left) + "/" + Math.round(e.getBoundingClientRect().width) + " " + getComputedStyle(e).display : ""; }).filter(Boolean).join(" · ") + "\n" +
      (leaves.length ? "" : "nothing wider than the screen") +
      leaves.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width).slice(0, 4).map(el => { const r = el.getBoundingClientRect(); const p = el.parentElement; return desc(p) + " > " + desc(el) + " " + Math.round(r.width) + "px to " + Math.round(r.right) + " \"" + (el.textContent || "").trim().slice(0, 30) + "\""; }).join("\n");
  }
  let shown = false;
  const t = setInterval(check, 3000);
})();
