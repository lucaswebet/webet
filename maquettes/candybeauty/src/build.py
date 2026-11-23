"""Assemble la maquette CandyBeauty.

Injecte ../products.json dans page.html et écrit ../index.html (document complet
à ouvrir dans un navigateur). Si un chemin est passé en argument, y écrit aussi
la version « fragment » (sans <html>/<head>) utilisée pour la page de partage.
"""
import json
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
data = json.dumps(json.load(open(here.parent / "products.json")), ensure_ascii=False).replace("</", "<\\/")
page = (here / "page.html").read_text().replace("/*__DATA__*/", data)
head = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '</head>\n<body>\n')
(here.parent / "index.html").write_text(head + page + "\n</body>\n</html>\n")
if len(sys.argv) > 1:
    pathlib.Path(sys.argv[1]).write_text(page)
print("ok")
