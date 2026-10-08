"""Relations spatiales entre photos par appariement géométrique.

Pour chaque paire : points SIFT + test du ratio de Lowe, puis vérification
RANSAC d'une matrice fondamentale (géométrie épipolaire). Seuls les inliers
géométriquement cohérents comptent ; une simple ressemblance visuelle
(mêmes couleurs, même style) ne crée pas de lien.

On compare aussi une homographie : si elle explique presque tous les inliers,
les deux vues partagent quasiment le même centre optique (rotation pure) ou
regardent un plan unique -> peu de parallaxe, donc peu exploitable pour une
triangulation 3D, même si les photos montrent bien la même pièce.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from itertools import combinations

import cv2
import numpy as np

N_FEATURES = 4000
RATIO = 0.75
STRONG_INLIERS = 60
WEAK_INLIERS = 25


@dataclass
class PairResult:
    a: str
    b: str
    tentative: int
    inliers: int
    homography_ratio: float  # inliers H / inliers F (≈1 => faible parallaxe)
    verdict: str  # "même-zone" | "incertain" | "aucun-lien"
    parallax: str  # "bonne" | "faible" | "n/a"

    def to_dict(self) -> dict:
        return asdict(self)


def extract(gray: np.ndarray):
    sift = cv2.SIFT_create(nfeatures=N_FEATURES)
    kps, desc = sift.detectAndCompute(gray, None)
    pts = np.float32([k.pt for k in kps]) if kps else np.empty((0, 2), np.float32)
    return pts, desc


def match_pair(fa, fb) -> tuple[int, int, float]:
    (pa, da), (pb, db) = fa, fb
    if da is None or db is None or len(da) < 8 or len(db) < 8:
        return 0, 0, 0.0
    flann = cv2.FlannBasedMatcher({"algorithm": 1, "trees": 5}, {"checks": 64})
    knn = flann.knnMatch(da, db, k=2)
    good = [m[0] for m in knn if len(m) == 2 and m[0].distance < RATIO * m[1].distance]
    if len(good) < 8:
        return len(good), 0, 0.0
    src = pa[[m.queryIdx for m in good]]
    dst = pb[[m.trainIdx for m in good]]
    _, mask_f = cv2.findFundamentalMat(src, dst, cv2.USAC_MAGSAC, 1.5, 0.999, 10000)
    inl_f = int(mask_f.sum()) if mask_f is not None else 0
    _, mask_h = cv2.findHomography(src, dst, cv2.USAC_MAGSAC, 3.0)
    inl_h = int(mask_h.sum()) if mask_h is not None else 0
    ratio = inl_h / inl_f if inl_f else 0.0
    return len(good), inl_f, ratio


def classify(inliers: int, h_ratio: float) -> tuple[str, str]:
    if inliers >= STRONG_INLIERS:
        verdict = "même-zone"
    elif inliers >= WEAK_INLIERS:
        verdict = "incertain"
    else:
        return "aucun-lien", "n/a"
    parallax = "faible" if h_ratio > 0.85 else "bonne"
    return verdict, parallax


def match_all(features: dict[str, tuple]) -> list[PairResult]:
    results = []
    for a, b in combinations(sorted(features), 2):
        tent, inl, ratio = match_pair(features[a], features[b])
        verdict, parallax = classify(inl, ratio)
        results.append(PairResult(a, b, tent, inl, round(ratio, 3), verdict, parallax))
    return results
