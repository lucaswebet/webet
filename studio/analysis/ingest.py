"""Chargement des photos et contrôle qualité individuel.

Ne mesure que ce qui est observable dans le fichier : résolution, EXIF,
netteté, exposition, quasi-doublons. Aucune hypothèse sur la pièce ou les
dimensions réelles.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ExifTags

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}
WORK_MAX_SIDE = 1600  # résolution de travail pour l'analyse (pas pour la vidéo)

BLUR_THRESHOLD = 60.0  # variance du Laplacien en dessous = image floue
DARK_THRESHOLD = 50  # luminance moyenne (0-255)
BRIGHT_THRESHOLD = 215


@dataclass
class PhotoInfo:
    id: str
    path: str
    width: int
    height: int
    camera: str | None = None
    focal_length_mm: float | None = None
    focal_35mm: float | None = None
    sharpness: float = 0.0
    mean_luma: float = 0.0
    dhash: str = ""
    flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def list_photos(folder: Path) -> list[Path]:
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS)


def _read_exif(path: Path) -> dict:
    try:
        with Image.open(path) as im:
            raw = im.getexif()
            data = {ExifTags.TAGS.get(k, k): v for k, v in raw.items()}
            # FocalLength etc. vivent dans le sous-IFD Exif
            data.update({ExifTags.TAGS.get(k, k): v for k, v in raw.get_ifd(0x8769).items()})
            return data
    except Exception:
        return {}


def load_work_image(path: Path) -> np.ndarray:
    """Image BGR redimensionnée, orientation EXIF appliquée."""
    with Image.open(path) as im:
        im = im.convert("RGB")
        try:
            from PIL import ImageOps
            im = ImageOps.exif_transpose(im)
        except Exception:
            pass
        im.thumbnail((WORK_MAX_SIDE, WORK_MAX_SIDE))
        return cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)


def dhash(gray: np.ndarray, size: int = 8) -> str:
    small = cv2.resize(gray, (size + 1, size), interpolation=cv2.INTER_AREA)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return "".join("1" if b else "0" for b in bits)


def hamming(a: str, b: str) -> int:
    return sum(x != y for x, y in zip(a, b))


def inspect_photo(path: Path, photo_id: str) -> tuple[PhotoInfo, np.ndarray]:
    exif = _read_exif(path)
    img = load_work_image(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    with Image.open(path) as im:
        w, h = im.size

    def _f(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    camera = " ".join(str(exif[k]).strip() for k in ("Make", "Model") if exif.get(k)) or None
    info = PhotoInfo(
        id=photo_id,
        path=str(path),
        width=w,
        height=h,
        camera=camera,
        focal_length_mm=_f(exif.get("FocalLength")),
        focal_35mm=_f(exif.get("FocalLengthIn35mmFilm")),
        sharpness=float(cv2.Laplacian(gray, cv2.CV_64F).var()),
        mean_luma=float(gray.mean()),
        dhash=dhash(gray),
    )
    if info.sharpness < BLUR_THRESHOLD:
        info.flags.append("floue")
    if info.mean_luma < DARK_THRESHOLD:
        info.flags.append("sous-exposée")
    elif info.mean_luma > BRIGHT_THRESHOLD:
        info.flags.append("surexposée")
    if max(w, h) < 1280:
        info.flags.append("basse-résolution (<1280px) : qualité vidéo limitée")
    if info.focal_length_mm is None:
        info.flags.append("pas d'EXIF focale : calibration caméra inconnue")
    return info, gray
