#!/usr/bin/env python3
"""
Build the World globe's Earth pictures (public/earth/day.webp, night.webp).

Sources, both NASA and public domain, as shipped in the three-globe npm
package's examples (npm pack three-globe; package/example/img/):
  earth-blue-marble.jpg  NASA Blue Marble with bathymetry, 4096 x 2048
  earth-night.jpg        NASA Earth at Night (Black Marble), 4096 x 2048

  pip install pillow numpy
  python3 scripts/earth/build.py path/to/example/img

The day picture's sea is recoloured from navy to the mockup's teal blue
(deeper water darker); land gets a touch more contrast. The night picture is
turned from moonlit blue to charcoal with warm city lights. Equirectangular.
"""

import os
import sys

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "earth")
DEEP = np.array([34, 92, 128], np.float32)
SHALLOW = np.array([100, 172, 188], np.float32)


def main(folder: str) -> None:
    os.makedirs(OUT, exist_ok=True)
    src = np.asarray(Image.open(os.path.join(folder, "earth-blue-marble.jpg")).convert("RGB"))
    src = src.astype(np.float32)
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    # Water is bluer than red and not greener than blue; snow and ice are bright.
    water = np.clip((b - r - 3) / 10, 0, 1) * np.clip((b - g + 8) / 10, 0, 1)
    water *= np.clip((150 - lum) / 40, 0, 1)
    water = water[..., None]
    t = np.clip((b - 20) / 150, 0, 1)[..., None] ** 0.7
    ocean = DEEP * (1 - t) + SHALLOW * t
    land = np.clip((src - 128) * 1.08 + 134, 0, 255)
    day = np.clip(land * (1 - water) + ocean * water, 0, 255).astype(np.uint8)
    Image.fromarray(day).save(os.path.join(OUT, "day.webp"), "WEBP", quality=78, method=6)
    src = np.asarray(Image.open(os.path.join(folder, "earth-night.jpg")).convert("RGB"))
    src = src.astype(np.float32)
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    # The source is moonlit blue; Dark wants charcoal land, a near-black sea
    # and warm city lights, as in the mockup.
    lum = (0.3 * r + 0.59 * g + 0.11 * b)[..., None]
    base = lum * np.array([0.62, 0.58, 0.55], np.float32) + np.array([7, 8, 11], np.float32)
    lights = np.clip((r - 0.45 * b - 3) / 30, 0, 1)[..., None] ** 0.8
    gold = np.array([255, 196, 112], np.float32)
    night = np.clip(base * (1 - lights) + gold * lights, 0, 255).astype(np.uint8)
    Image.fromarray(night).save(os.path.join(OUT, "night.webp"), "WEBP", quality=80, method=6)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
