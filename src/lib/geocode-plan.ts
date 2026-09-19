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

import { placeHintFromDetail, placeQueryCandidates } from "./direction-stops.ts";

export type PlanStop = {
  title: string;
  detail?: string | null | undefined;
};

/** At most this many lookups per stop, so a long plan stays bounded. */
export const QUERIES_PER_STOP = 2;

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

  const candidates = placeQueryCandidates(title, placeHintFromDetail(stop.detail ?? null));
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
