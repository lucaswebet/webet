"""Assemble les maquettes CandyBeauty.

Injecte ../products.json dans chaque page source et écrit des documents complets
à ouvrir dans un navigateur :
  page.html    -> ../index.html  (version 1)
  page-v2.html -> ../v2.html     (version 2)

Option : `python3 build.py DOSSIER` écrit aussi les fragments (sans <html>/<head>)
dans DOSSIER (candybeauty.html et candybeauty-v2.html), pour la page de partage.
"""
import json
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
data = json.dumps(json.load(open(here.parent / "products.json")), ensure_ascii=False).replace("</", "<\\/")
head = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '</head>\n<body>\n')
pages = [("page.html", "index.html", "candybeauty.html"), ("page-v2.html", "v2.html", "candybeauty-v2.html")]
out_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
for src, full, frag in pages:
    page = (here / src).read_text().replace("/*__DATA__*/", data)
    (here.parent / full).write_text(head + page + "\n</body>\n</html>\n")
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / frag).write_text(page)
print("ok")
