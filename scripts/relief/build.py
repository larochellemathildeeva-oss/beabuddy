#!/usr/bin/env python3
"""
Build the Home map's terrain tiles (public/relief/{z}/{x}/{y}.webp) from
Natural Earth II with Shaded Relief, Land Cover and Water — public domain,
https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-2/

  curl -O https://naciscdn.org/naturalearth/10m/raster/NE2_HR_LC_SR_W.zip
  unzip NE2_HR_LC_SR_W.zip
  pip install pillow numpy
  python3 scripts/relief/build.py NE2_HR_LC_SR_W.tif

Web Mercator tiles, 256 px, zoom MIN_Z to MAX_Z, as the map projects them
(TripRouteMap.tsx). The sea is repainted one pale colour, so the map reads
as land on paper; the moods tint the whole picture in CSS. A tile with no
land is not written: the map draws the sea colour under every tile, and
asks only for the tiles listed in index.json ({"z": ["x/y", …]}).
"""

import json
import math
import os
import sys

import numpy as np
from PIL import Image

MIN_Z = 2
MAX_Z = 6
TILE = 256
SEA = np.array([226, 233, 235], dtype=np.float32)
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "relief")
MAX_LAT = 85.0511287798


def lat_of(y_norm: np.ndarray) -> np.ndarray:
    """Latitude at a Web Mercator y in 0 (north) … 1 (south)."""
    return np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * y_norm))))


def main(path: str) -> None:
    Image.MAX_IMAGE_PIXELS = None
    src = np.asarray(Image.open(path).convert("RGB"), dtype=np.uint8)
    height, width, _ = src.shape
    written = 0
    size = 0
    for z in range(MIN_Z, MAX_Z + 1):
        n = 2**z
        world = n * TILE
        # Each zoom reads a copy of the source no sharper than it draws.
        scale = min(1.0, (world / width) * 1.5)
        if scale < 1.0:
            small = Image.fromarray(src).resize(
                (max(1, round(width * scale)), max(1, round(height * scale))),
                Image.LANCZOS,
            )
            level = np.asarray(small, dtype=np.uint8)
        else:
            level = src
        lh, lw, _ = level.shape
        lper_deg = lw / 360.0
        for ty in range(n):
            ys = (ty * TILE + np.arange(TILE) + 0.5) / world
            lats = lat_of(ys)
            rows = np.clip((90.0 - lats) * lper_deg, 0, lh - 1)
            r0 = np.floor(rows).astype(int)
            r1 = np.minimum(r0 + 1, lh - 1)
            fr = (rows - r0)[:, None, None]
            for tx in range(n):
                xs = (tx * TILE + np.arange(TILE) + 0.5) / world
                cols = np.clip(xs * 360.0 * lper_deg, 0, lw - 1)
                c0 = np.floor(cols).astype(int)
                c1 = np.minimum(c0 + 1, lw - 1)
                fc = (cols - c0)[None, :, None]
                def at(rr, cc):
                    return level[rr[:, None], cc[None, :]].astype(np.float32)

                top = at(r0, c0) * (1 - fc) + at(r0, c1) * fc
                bottom = at(r1, c0) * (1 - fc) + at(r1, c1) * fc
                tile = top * (1 - fr) + bottom * fr
                r, g, b = tile[..., 0], tile[..., 1], tile[..., 2]
                # Natural Earth's water is blue: bluer than it is red, and
                # not greener than blue. Snow and shadow are grey, not blue.
                water = np.clip((b - r - 12.0) / 18.0, 0, 1) * (b >= g - 4)
                if (water < 0.5).mean() < 0.004:
                    continue
                tile = tile * (1 - water[..., None]) + SEA * water[..., None]
                folder = os.path.join(OUT, str(z), str(tx))
                os.makedirs(folder, exist_ok=True)
                out = os.path.join(folder, f"{ty}.webp")
                Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)).save(
                    out, "WEBP", quality=72, method=6
                )
                written += 1
                size += os.path.getsize(out)
        print(f"z{z}: {written} tiles so far, {size / 1e6:.1f} MB", flush=True)
    write_index()


def write_index() -> None:
    """index.json: the tiles that exist, so the map never asks for open sea."""
    index: dict[str, list[str]] = {}
    for z in sorted(os.listdir(OUT), key=lambda d: int(d) if d.isdigit() else -1):
        folder = os.path.join(OUT, z)
        if not z.isdigit() or not os.path.isdir(folder):
            continue
        keys = []
        for x in os.listdir(folder):
            for name in os.listdir(os.path.join(folder, x)):
                if name.endswith(".webp"):
                    keys.append(f"{x}/{name[:-5]}")
        index[z] = sorted(keys, key=lambda k: tuple(int(p) for p in k.split("/")))
    with open(os.path.join(OUT, "index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
