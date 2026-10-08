"""Validation du Module 1 sur des scènes synthétiques à vérité terrain connue."""
from pathlib import Path

import cv2
import numpy as np

from studio.analysis.__main__ import analyze


def _scene(seed: int, size=(1400, 2000)) -> np.ndarray:
    rng = np.random.default_rng(seed)
    img = np.full((*size, 3), 200, np.uint8)
    for _ in range(400):
        c = tuple(int(x) for x in rng.integers(0, 255, 3))
        x, y = int(rng.integers(0, size[1])), int(rng.integers(0, size[0]))
        if rng.random() < 0.5:
            cv2.rectangle(img, (x, y), (x + int(rng.integers(10, 120)), y + int(rng.integers(10, 120))), c, -1)
        else:
            cv2.circle(img, (x, y), int(rng.integers(5, 60)), c, -1)
    return cv2.GaussianBlur(img, (3, 3), 0)


def _two_plane_view(near: np.ndarray, far: np.ndarray, shift: int) -> np.ndarray:
    """Plan lointain + plan proche décalés différemment => vraie parallaxe."""
    h, w = 900, 1200
    bg = far[200:200 + h, 300 + shift // 3:300 + shift // 3 + w].copy()
    fg = near[300:300 + 500, 400 + shift:400 + shift + 600]
    bg[200:700, 300:900] = fg
    return bg


def test_zones_and_parallax(tmp_path: Path):
    room_a_far, room_a_near, room_b = _scene(1), _scene(2), _scene(3)
    photos = tmp_path / "photos"
    photos.mkdir()
    # Zone A : 3 vues avec déplacement (parallaxe)
    for i, s in enumerate((0, 90, 180)):
        cv2.imwrite(str(photos / f"a{i}.jpg"), _two_plane_view(room_a_near, room_a_far, s))
    # Zone B : 2 vues reliées par une homographie pure (rotation caméra)
    v1 = room_b[200:1100, 200:1400]
    H = np.array([[1.02, 0.03, -40], [-0.02, 1.0, 25], [1e-5, 0, 1]])
    v2 = cv2.warpPerspective(v1, H, (v1.shape[1], v1.shape[0]))
    cv2.imwrite(str(photos / "b0.jpg"), v1)
    cv2.imwrite(str(photos / "b1.jpg"), v2)
    # Photo isolée
    cv2.imwrite(str(photos / "c0.jpg"), _scene(4)[0:900, 0:1200])

    report = analyze(photos)
    zones = {tuple(z["photos"]): z for z in report["zones"]}
    # P01-P03 = a*, P04-P05 = b*, P06 = c0
    assert ("P01", "P02", "P03") in zones
    assert ("P04", "P05") in zones
    assert ("P06",) in zones
    assert zones[("P06",)]["feasibility"] == "isolée"
    assert zones[("P04", "P05")]["feasibility"] == "panorama-seulement"
    assert zones[("P01", "P02", "P03")]["parallax_links"] >= 1
    assert all(z["label"] is None for z in report["zones"])
    # Aucun lien, même incertain, entre scènes différentes
    groups = [{"P01", "P02", "P03"}, {"P04", "P05"}]
    for p in report["pairs"]:
        assert any({p["a"], p["b"]} <= g for g in groups), p
