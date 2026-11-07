/* ================= results from the agents (07.11.2026) =================
   Trainer review, property scan and weekly report each leave a notice in the worker (doc "notices").
   Unseen notices sit as tappable rows right under the date on Today. Tap opens the details in a sheet
   (or the Drive document for finance, which never stores amounts in the app); "Done" hides the row.
   A push for a new notice opens the app with ?notice=<id>, which opens the same sheet. */
"use strict";
const NT_SRC = {trainer: ["Trainer", "Trainer", "M4 12h2m12 0h2M7 8v8m10-8v8M9 12h6"],
  immo: ["Property scan", "Immobilienscan", "M4 11l8-6 8 6v8H4z M10 19v-5h4v5"],
  weekly: ["Weekly report", "Wochenbericht", "M5 5h14v14H5z M5 9h14 M9 13h6"],
  monthly: ["Workload review", "Auslastung", "M12 4a8 8 0 1 0 8 8h-8z M14 3v7h7"]};
let ntItems = (()=>{ try{ return JSON.parse(localStorage.getItem("ohc-notices") || "[]"); }catch(e){ return []; } })();
let ntOpenId = new URLSearchParams(location.search).get("notice");
if(ntOpenId) history.replaceState(null, "", location.pathname);

const ntUnseen = () => ntItems.filter(n => n && n.id && !n.seenAt).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
function ntAgo(iso){
  const t = Date.parse(iso || ""); if(!t) return "";
  const d = new Date(t), today = new Date(); const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString()))/864e5);
  const hm = d.toLocaleTimeString(L("en-GB","de-DE"), {hour:"2-digit", minute:"2-digit"});
  return days <= 0 ? hm : days === 1 ? L("yesterday","gestern") : d.toLocaleDateString(L("en-GB","de-DE"), {weekday:"short"});
}
function noticesHtml(){
  const list = ntUnseen().slice(0, 3); if(!list.length) return "";
  return `<section class="ntc" aria-label="${L("New results","Neue Ergebnisse")}">${list.map(n => { const s = NT_SRC[n.source] || ["Result","Ergebnis","M5 12h14"];
    return `<button type="button" class="ntrow" data-notice="${esc(n.id)}"><span class="ntic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${s[2]}"/></svg></span>
      <span class="ntx"><span class="ntk">${esc(L(s[0], s[1]))} · ${esc(L("new","neu"))}${n.createdAt ? " · " + esc(ntAgo(n.createdAt)) : ""}</span><span class="ntt">${esc(n.title || "")}</span>${n.summary ? `<span class="nts">${esc(n.summary)}</span>` : ""}</span>
      <span class="ntgo" aria-hidden="true">›</span></button>`; }).join("")}${ntUnseen().length > 3 ? `<div class="ntmore">+${ntUnseen().length - 3} ${L("more","weitere")}</div>` : ""}</section>`;
}
// small, safe markdown: everything is escaped first; headings, lists, bold, links (https only), paragraphs
function ntMd(src){
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, (m, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`);
  const out = []; let list = null;
  const close = () => { if(list){ out.push(`</${list}>`); list = null; } };
  for(const raw of String(src || "").split(/\r?\n/)){
    const line = raw.trim(); let m;
    if(!line){ close(); continue; }
    if((m = line.match(/^#{1,4}\s+(.*)$/))){ close(); out.push(`<h4>${inline(m[1])}</h4>`); continue; }
    if((m = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/))){ const kind = /^\d/.test(line) ? "ol" : "ul"; if(list !== kind){ close(); out.push(`<${kind}>`); list = kind; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    close(); out.push(`<p>${inline(line)}</p>`);
  }
  close(); return out.join("");
}
function openNotice(id){
  const n = ntItems.find(x => x && x.id === id); if(!n) return false;
  const s = NT_SRC[n.source] || ["Result","Ergebnis"];
  const link = n.link && /^https:\/\//.test(n.link) ? n.link : "";
  const body = `<div class="ntbody"><div class="eyebrow">${esc(L(s[0], s[1]))}${n.createdAt ? " · " + esc(new Date(n.createdAt).toLocaleString(L("en-GB","de-DE"), {weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"})) : ""}</div>
    ${n.summary ? `<p class="ntlead">${esc(n.summary)}</p>` : ""}${n.body ? ntMd(n.body) : ""}
    ${n.reply ? `<p class="small muted">${esc(L("To approve, write in the HQ chat: ","Zum Freigeben im HQ Chat schreiben: "))}<strong>${esc(n.reply)}</strong></p>` : ""}
    <div class="ntact">${link ? `<a class="ghost ntlink" href="${esc(link)}" target="_blank" rel="noopener">${esc(n.body ? L("Full report","Ganzer Bericht") : L("Open report","Bericht öffnen"))} ›</a>` : ""}
    ${n.seenAt ? "" : `<button type="button" class="primary" id="ntDone">${esc(L("Done","Erledigt"))}</button>`}</div></div>`;
  openSheet(n.title || L(s[0], s[1]), body, el => {
    el.querySelector("#ntDone")?.addEventListener("click", async () => { closeSheet(); await noticeSeen(id); });
  });
  return true;
}
async function noticeSeen(id){
  const n = ntItems.find(x => x && x.id === id); if(n) n.seenAt = new Date().toISOString();
  try{ localStorage.setItem("ohc-notices", JSON.stringify(ntItems)); }catch(e){}
  if(tab === "today") render();
  try{ await API.notices.seen(id); }catch(e){ console.warn("notice seen", e); }
}
let ntLoading = null;
async function loadNotices(){
  if(ntLoading || !API.configured()) return ntLoading;
  ntLoading = (async () => {
    try{
      const items = await API.notices.list();
      const changed = JSON.stringify(items) !== JSON.stringify(ntItems);
      ntItems = items; try{ localStorage.setItem("ohc-notices", JSON.stringify(ntItems.slice(-60))); }catch(e){}
      if(changed && tab === "today") render();
    }catch(e){ console.warn("notices", e); }
    finally{ ntLoading = null; }
    if(ntOpenId){ const id = ntOpenId; ntOpenId = null; if(tab !== "today" && typeof switchTab === "function") switchTab("today"); openNotice(id); }
  })();
  return ntLoading;
}
{ const rt = renderToday; renderToday = function(){ const r = rt.apply(this, arguments);
    const v = document.getElementById("v-today"), hd = v && v.querySelector(":scope > .calmhd");
    if(hd && !v.querySelector(":scope > .ntc")){ const h = noticesHtml(); if(h) hd.insertAdjacentHTML("afterend", h); }
    return r; }; }
document.addEventListener("click", e => { const b = e.target.closest("[data-notice]"); if(b) openNotice(b.dataset.notice); });
document.addEventListener("visibilitychange", () => { if(!document.hidden) loadNotices(); });
// a push tapped while the app is open navigates to ?notice=<id>; a full load handles it above
setTimeout(loadNotices, 1500);
