/**
 * Geometry for the aerial trip banners: where each stop sits over the
 * picture, how far along the trip you are, and the dotted trail between the
 * Trips header's tags. Plain numbers only, so it is tested on its own;
 * `AerialBanner.tsx` draws it.
 */
import type { TerrainBounds } from "./terrain-art.ts";

export type Pt = { x: number; y: number };

/** Web Mercator's y for a latitude, in radians of the projection. */
export function mercY(lat: number): number {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}

/** Where a place falls on a Web Mercator picture of `bounds`, in its pixels. */
export function onArt(
  p: { lat: number; lon: number },
  bounds: TerrainBounds,
  size: { width: number; height: number },
): Pt {
  const [w, s, e, n] = bounds;
  const span = e >= w ? e - w : e + 360 - w;
  let dl = p.lon - w;
  if (dl < 0) dl += 360;
  const x = (dl / span) * size.width;
  const y = ((mercY(n) - mercY(p.lat)) / (mercY(n) - mercY(s))) * size.height;
  return { x, y };
}

export type ArtFrame = { scale: number; dx: number; dy: number; width: number; height: number };

/**
 * How a picture fills the banner: scaled to cover it, then slid so `focus`
 * (a point of the picture, e.g. the middle of the route) lands as near
 * `target` (a point of the banner) as the picture allows without leaving a
 * gap at an edge.
 */
export function coverFrame(
  art: { width: number; height: number },
  frame: { width: number; height: number },
  focus?: Pt,
  target?: Pt,
  minScale = 0,
): ArtFrame {
  const scale = Math.max(frame.width / art.width, frame.height / art.height, minScale);
  const width = art.width * scale;
  const height = art.height * scale;
  const fx = focus ? focus.x * scale : width / 2;
  const fy = focus ? focus.y * scale : height / 2;
  const tx = target ? target.x : frame.width / 2;
  const ty = target ? target.y : frame.height / 2;
  const clamp = (v: number, lo: number) => Math.min(0, Math.max(lo, v));
  return {
    scale,
    width,
    height,
    dx: clamp(tx - fx, frame.width - width),
    dy: clamp(ty - fy, frame.height - height),
  };
}

/**
 * Stops on a picture with a map box, in the banner's units. A picture of a
 * wider area than the trip is enlarged until the route fills the band (up to
 * `fill` of the width), never past `maxScale` (1 = a picture pixel per CSS
 * pixel), so a big map still frames the trip.
 */
export function stopsOnArt(
  stops: readonly { lat: number; lon: number }[],
  bounds: TerrainBounds,
  art: { width: number; height: number },
  frame: { width: number; height: number },
  band: { top: number; bottom: number },
  { fill = 0.62, maxScale = 1 }: { fill?: number; maxScale?: number } = {},
): { points: Pt[]; frame: ArtFrame } {
  const raw = stops.map((s) => onArt(s, bounds, art));
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const focus = raw.length
    ? { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
    : undefined;
  const target = { x: frame.width / 2, y: (band.top + band.bottom) / 2 };
  const spanX = raw.length ? Math.max(...xs) - Math.min(...xs) : 0;
  const spanY = raw.length ? Math.max(...ys) - Math.min(...ys) : 0;
  const fit = Math.min(
    spanX > 0 ? (frame.width * fill) / spanX : Infinity,
    spanY > 0 ? Math.max(1, band.bottom - band.top) / spanY : Infinity,
  );
  const f = coverFrame(
    art,
    frame,
    focus,
    target,
    Number.isFinite(fit) ? Math.min(fit, maxScale) : 0,
  );
  return {
    points: raw.map((p) => ({ x: f.dx + p.x * f.scale, y: f.dy + p.y * f.scale })),
    frame: f,
  };
}

/**
 * How far along the trip is, for "3/5 stops": the stop you are in, else the
 * last one behind you, else none yet.
 */
export function tripProgress(
  current: number,
  done: number,
  total: number,
): { at: number; total: number } {
  if (total <= 0) return { at: 0, total: 0 };
  const at = current >= 0 ? current + 1 : Math.min(total, Math.max(0, done));
  return { at, total };
}

/**
 * The dotted flight trail joining the Trips header's places in order: one
 * gentle arc between each pair, bowing upward, and where its little plane
 * sits (the middle of the longest leg) with its heading in degrees.
 */
export function trailPath(points: readonly Pt[]): {
  d: string;
  plane: (Pt & { angle: number }) | null;
} {
  if (points.length < 2) return { d: "", plane: null };
  let d = `M${r(points[0]!.x)} ${r(points[0]!.y)}`;
  let best = -1;
  let plane: (Pt & { angle: number }) | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    // Bow away from the straight line, upward, by a fifth of its length.
    const nx = -(b.y - a.y) / (len || 1);
    const ny = (b.x - a.x) / (len || 1);
    const sign = ny > 0 ? -1 : 1;
    const c = {
      x: (a.x + b.x) / 2 + sign * nx * len * 0.2,
      y: (a.y + b.y) / 2 + sign * ny * len * 0.2,
    };
    d += ` Q${r(c.x)} ${r(c.y)} ${r(b.x)} ${r(b.y)}`;
    if (len > best) {
      best = len;
      const at = (t: number) => ({
        x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
        y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
      });
      const p = at(0.5);
      const q = at(0.52);
      plane = { x: p.x, y: p.y, angle: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI };
    }
  }
  return { d, plane };
}

const r = (v: number) => Math.round(v * 10) / 10;

export type Box = { x: number; y: number; width: number; height: number };

/**
 * Where each pin's callout (a tag, a photo bubble) sits on a banner: beside
 * the pin (right, then left), above or below it, then a half-step up or down
 * — the first spot that covers no other pin, no callout already placed and
 * no `keepClear` box (the title, the buttons), inside the frame. Null when
 * there is no room: that callout is left off rather than drawn over another.
 * `anchor` is where on the callout its pin points to (a bubble's photo).
 */
export function calloutBoxes(
  pins: readonly Pt[],
  widths: readonly number[],
  frame: { width: number; top: number; bottom: number },
  options: { height: number; gap?: number; keepClear?: readonly Box[]; dot?: number } = {
    height: 40,
  },
): (Box | null)[] {
  const { height, gap = 6, keepClear = [], dot = 8 } = options;
  const taken: Box[] = [
    ...keepClear,
    ...pins.map((p) => ({ x: p.x - dot, y: p.y - dot, width: dot * 2, height: dot * 2 })),
  ];
  const hits = (a: Box, b: Box) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const inside = (a: Box) =>
    a.x >= 6 &&
    a.x + a.width <= frame.width - 6 &&
    a.y >= frame.top &&
    a.y + a.height <= frame.bottom;
  return pins.map((pin, i) => {
    const width = widths[i] ?? 120;
    const mid = pin.y - height / 2;
    const right = pin.x + dot + gap;
    const left = pin.x - dot - gap - width;
    const centre = pin.x - width / 2;
    const half = height / 2 + gap;
    const spots: Box[] = [
      { x: right, y: mid, width, height },
      { x: left, y: mid, width, height },
      { x: centre, y: pin.y - dot - gap - height, width, height },
      { x: centre, y: pin.y + dot + gap, width, height },
      { x: right, y: mid - half, width, height },
      { x: right, y: mid + half, width, height },
      { x: left, y: mid - half, width, height },
      { x: left, y: mid + half, width, height },
    ];
    const box = spots.find((s) => inside(s) && !taken.some((t) => hits(s, t)));
    if (!box) return null;
    taken.push(box);
    return box;
  });
}
