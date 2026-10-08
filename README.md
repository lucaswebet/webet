# AI Real Estate 3D Studio

Transforme les photos d'un logement en visite vidéo cinématique (Higgsfield) et, quand les données le permettent, en visite 3D interactive.

Architecture, limites et coûts : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Module 1 — Analyse des photos

```bash
pip install -r requirements.txt
# déposer les photos dans data/properties/<bien>/photos/ (non versionnées)
python -m studio.analysis data/properties/<bien>/photos
python -m pytest -q
```

Produit `data/properties/<bien>/output/analysis.json` : qualité de chaque photo, doublons, zones de photos géométriquement liées, faisabilité 3D par zone et conseils de prise de vue complémentaire.
