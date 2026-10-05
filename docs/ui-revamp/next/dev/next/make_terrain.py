#!/usr/bin/env python3
"""
Preview-only: renders a georeferenced aerial picture for the terrain slot
(src/lib/terrain-art.ts) from NASA GIBS "Blue Marble: Shaded Relief and
Bathymetry" (public domain, NASA Earth Observatory), so the slot can be seen
working. It is NOT added to the app: new terrain art ships only once the
owner approves a picture (this one or their own).

  python3 dev/next/make_terrain.py alps 5 43.5 17.5 50.5 [zoom=8]
  -> next-preview/terrain/alps.webp and its TERRAIN_ART entry on stdout
Needs Pillow and network access to gibs.earthdata.nasa.gov.
"""
import io, json, math, os, sys, urllib.request
from PIL import Image

LAYER = "BlueMarble_ShadedRelief_Bathymetry"
URL = ("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/" + LAYER +
       "/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg")

def tile_xy(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    r = math.radians(lat)
    y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n
    return x, y

def tile_lon(x, z):
    return x / 2 ** z * 360 - 180

def tile_lat(y, z):
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2 ** z))))

def main():
    key, w, s, e, n = sys.argv[1], *map(float, sys.argv[2:6])
    z = int(sys.argv[6]) if len(sys.argv) > 6 else 8
    x0, y0 = map(math.floor, tile_xy(w, n, z))
    x1, y1 = map(math.floor, tile_xy(e, s, z))
    img = Image.new("RGB", ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256))
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            req = urllib.request.Request(URL.format(z=z, x=x, y=y), headers={"User-Agent": "bea-preview"})
            with urllib.request.urlopen(req, timeout=30) as r:
                img.paste(Image.open(io.BytesIO(r.read())).convert("RGB"), ((x - x0) * 256, (y - y0) * 256))
    out = os.path.join(os.path.dirname(__file__), "..", "..", "next-preview", "terrain")
    os.makedirs(out, exist_ok=True)
    img.save(os.path.join(out, f"{key}.webp"), quality=82, method=6)
    bounds = [round(tile_lon(x0, z), 5), round(tile_lat(y1 + 1, z), 5),
              round(tile_lon(x1 + 1, z), 5), round(tile_lat(y0, z), 5)]
    print(json.dumps({key: {"src": f"/terrain/{key}.webp", "bounds": bounds,
                            "width": img.width, "height": img.height,
                            "credit": "NASA Blue Marble (public domain)"}}))

if __name__ == "__main__":
    main()
