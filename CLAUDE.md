# Coach App: Hinweise für Claude

## Codekarte zuerst (Graphify)
Bevor du Dateien liest oder durchsuchst, baue die Codekarte. Das dauert etwa 2 Sekunden und braucht kein LLM:

    pip install --break-system-packages -q graphifyy
    graphify update .

Dann `graphify-out/GRAPH_REPORT.md` lesen. Für gezielte Fragen:

    graphify query "protein"
    graphify explain "renderToday()"

Die Karte zeigt, wo Funktionen definiert sind und wer sie aufruft. Aufrufe über Event Handler und HTML Strings fehlen oft. Vor einer Änderung deshalb die betroffene Stelle zusätzlich mit grep prüfen.

`graphify-out/` wird nicht eingecheckt (öffentliches Repo auf GitHub Pages, und die Karte wäre sonst schnell veraltet).
