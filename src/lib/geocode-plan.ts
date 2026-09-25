/**
 * Turning a planned stop into something safe to look up.
 *
 * Béa's planner returns a title and a detail line and no coordinates, so a
 * stop she adds lands with no position: invisible on the trip map, invisible
 * to Near, and re-looked-up every time you ask for directions.
 *
 * The obvious fix — ask the model for lat/lon — is the one thing not to do.
 * A model will answer confidently and wrongly, and this app already has the
 * scar: "never geocode a bare name", after a Montreal Harvey's was saved in
 * Slovakia. So every query built here is anchored to the trip's area, and a
 * trip with no area gets no lookups at all rather than a guess. A stop that
 * cannot be placed stays blank, which is a stop you can fix by hand, not a
 * pin in the wrong country.
 */

import {
  looksLikeStreetAddress,
  placeHintFromDetail,
  placeQueryCandidates,
} from "./direction-stops.ts";

export type PlanStop = {
  title: string;
  detail?: string | null | undefined;
  /** The venue as named on a map, when the parse pulled one out. */
  place?: string | null | undefined;
  /** A street address the source gave, as written. */
  address?: string | null | undefined;
};

/** At most this many lookups per stop, so a long plan stays bounded. */
export const QUERIES_PER_STOP = 3;

/**
 * Ordered queries for one stop, most specific first, each anchored to `area`.
 *
 * No area, no queries: the anchor is the whole safety argument, and a bare
 * venue name is exactly what put a Montreal burger in eastern Europe.
 */
export function planStopQueries(stop: PlanStop, area: string | null | undefined): string[] {
  const where = (area ?? "").trim();
  if (!where) return [];
  const title = stop.title.trim();
  if (!title) return [];

  // Most specific first: the address the source gave, then the venue's own
  // name, then whatever the title and the detail line suggest.
  const address = stop.address?.trim() || placeHintFromDetail(stop.detail ?? null);
  const place = stop.place?.trim() || "";
  // placeQueryCandidates stops at an address when it has one; the venue
  // is still worth its own try in case the address is not on the map.
  const candidates = [
    ...(address && looksLikeStreetAddress(address) ? [address] : []),
    ...(place ? placeQueryCandidates(place, null) : []),
    ...placeQueryCandidates(title, address),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates.length > 0 ? candidates : [title]) {
    const query = `${candidate}, ${where}`;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(query);
    if (out.length >= QUERIES_PER_STOP) break;
  }
  return out;
}

/**
 * Stops worth looking up: titled, and not already placed.
 *
 * Placed means both halves. Half a coordinate is not a location you can draw,
 * measure or route from — it is a stop that still needs finding.
 */
export function stopsNeedingLocation<
  T extends PlanStop & { lat?: number | null; lon?: number | null },
>(stops: readonly T[]): T[] {
  return stops.filter(
    (s) => s.title.trim() && !(typeof s.lat === "number" && typeof s.lon === "number"),
  );
}

/**
 * Roughly how long a batch will take, in seconds.
 *
 * Nominatim's policy is one request a second, so this is mostly waiting. The
 * number is shown to the person rather than hidden, because a silent
 * thirty-second pause reads as a hang.
 */
export function estimatedSeconds(stopCount: number, gapMs: number): number {
  return Math.ceil((stopCount * gapMs) / 1000);
}

/**
 * The trip's area as a box, so a stop can only be placed inside it.
 *
 * Anchoring the query text ("Queue de Castor, Montreal") was not enough: the
 * geocoder treats the city as a hint, and answered with a namesake stand at a
 * water park two hundred kilometres away. Searching bounded to the area's own
 * box, and checking the answer lands in it, turns that into "not found" —
 * which is a stop you fix by hand, not a pin in the wrong town.
 */
export type AreaBox = { south: number; north: number; west: number; east: number };

/** Nominatim and LocationIQ return `boundingbox` as [south, north, west, east] strings. */
export function areaBoxFrom(bbox: readonly (string | number)[] | null | undefined): AreaBox | null {
  if (!bbox || bbox.length !== 4) return null;
  const [south, north, west, east] = bbox.map(Number) as [number, number, number, number];
  if (![south, north, west, east].every(Number.isFinite) || south > north || west > east)
    return null;
  return { south, north, west, east };
}

/**
 * The box with a margin, so a stop just past the city line (an airport, a
 * suburb) still counts. A quarter of the box each way, never less than about
 * ten kilometres, because a city mapped as a point has a box of nothing.
 */
/**
 * A box of about 45 km each way around a point: where to look for a stop
 * when the trip's area is the wrong place (a Hiroshima day on a Kyoto trip)
 * but the stop before it is on the map.
 */
export function boxAround(point: { lat: number; lon: number }, km = 45): AreaBox {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.2, Math.cos((point.lat * Math.PI) / 180)));
  return {
    south: point.lat - dLat,
    north: point.lat + dLat,
    west: point.lon - dLon,
    east: point.lon + dLon,
  };
}

export function widenBox(box: AreaBox, fraction = 0.25, minDeg = 0.1): AreaBox {
  const dLat = Math.max((box.north - box.south) * fraction, minDeg);
  const dLon = Math.max((box.east - box.west) * fraction, minDeg);
  return {
    south: Math.max(-90, box.south - dLat),
    north: Math.min(90, box.north + dLat),
    west: Math.max(-180, box.west - dLon),
    east: Math.min(180, box.east + dLon),
  };
}

/** As the geocoder's `viewbox` parameter: west,north,east,south. */
export function boxViewbox(box: AreaBox): string {
  return [box.west, box.north, box.east, box.south].map((n) => n.toFixed(5)).join(",");
}

export function inBox(box: AreaBox, lat: number, lon: number): boolean {
  return lat >= box.south && lat <= box.north && lon >= box.west && lon <= box.east;
}

/**
 * Stops placed far from where the rest of the trip is, to flag for checking.
 *
 * For pins already saved before the bounded search existed. The middle is the
 * median of the placed stops; a stop counts as far when it is more than
 * `minKm` away and more than four times the typical distance from the middle,
 * so a road trip's stops, all far apart, are not all flagged.
 */
export function strayStopIds<T extends { id: string; lat: number | null; lon: number | null }>(
  items: readonly T[],
  minKm = 50,
): Set<string> {
  const placed = items.filter(
    (i): i is T & { lat: number; lon: number } => i.lat != null && i.lon != null,
  );
  const out = new Set<string>();
  if (placed.length < 3) return out;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
  };
  const mid = { lat: median(placed.map((p) => p.lat)), lon: median(placed.map((p) => p.lon)) };
  const km = (p: { lat: number; lon: number }) => {
    const r = Math.PI / 180;
    const a =
      Math.sin(((p.lat - mid.lat) * r) / 2) ** 2 +
      Math.cos(mid.lat * r) * Math.cos(p.lat * r) * Math.sin(((p.lon - mid.lon) * r) / 2) ** 2;
    return 12_742 * Math.asin(Math.sqrt(a));
  };
  const typical = median(placed.map(km));
  for (const p of placed) {
    const d = km(p);
    if (d > minKm && d > typical * 4) out.add(p.id);
  }
  return out;
}
