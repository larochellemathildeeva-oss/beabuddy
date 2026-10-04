/**
 * Terrain for the World globe: Natural Earth II's shaded relief (the same
 * public-domain tiles Home's route map uses, `public/relief`) wrapped on the
 * sphere. The tiles are Web Mercator, so each globe pixel is turned back into
 * a longitude and latitude and read from the joined tiles.
 *
 * Pure maths and a tile joiner; the drawing happens in `Globe.tsx`.
 */

/** The sea the tiles were painted with (SEA in scripts/relief/build.py). */
export const RELIEF_SEA: readonly [number, number, number] = [226, 233, 235];

/** The zoom whose tiles are joined: 8 × 8 tiles, about 260 KB, sharp on a phone globe. */
export const RELIEF_ZOOM = 3;
export const RELIEF_TILE = 256;

export type ReliefMap = { data: Uint8ClampedArray; size: number };

/** The tiles of one zoom that exist ("x/y"): open sea has none. */
export function tileNames(index: Record<string, string[]>, z: number): Set<string> {
  return new Set(index[String(z)] ?? []);
}

/**
 * Where world-frame unit vectors of a view's right, up and toward-the-viewer
 * axes point, for a d3 orthographic rotation [λ, φ]. `invert` is d3's
 * rotation inverse, taking and giving degrees.
 */
export type ViewAxes = {
  x: [number, number, number];
  y: [number, number, number];
  z: [number, number, number];
};

const RAD = Math.PI / 180;

function cartesian(lon: number, lat: number): [number, number, number] {
  const c = Math.cos(lat * RAD);
  return [c * Math.cos(lon * RAD), c * Math.sin(lon * RAD), Math.sin(lat * RAD)];
}

export function viewAxes(invert: (point: [number, number]) => [number, number]): ViewAxes {
  return {
    x: cartesian(...invert([90, 0])),
    y: cartesian(...invert([0, 90])),
    z: cartesian(...invert([0, 0])),
  };
}

/** The Mercator pixel (column, row) of a world-frame unit vector on a `size`-pixel map. */
export function mercatorPixel(vx: number, vy: number, vz: number, size: number): [number, number] {
  const lat = Math.asin(Math.max(-1, Math.min(1, vz)));
  const lon = Math.atan2(vy, vx);
  // The map stops at ±85.05°: the poles take the last row.
  const limited = Math.max(-1.4844, Math.min(1.4844, lat));
  const merc = Math.log(Math.tan(Math.PI / 4 + limited / 2));
  const col = ((lon / Math.PI + 1) / 2) * size;
  const row = ((1 - merc / Math.PI) / 2) * size;
  return [
    Math.min(size - 1, Math.max(0, Math.floor(col))),
    Math.min(size - 1, Math.max(0, Math.floor(row))),
  ];
}

/**
 * Paints the globe's terrain into `out` (RGBA, `px` × `px`) for a globe of
 * radius `radius` px centred in it. Outside the disc stays transparent.
 */
export function paintGlobe(
  out: Uint8ClampedArray,
  px: number,
  radius: number,
  axes: ViewAxes,
  relief: ReliefMap,
): void {
  const { x: ax, y: ay, z: az } = axes;
  const centre = px / 2;
  const r2 = radius * radius;
  for (let j = 0; j < px; j++) {
    const dy = (centre - (j + 0.5)) / radius;
    for (let i = 0; i < px; i++) {
      const dx = (i + 0.5 - centre) / radius;
      const d2 = dx * dx + dy * dy;
      const o = (j * px + i) * 4;
      if (d2 * r2 > r2) {
        out[o + 3] = 0;
        continue;
      }
      const dz = Math.sqrt(1 - d2);
      const vx = dx * ax[0] + dy * ay[0] + dz * az[0];
      const vy = dx * ax[1] + dy * ay[1] + dz * az[1];
      const vz = dx * ax[2] + dy * ay[2] + dz * az[2];
      const [col, row] = mercatorPixel(vx, vy, vz, relief.size);
      const s = (row * relief.size + col) * 4;
      out[o] = relief.data[s]!;
      out[o + 1] = relief.data[s + 1]!;
      out[o + 2] = relief.data[s + 2]!;
      out[o + 3] = 255;
    }
  }
}
