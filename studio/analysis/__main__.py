"""CLI : python -m studio.analysis <dossier_photos> [-o rapport.json]"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .coverage import build_report
from .ingest import inspect_photo, list_photos
from .matching import extract, match_all


def analyze(folder: Path) -> dict:
    paths = list_photos(folder)
    if not paths:
        raise SystemExit(f"Aucune photo trouvée dans {folder}")
    photos, features = [], {}
    for i, path in enumerate(paths, 1):
        pid = f"P{i:02d}"
        info, gray = inspect_photo(path, pid)
        photos.append(info)
        features[pid] = extract(gray)
        print(f"  {pid} {path.name} {info.width}x{info.height} "
              f"{len(features[pid][0])} pts {' '.join(info.flags)}", file=sys.stderr)
    t = time.time()
    pairs = match_all(features)
    print(f"  {len(pairs)} paires comparées en {time.time() - t:.1f}s", file=sys.stderr)
    return build_report(photos, pairs)


def main() -> None:
    ap = argparse.ArgumentParser(description="Analyse d'un jeu de photos immobilières")
    ap.add_argument("folder", type=Path)
    ap.add_argument("-o", "--output", type=Path)
    args = ap.parse_args()
    report = analyze(args.folder)
    out = args.output or args.folder.parent / "output" / "analysis.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    for z in report["zones"]:
        print(f"{z['zone']} [{z['feasibility']}] {', '.join(z['photos'])}")
    print(f"Rapport : {out}")


if __name__ == "__main__":
    main()
