/**
 * Home's living map: the trip's cities on a map of their own part of the
 * world, joined by one smooth line, each with a pill saying how long you stay.
 *
 * Everything here is plain geometry and words, so it is tested on its own;
 * `TripRouteMap.tsx` projects the cities and draws them.
 */

export type RouteStopInput = {
  city: string;
  country?: string | null;
  lat: number | null;
  lon: number | null;
  arrive_on?: string | null;
  depart_on?: string | null;
};

export type RouteStop = {
  city: string;
  country: string | null;
  lat: number;
  lon: number;
  /** Days spent there, or null when the stop has no dates. */
  days: number | null;
};

export type Point = { x: number; y: number };

export type PillPlacement = {
  /** Index into the stops. */
  index: number;
  /** Top-left corner of the pill, inside the frame. */
  x: number;
  y: number;
};

const DAY_MS = 86_400_000;

function isoDay(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : t / DAY_MS;
}

/** Nights between arriving and leaving; a same-day stop counts as one day. */
export function stayDays(arrive: string | null | undefined, depart: string | null | undefined) {
  const from = isoDay(arrive);
  const to = isoDay(depart);
  if (from === null || to === null || to < from) return null;
  return Math.max(1, to - from);
}

/** "1 day", "3 days", or nothing when the stop has no dates. */
export function stayLabel(days: number | null): string {
  if (days === null) return "";
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * The stops the map can draw: those with a position, in order, with a city
 * visited twice in a row (a hotel and then a day out from it) counted once.
 */
export function routeStops(stops: readonly RouteStopInput[]): RouteStop[] {
  const out: RouteStop[] = [];
  for (const s of stops) {
    // A position off the globe (a typo, a swapped pair) is left off the map
    // rather than thrown across it.
    if (s.lat === null || s.lon === null || !Number.isFinite(s.lat) || !Number.isFinite(s.lon))
      continue;
    if (Math.abs(s.lat) > 85 || Math.abs(s.lon) > 180) continue;
    const city = s.city.trim();
    if (!city) continue;
    const days = stayDays(s.arrive_on, s.depart_on);
    const last = out.at(-1);
    if (last && last.city.toLowerCase() === city.toLowerCase()) {
      if (days !== null) last.days = (last.days ?? 0) + days;
      continue;
    }
    out.push({ city, country: s.country ?? null, lat: s.lat, lon: s.lon, days });
  }
  return out;
}

/** A longitude in −180…180. */
function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * The middle of the shortest stretch of longitude holding every stop — across
 * the 180° line when that is shorter, so a trip from Fiji to Samoa is a short
 * hop and not a lap of the world.
 */
export function centerLon(lons: readonly number[]): number {
  if (lons.length === 0) return 0;
  const sorted = lons.map(wrapLon).sort((a, b) => a - b);
  const n = sorted.length;
  // The widest gap between neighbours (going round) is the part not shown.
  let gapAfter = n - 1;
  let gap = sorted[0]! + 360 - sorted[n - 1]!;
  for (let i = 0; i < n - 1; i++) {
    const g = sorted[i + 1]! - sorted[i]!;
    if (g > gap) {
      gap = g;
      gapAfter = i;
    }
  }
  const start = sorted[(gapAfter + 1) % n]!;
  let end = sorted[gapAfter]!;
  if (end < start) end += 360;
  return wrapLon((start + end) / 2);
}

/**
 * The box the map shows, around `centerLon` (the projection is turned so that
 * longitude is its middle): the stops, padded, and never smaller than a region
 * (a one-city trip still shows its country around it). Returned as two
 * corners, in longitudes relative to the centre, for the projection to fit.
 */
export function mapBounds(
  stops: readonly { lat: number; lon: number }[],
  minLon = 9,
  minLat = 6,
  pad = 0.35,
): { center: number; corners: [[number, number], [number, number]] } {
  const center = centerLon(stops.map((s) => s.lon));
  const lons = stops.map((s) => wrapLon(s.lon - center));
  const lats = stops.map((s) => s.lat);
  let w = Math.min(...lons);
  let e = Math.max(...lons);
  let s = Math.min(...lats);
  let n = Math.max(...lats);
  const padLon = Math.max((minLon - (e - w)) / 2, (e - w) * pad);
  const padLat = Math.max((minLat - (n - s)) / 2, (n - s) * pad);
  w = Math.max(-179.9, w - padLon);
  e = Math.min(179.9, e + padLon);
  s = Math.max(-80, s - padLat);
  n = Math.min(84, n + padLat);
  return {
    center,
    corners: [
      [w, s],
      [e, n],
    ],
  };
}

/**
 * One smooth line through the points (Catmull-Rom, drawn as cubic Béziers),
 * so the route bends through each city rather than turning at it.
 */
export function smoothPath(points: readonly Point[], tension = 0.5): string {
  if (points.length === 0) return "";
  const r = (n: number) => Math.round(n * 10) / 10;
  const [first] = points;
  if (points.length === 1) return `M${r(first!.x)} ${r(first!.y)}`;
  let d = `M${r(first!.x)} ${r(first!.y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const k = tension / 3;
    const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
    const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
    d += ` C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}

/**
 * Which stops get a pill: all of them up to four; past that the first, the
 * last and the two longest stays, so a long trip stays readable.
 */
export function pillStops(stops: readonly RouteStop[], max = 4): number[] {
  if (stops.length <= max) return stops.map((_, i) => i);
  const last = stops.length - 1;
  const middle = stops
    .map((s, i) => ({ i, days: s.days ?? 0 }))
    .filter(({ i }) => i !== 0 && i !== last)
    .sort((a, b) => b.days - a.days || a.i - b.i)
    .slice(0, max - 2)
    .map(({ i }) => i);
  return [0, ...middle, last].sort((a, b) => a - b);
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Each pill sits beside its dot, never on it: the last stop's above it, the
 * others below, as in the design, else to one side. Cities close together can
 * box each other in, so the pills are placed together: every combination of
 * spots is tried (at most four pills, a few spots each) and the first with no
 * pill on another pill or on a dot wins, in order of preference. When none is
 * clear, a pill is left off (never the last stop's) until the rest fit. All
 * of them stay inside the frame and under the title.
 */
export function placePills(
  dots: readonly Point[],
  which: readonly number[],
  frame: {
    width: number;
    height: number;
    pillWidth: number;
    pillHeight: number;
    gap?: number;
    /** No pill rises above this line: the words over the top of the map. */
    top?: number;
  },
): PillPlacement[] {
  const { width, height, pillWidth: pw, pillHeight: ph } = frame;
  const gap = frame.gap ?? 12;
  const margin = 8;
  const top = Math.max(margin, frame.top ?? margin);
  const clampX = (x: number) => Math.min(Math.max(x, margin), width - margin - pw);
  const clampY = (y: number) => Math.min(Math.max(y, top), height - margin - ph);
  const lastIndex = dots.length - 1;
  const dotBoxes: Box[] = dots.map((d) => ({ x0: d.x - 7, y0: d.y - 7, x1: d.x + 7, y1: d.y + 7 }));
  const box = (p: { x: number; y: number }): Box => ({
    x0: p.x,
    y0: p.y,
    x1: p.x + pw,
    y1: p.y + ph,
  });
  const shared = (a: Box, b: Box) => {
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    return w > 0 && h > 0 ? w * h : 0;
  };

  // Where each pill may go, best first.
  const options = which.map((index) => {
    const dot = dots[index]!;
    // The photo end of the pill sits near the dot; the words run away from
    // the middle of the frame, so a pill on the right edge does not fall off.
    const along = clampX(dot.x < width / 2 ? dot.x - pw * 0.3 : dot.x - pw * 0.55);
    const middle = clampY(dot.y - ph / 2);
    const aboveY = clampY(dot.y - gap - ph);
    const belowY = clampY(dot.y + gap);
    const above = [along, clampX(dot.x - pw + 28), clampX(dot.x - 28)].map((x) => ({
      x,
      y: aboveY,
    }));
    const below = [along, clampX(dot.x - 28), clampX(dot.x - pw + 28)].map((x) => ({
      x,
      y: belowY,
    }));
    const sides = [
      { x: clampX(dot.x + gap), y: middle },
      { x: clampX(dot.x - gap - pw), y: middle },
    ];
    const fitsAbove = dot.y - gap - ph >= top;
    const spots =
      index === lastIndex && fitsAbove
        ? [...above, ...sides, ...below]
        : [...below, ...sides, ...(fitsAbove ? above : [])];
    // A spot that covers any dot is never clear.
    return spots.map((p) => ({ p, own: dotBoxes.reduce((sum, d) => sum + shared(box(p), d), 0) }));
  });

  let best: { picks: number[]; crowd: number } | null = null;
  const picks: number[] = [];
  const placed: Box[] = [];
  const search = (i: number, crowd: number): boolean => {
    if (best && crowd >= best.crowd) return false;
    if (i === options.length) {
      best = { picks: [...picks], crowd };
      return crowd === 0;
    }
    const spots = options[i]!;
    for (let k = 0; k < spots.length; k++) {
      const { p, own } = spots[k]!;
      const b = box(p);
      const extra = own + placed.reduce((sum, t) => sum + shared(b, t), 0);
      picks.push(k);
      placed.push(b);
      const done = search(i + 1, crowd + extra);
      picks.pop();
      placed.pop();
      if (done) return true;
    }
    return false;
  };
  search(0, 0);
  const found = best as { picks: number[]; crowd: number } | null;
  if (found && found.crowd > 0 && which.length > 1) {
    // Too close to label them all clear: leave one out — the stop before the
    // last, then the next — and try again. The last stop keeps its pill.
    const drop = which.length > 2 ? which.length - 2 : 0;
    return placePills(
      dots,
      which.filter((_, i) => i !== drop),
      frame,
    );
  }
  const chosen = found?.picks ?? which.map(() => 0);
  return which.map((index, i) => {
    const { p } = options[i]![chosen[i]!]!;
    return { index, x: p.x, y: p.y };
  });
}

/**
 * "BA932" and "LHR → BER" out of however the flight was written ("Flight
 * BA 932 London LHR -> Berlin BER"), else nothing: the card then shows the
 * flight's own title.
 */
export function flightParts(text: string): { code: string | null; route: string | null } {
  const code = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/.exec(text);
  const route = /\b([A-Z]{3})\b\s*(?:→|->|–|—|-|to)\s*(?:[A-Za-z .'-]*?\s)?\b([A-Z]{3})\b/.exec(
    text,
  );
  return {
    code: code ? `${code[1]}${code[2]}` : null,
    route: route ? `${route[1]} → ${route[2]}` : null,
  };
}

/**
 * The hero's second line: "in 2 days.", "tomorrow.", "today.", "day 3 of 5."
 * — or nothing for a trip with no dates or one just over.
 */
export function heroWhen(when: string): string {
  const w = when.trim();
  if (!w) return "";
  return `${w.charAt(0).toLowerCase()}${w.slice(1)}.`;
}
