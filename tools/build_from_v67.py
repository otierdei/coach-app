#!/usr/bin/env python3
"""Turns the single file claude.ai artifact (v67) into the static PWA files.
Usage: python3 tools/build_from_v67.py <v67.html> <out_dir>
Only mechanical, listed replacements are made, so every v67 feature stays as it was."""
import sys, re, pathlib

src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
out = pathlib.Path(sys.argv[2])
lines = src.split("\n")

def between(start_pat, end_pat, start_at=0):
    s = next(i for i in range(start_at, len(lines)) if re.search(start_pat, lines[i]))
    e = next(i for i in range(s + 1, len(lines)) if re.search(end_pat, lines[i]))
    return s, e

# ---------- CSS ----------
s, e = between(r"^<style>$", r"^</style>$")
css = "\n".join(lines[s + 1:e])
base = (":root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
        "html{scroll-padding-top:env(safe-area-inset-top,0px)}img{max-width:100%}"
        "[hidden]:not([hidden=until-found i]){display:none!important}\n")
desktop = (out / "desktop.css").read_text(encoding="utf-8")
(out / "styles.css").write_text(base + css + "\n\n" + desktop, encoding="utf-8")

# ---------- markup ----------
ms = next(i for i, l in enumerate(lines) if l.startswith('<div class="wrap">'))
me = next(i for i in range(ms, len(lines)) if lines[i].startswith("</div></nav>"))
markup = "\n".join(lines[ms:me + 1])

# ---------- JS ----------
js_s = next(i for i, l in enumerate(lines) if l.strip() == "<script>")
js_e = next(i for i in range(js_s, len(lines)) if lines[i].strip() == "</script>")
js = "\n".join(lines[js_s + 1:js_e])

REPL = [
    # public repo: no personal calendar IDs in the defaults (the stored profile in Drive holds the real list)
    ('  calendars: ["primary","vcmo1g686p1m9s33tvc6ssvkacc4g9c8@import.calendar.google.com","qvekbuhojrt0nsdfmi9k7nt7oehsjm0v@import.calendar.google.com"],',
     '  calendars: ["primary"],'),
    # Coach prompt goes into a URL now: drop per set ticks and PAI arrays, keep sleep stages, HRV, RHR, sessions, feel, protein
    ('.map(k=>({date:k, ...(health.days[k]||{}), log: logData.days[k]||null}));',
     '.map(k=>{ const {paiB, paiMin, ...h} = health.days[k]||{}; const L = logData.days[k]; return {date:k, ...h, log: L ? {done:Object.keys(L.done||{}), rpe:L.rpe??null, feel:L.feel??null, protein:L.protein??null, sets:Object.keys(L.sets||{}).length} : null}; });'),
    # boot: capabilities come from the api layer instead of window.claude.use
    ('  const use = n => (window.claude?.use ? window.claude.use(n).catch(()=>null) : Promise.resolve(null));\n'
     '  [db, mcp, sample] = await Promise.all([use("db"), use("mcp"), use("sample")]);',
     '  if(window.API && API.configured()){ [db, mcp, sample] = [API.db, API.mcp, API.sample]; }\n'
     '  else { calState = {status:"off", msg:"Connect the backend in Setup (gear icon)."}; driveState = {status:"off", msg:"Connect the backend in Setup (gear icon)."}; }'),
    # Coach button: open claude.ai with the prompt instead of streaming inside the page
    ('  try{ const r = await sample(prompt, {modelTier:"default", onText: ({text}) => { out.textContent = text; }}); out.textContent = r.text; }',
     '  try{ const r = await API.openCoach(prompt); out.textContent = r.prefilled ? (LANG==="de" ? "Claude ist in einem neuen Tab mit deinen Daten geöffnet. Der Text liegt auch in der Zwischenablage." : "Claude opened in a new tab with your data. The prompt is also on your clipboard.") : (LANG==="de" ? "Claude ist geöffnet. Der Text war zu lang für den Link und liegt in der Zwischenablage: dort einfügen." : "Claude opened. The prompt was too long for the link and is on your clipboard: paste it there."); }'),
    ('  const bc = $("#btnCoach"); if(!sample){ bc.disabled = true; bc.textContent = "Coach unavailable here"; }',
     '  const bc = $("#btnCoach");'),
    # Setup: backend card on top, bound after render
    ('<h2>Data and plan</h2></div>', '<h2>Data and plan</h2></div>${window.API ? API.setupCard() : ""}'),
    ('  $("#v-setup").innerHTML = html;\n', '  $("#v-setup").innerHTML = html; if(window.API) API.bindSetup();\n'),
    # first run without backend: open Setup so the connect card is visible
    ('(async function boot(){\n  try{ const t = sessionStorage.getItem("ohc-tab"); if(t) tab = t; }catch(e){}',
     '(async function boot(){\n  try{ const t = sessionStorage.getItem("ohc-tab"); if(t) tab = t; }catch(e){}\n  if(window.API && !API.configured()) tab = "setup";'),
    # texts that pointed at claude.ai connectors
    ('Google Calendar needs reconnecting: claude.ai Settings, Connectors.', 'Backend key rejected: check the key in Setup.'),
    ('Add Google Calendar in claude.ai Settings, Connectors.', 'Connect the backend in Setup (gear icon).'),
]
# public repo: the personal weekly template, dates and one off changes come only from profile.json in Drive
js = re.sub(r'\n  week: \{\n.*?\n  \},\n', '\n  week: {},\n', js, count=1, flags=re.S)
js = re.sub(r'  overrides: \{"2026-09-24": \{[^\n]*\},\n', '  overrides: {},\n', js, count=1)
js = re.sub(r'  footballDates: \[[^\]]*\], football:', '  footballDates: [], football:', js, count=1)
TEXT = {'Backend key rejected: check the key in Setup.', 'Connect the backend in Setup (gear icon).'}
# German texts for the two new backend messages (the keys above were replaced inside the DE dictionary too)
REPL += [
    ('"Backend key rejected: check the key in Setup.": "Google Kalender muss neu verbunden werden: claude.ai Einstellungen, Connectors."',
     '"Backend key rejected: check the key in Setup.": "Backend Schlüssel abgelehnt: prüf den Schlüssel im Setup."'),
    ('"Connect the backend in Setup (gear icon).": "Füge Google Kalender in claude.ai Einstellungen, Connectors hinzu."',
     '"Connect the backend in Setup (gear icon).": "Verbinde das Backend im Setup (Zahnrad)."'),
]
for old, new in REPL:
    n = js.count(old)
    if n != 1 and not (new in TEXT and n >= 1):
        sys.exit(f"replacement expected once, found {n}: {old[:80]!r}")
    js = js.replace(old, new)

header = ("/* Oti Hybrid Coach, GitHub version. Generated from the claude.ai artifact v67 by tools/build_from_v67.py.\n"
          "   db, mcp and sample are provided by api.js (Google Apps Script backend).\n"
          "   The code is split into several classic scripts that share one global scope; load them in order. */\n")
# split into files of at most ~LIMIT bytes, cutting only before a top level declaration or section comment
LIMIT = 40000
js_lines = js.split("\n")
parts, cur, size = [], [], 0
cut_ok = re.compile(r"^(async function |function |const |let |/\* [=\-]{3,})")
for l in js_lines:
    if size > LIMIT and cut_ok.match(l):
        parts.append(cur); cur, size = [], 0
    cur.append(l); size += len(l.encode("utf-8")) + 1
parts.append(cur)
jsdir = out / "js"; jsdir.mkdir(exist_ok=True)
for old in jsdir.glob("app-*.js"): old.unlink()
names = []
for i, part in enumerate(parts, 1):
    n = f"app-{i:02d}.js"; names.append(n)
    (jsdir / n).write_text(header + "\n".join(part) + "\n", encoding="utf-8")
if (out / "app.js").exists(): (out / "app.js").unlink()
app_tags = "\n".join(f'<script src="js/{n}"></script>' for n in names)

# ---------- index.html ----------
html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Oti Hybrid Coach</title>
<meta name="theme-color" content="#F3F5F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#090C11" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Coach">
<meta name="robots" content="noindex">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@500&family=Figtree:wght@400;500;600&display=swap">
<link rel="stylesheet" href="styles.css">
</head>
<body>
{markup}
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" defer></script>
<script src="api.js"></script>
{app_tags}
<script>if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{{}});</script>
</body>
</html>
"""
(out / "index.html").write_text(html, encoding="utf-8")
print("ok", len(css), len(js), names)
(out / "js" / "files.txt").write_text("\n".join(names) + "\n")
