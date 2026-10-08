"""Regroupement en zones et diagnostic de couverture.

Une "zone" = composante connexe du graphe des liens "même-zone". Ce n'est
PAS forcément une pièce : deux pièces vues l'une depuis l'autre (porte
ouverte, espace ouvert) peuvent fusionner. Le nom de la pièce reste à
attribuer (vision IA ou humain) et n'est jamais deviné ici.
"""
from __future__ import annotations

from collections import defaultdict

from .ingest import PhotoInfo, hamming
from .matching import PairResult

DUPLICATE_HAMMING = 4

# Seuils de faisabilité d'une reconstruction géométrique (SfM -> splats/maillage)
SFM_MIN_IMAGES = 8  # par zone, avec chaîne de recouvrement
SFM_MIN_PARALLAX_LINKS = 6  # liens forts avec bonne parallaxe


def _components(nodes: list[str], edges: list[tuple[str, str]]) -> list[list[str]]:
    parent = {n: n for n in nodes}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in edges:
        parent[find(a)] = find(b)
    groups = defaultdict(list)
    for n in nodes:
        groups[find(n)].append(n)
    return sorted((sorted(g) for g in groups.values()), key=lambda g: (-len(g), g[0]))


def find_duplicates(photos: list[PhotoInfo]) -> list[tuple[str, str]]:
    dups = []
    for i, a in enumerate(photos):
        for b in photos[i + 1:]:
            if hamming(a.dhash, b.dhash) <= DUPLICATE_HAMMING:
                dups.append((a.id, b.id))
    return dups


def build_report(photos: list[PhotoInfo], pairs: list[PairResult]) -> dict:
    ids = [p.id for p in photos]
    strong = [(p.a, p.b) for p in pairs if p.verdict == "même-zone"]
    zones = _components(ids, strong)

    zone_reports = []
    for idx, members in enumerate(zones, 1):
        mset = set(members)
        internal = [p for p in pairs if p.a in mset and p.b in mset and p.verdict == "même-zone"]
        parallax_links = [p for p in internal if p.parallax == "bonne"]
        uncertain = [
            p.to_dict() for p in pairs
            if p.verdict == "incertain" and ((p.a in mset) != (p.b in mset))
        ]
        if len(members) == 1:
            feasibility = "isolée"
            advice = ("Aucune autre photo ne partage de géométrie vérifiable avec celle-ci. "
                      "Utilisable en vidéo (Mode 1) ou comme point de vue fixe ; "
                      "pour la 3D, il faut 6-10 photos supplémentaires de cet espace "
                      "prises en se déplaçant (pas seulement en pivotant).")
        elif len(members) >= SFM_MIN_IMAGES and len(parallax_links) >= SFM_MIN_PARALLAX_LINKS:
            feasibility = "candidate-sfm"
            advice = ("Recouvrement et parallaxe suffisants pour TENTER une reconstruction "
                      "Structure-from-Motion. Le résultat devra être validé (erreur de "
                      "reprojection, trous) avant toute publication.")
        elif parallax_links:
            feasibility = "points-de-vue-reliés"
            advice = ("Photos reliées mais trop peu nombreuses pour une 3D fiable. "
                      "Visite par points de vue connectés recommandée ; pour la 3D, "
                      f"viser ≥{SFM_MIN_IMAGES} photos en décalant l'appareil de 0,5-1 m entre chaque.")
        else:
            feasibility = "panorama-seulement"
            advice = ("Les photos se recouvrent mais depuis quasiment le même point "
                      "(rotation sans déplacement) : assemblage panoramique possible, "
                      "triangulation 3D impossible.")
        zone_reports.append({
            "zone": f"Z{idx:02d}",
            "label": None,  # à attribuer : jamais deviné par l'analyse géométrique
            "photos": members,
            "strong_links": len(internal),
            "parallax_links": len(parallax_links),
            "feasibility": feasibility,
            "advice": advice,
            "uncertain_links_outside": uncertain,
        })

    n_candidates = sum(z["feasibility"] == "candidate-sfm" for z in zone_reports)
    n_isolated = sum(z["feasibility"] == "isolée" for z in zone_reports)
    if n_candidates == 0:
        mode2 = ("Reconstruction 3D non recommandée avec ce jeu de photos. "
                 "Proposer une visite par points de vue fixes reliés, ou une captation dédiée "
                 "(vidéo lente au smartphone, ~2-3 min par pièce).")
    else:
        mode2 = (f"{n_candidates} zone(s) candidate(s) à une reconstruction ; "
                 "le reste du logement en points de vue fixes.")

    return {
        "summary": {
            "photos": len(photos),
            "zones": len(zones),
            "isolated_photos": n_isolated,
            "sfm_candidate_zones": n_candidates,
            "mode1_cinematic": "possible pour chaque photo exploitable",
            "mode2_interactive": mode2,
        },
        "warnings": [
            "Une zone est un groupe de photos géométriquement liées, pas forcément une pièce unique.",
            "Les motifs répétitifs (carrelage, chaises identiques) peuvent créer de faux liens : "
            "vérifier visuellement les zones avant production.",
            "Aucune dimension réelle n'est mesurée : sans repère métrique (plan, mesure laser), "
            "l'échelle d'une reconstruction est arbitraire.",
            "Les espaces non photographiés sont inconnus et ne seront pas générés.",
        ],
        "photos": [p.to_dict() for p in photos],
        "duplicates": find_duplicates(photos),
        "zones": zone_reports,
        "pairs": [p.to_dict() for p in pairs if p.verdict != "aucun-lien"],
    }
