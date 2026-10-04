import { RELIEF_SEA, RELIEF_TILE, RELIEF_ZOOM, tileNames, type ReliefMap } from "./relief-globe";

let loaded: Promise<ReliefMap | null> | null = null;

function tileImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * The terrain tiles of one zoom joined into one Mercator picture, fetched
 * once and only when a globe with terrain is drawn. Null when the tiles
 * cannot be read: the globe then keeps its plain look.
 */
export function loadReliefMap(): Promise<ReliefMap | null> {
  loaded ??= (async () => {
    try {
      const res = await fetch("/relief/index.json");
      if (!res.ok) return null;
      const names = tileNames((await res.json()) as Record<string, string[]>, RELIEF_ZOOM);
      if (names.size === 0) return null;
      const n = 2 ** RELIEF_ZOOM;
      const size = n * RELIEF_TILE;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.fillStyle = `rgb(${RELIEF_SEA.join(",")})`;
      ctx.fillRect(0, 0, size, size);
      await Promise.all(
        [...names].map(async (name) => {
          const [x, y] = name.split("/").map(Number) as [number, number];
          const img = await tileImage(`/relief/${RELIEF_ZOOM}/${name}.webp`);
          if (img) ctx.drawImage(img, x * RELIEF_TILE, y * RELIEF_TILE);
        }),
      );
      return { data: ctx.getImageData(0, 0, size, size).data, size };
    } catch {
      return null;
    }
  })().then((map) => {
    if (!map) loaded = null;
    return map;
  });
  return loaded;
}
