/**
 * Pure maths for BeaGlobe (src/components/world/BeaGlobe.tsx).
 *
 * Rotation uses d3-geo's convention, exactly like Globe.tsx: `[λ, φ]` in
 * degrees, where `geoOrthographic().rotate([λ, φ])` puts longitude −λ,
 * latitude −φ at the centre. So the SVG overlays (country and province
 * shading, rings) drawn with d3 line up with the WebGL Earth, and a caller
 * that knows Globe.tsx's numbers can reuse them.
 *
 * Globe space (matches three.js SphereGeometry UVs on an equirectangular
 * Earth whose centre is longitude 0): unit sphere, +Y north, lon 0 → +X,
 * lon +90° → −Z; the (orthographic) camera looks down −Z.
 *
 * No three.js and no DOM: tested with node --test like the rest of src/lib.
 */

export type Vec3 = { x: number; y: number; z: number };
/** d3-geo rotation, degrees. */
export type Rotation = [number, number];

const DEG = Math.PI / 180;
/** Globe.tsx's default view: lon 10°E, lat 18°N at the centre. */
export const HOME_ROTATION: Rotation = [-10, -18];
export const MAX_TILT = 85;
export const ZOOM_MIN = 0.7;
export const ZOOM_MAX = 2.6;
/** Globe.tsx: orthographic scale 150 × zoom in a 320 box. */
export const RADIUS_AT_ZOOM_1 = 150 / 320;

export function latLonToVec3(lat: number, lon: number): Vec3 {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return {
    x: Math.cos(phi) * Math.cos(lambda),
    y: Math.sin(phi),
    z: -Math.cos(phi) * Math.sin(lambda),
  };
}

/** The globe's yaw/pitch (radians, three.js Euler "XYZ") for a d3 rotation. */
export function rotationToEuler([lambda, phi]: Rotation): { yaw: number; pitch: number } {
  return { yaw: -Math.PI / 2 + lambda * DEG, pitch: -phi * DEG };
}

/** Rotate a globe-space point into view space (yaw about Y, then pitch about X). */
export function rotate(v: Vec3, rotation: Rotation): Vec3 {
  const { yaw, pitch } = rotationToEuler(rotation);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = v.x * cy + v.z * sy;
  const z1 = -v.x * sy + v.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return { x: x1, y: v.y * cp - z1 * sp, z: v.y * sp + z1 * cp };
}

/** The rotation that centres a place (Globe.tsx `centreOn`). */
export function rotationFacing(lat: number, lon: number): Rotation {
  return [-lon, -clampTilt(lat)];
}

export function clampTilt(phi: number): number {
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, phi));
}

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/** Shortest signed difference between two angles in degrees, in (−180, 180]. */
export function degDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export type Projected = {
  /** Pixels from the box's left/top edge. */
  x: number;
  y: number;
  /** z of the point in view space: > 0 on the visible hemisphere. */
  facing: number;
};

/** Orthographic projection — the same numbers as d3's geoOrthographic. */
export function project(
  lat: number,
  lon: number,
  rotation: Rotation,
  size: number,
  radiusPx: number,
): Projected {
  const p = rotate(latLonToVec3(lat, lon), rotation);
  return { x: size / 2 + radiusPx * p.x, y: size / 2 - radiusPx * p.y, facing: p.z };
}

/** 0 at/behind the horizon, 1 comfortably on the front: labels fade near the limb. */
export function limbFade(facing: number, start = 0.05, end = 0.3): number {
  const t = Math.max(0, Math.min(1, (facing - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export type Spin = { rotation: Rotation; /** degrees per second */ vLam: number; vPhi: number };

/**
 * One physics step. A flick decays (friction per second); left alone, the
 * globe settles into its gentle auto-rotation instead of stopping.
 */
export function stepSpin(
  s: Spin,
  dt: number,
  opts: { autoSpeed: number; idle: boolean; friction?: number },
): Spin {
  const decay = Math.exp(-(opts.friction ?? 3) * dt);
  const target = opts.idle ? opts.autoSpeed : 0;
  const vLam = target + (s.vLam - target) * decay;
  const vPhi = s.vPhi * decay;
  const phi = clampTilt(s.rotation[1] + vPhi * dt);
  return {
    rotation: [s.rotation[0] + vLam * dt, phi],
    vLam,
    vPhi: phi === s.rotation[1] ? 0 : vPhi,
  };
}

export type LabelBox = { left: number; right: number; top: number; bottom: number };
export type LabelCandidate = { id: string; name: string; x: number; y: number };

/**
 * A pin's frosted tag (CSS px), as in mockup.html's `.gtag` scaled to 390px:
 * 26 tall, the coloured drop inside on the left with its tip on the place.
 */
export function pillRect(name: string, x: number, y: number): LabelBox {
  const left = x - 9;
  const top = y - 30;
  return { left, right: left + 32 + Math.max(name.length, 1) * 7.4, top, bottom: top + 26 };
}

/**
 * Greedy placement in priority order (selected first, then nearest the
 * viewer): keep a tag only when it is clear of every kept tag and does not
 * cover another place's dot — Globe.tsx's placeCityLabels rule. A hidden
 * name is fixed by turning the globe, not by drifting tags off their places.
 */
export function placeLabels(
  candidates: readonly LabelCandidate[],
  max: number,
  /** Boxes already taken; kept labels are appended, so a second pass (country names) can respect them. */
  taken: LabelBox[] = [],
  rectOf: (c: LabelCandidate) => LabelBox = (c) => pillRect(c.name, c.x, c.y),
  /** Places whose dots a tag must not cover (defaults to the candidates). */
  dots: readonly LabelCandidate[] = candidates,
): Set<string> {
  const kept = new Set<string>();
  const hit = (a: LabelBox, b: LabelBox) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const dotBoxes = dots.map((d) => ({
    id: d.id,
    left: d.x - 4,
    right: d.x + 4,
    top: d.y - 4,
    bottom: d.y + 4,
  }));
  for (const c of candidates) {
    if (kept.size >= max) break;
    const r = rectOf(c);
    if (taken.some((k) => hit(k, r))) continue;
    if (dotBoxes.some((d) => d.id !== c.id && hit(d, r))) continue;
    kept.add(c.id);
    taken.push(r);
  }
  return kept;
}

/** A country name beside its ring marker (13px semibold). */
export function countryLabelRect(name: string, x: number, y: number): LabelBox {
  const left = x + 8;
  return { left, right: left + 6 + Math.max(name.length, 1) * 7.2, top: y - 9, bottom: y + 9 };
}

/** Globe.tsx's label budget by zoom. */
export function labelBudget(zoom: number): number {
  if (zoom < 1.15) return 6;
  if (zoom < 1.6) return 12;
  return 20;
}
