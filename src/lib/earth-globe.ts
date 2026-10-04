/**
 * The World globe's Earth: NASA's Blue Marble by day and Earth at Night in
 * Dark (public domain; `public/earth`, built by `scripts/earth/build.py`),
 * wrapped on the sphere. The pictures are equirectangular, so each globe
 * pixel is turned back into a longitude and latitude and read from them, then
 * lit from the upper left so the globe reads round.
 *
 * Pure maths; the loading is `earth-globe-load.ts`, the drawing `Globe.tsx`.
 */

export type EarthMap = { data: Uint8ClampedArray; width: number; height: number };

export type EarthLook = "day" | "night";

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

/** The equirectangular pixel (column, row) of a world-frame unit vector. */
export function earthPixel(
  vx: number,
  vy: number,
  vz: number,
  width: number,
  height: number,
): [number, number] {
  const lat = Math.asin(Math.max(-1, Math.min(1, vz)));
  const lon = Math.atan2(vy, vx);
  const col = ((lon / Math.PI + 1) / 2) * width;
  const row = (0.5 - lat / Math.PI) * height;
  return [
    Math.min(width - 1, Math.max(0, Math.floor(col))),
    Math.min(height - 1, Math.max(0, Math.floor(row))),
  ];
}

/** Light from the upper left and a little in front, as in the mockup. */
const LIGHT: [number, number, number] = (() => {
  const v: [number, number, number] = [-0.45, 0.5, 0.74];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

/**
 * How bright a point of the globe is, from its view-frame normal: never
 * black, a little brighter than the picture where the light falls.
 */
export function shadeAt(dx: number, dy: number, dz: number, look: EarthLook): number {
  const lit = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + dz * LIGHT[2]);
  // At night the lights are the picture: only the rim falls away.
  if (look === "night") return 0.5 + 0.6 * Math.min(1, dz * 1.6);
  return 0.62 + 0.5 * lit;
}

/**
 * Paints the globe into `out` (RGBA, `px` × `px`) for a globe of radius
 * `radius` px centred in it. Outside the disc stays transparent.
 */
export function paintGlobe(
  out: Uint8ClampedArray,
  px: number,
  radius: number,
  axes: ViewAxes,
  earth: EarthMap,
  look: EarthLook = "day",
): void {
  const { x: ax, y: ay, z: az } = axes;
  const { data, width, height } = earth;
  const centre = px / 2;
  for (let j = 0; j < px; j++) {
    const dy = (centre - (j + 0.5)) / radius;
    for (let i = 0; i < px; i++) {
      const dx = (i + 0.5 - centre) / radius;
      const d2 = dx * dx + dy * dy;
      const o = (j * px + i) * 4;
      if (d2 > 1) {
        out[o + 3] = 0;
        continue;
      }
      const dz = Math.sqrt(1 - d2);
      const vx = dx * ax[0] + dy * ay[0] + dz * az[0];
      const vy = dx * ax[1] + dy * ay[1] + dz * az[1];
      const vz = dx * ax[2] + dy * ay[2] + dz * az[2];
      const [col, row] = earthPixel(vx, vy, vz, width, height);
      const s = (row * width + col) * 4;
      const k = shadeAt(dx, dy, dz, look);
      out[o] = data[s]! * k;
      out[o + 1] = data[s + 1]! * k;
      out[o + 2] = data[s + 2]! * k;
      // A soft edge, so the rim is not a jagged staircase.
      out[o + 3] = Math.min(255, (1 - Math.sqrt(d2)) * radius * 255);
    }
  }
}
