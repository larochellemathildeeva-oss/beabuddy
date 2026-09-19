/**
 * Which trip stops still need putting on the map.
 *
 * A stop picked from search arrives with a point; one typed by hand, or
 * produced by Béa's planner, does not. Those stops are invisible to the trip
 * map, to Near, and to anything that measures distance — and the trip card
 * falls back to a large letter because there is nothing to draw.
 *
 * Rather than drawing something different in the view, this fills the gap in
 * the data: the stops get looked up once, area-anchored, and keep their
 * positions. Every surface that reads them improves at the same time, and the
 * lookup is not repeated on the next visit.
 */

export type PlaceableStop = {
  id: string;
  city: string;
  place_name?: string | null | undefined;
  address?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

/** At most this many looked up on one visit, so a long trip stays polite. */
export const PLACE_ON_OPEN_LIMIT = 8;

function placed(stop: PlaceableStop): boolean {
  return typeof stop.lat === "number" && typeof stop.lon === "number";
}

/** A name worth looking up — the specific place if there is one, else the city. */
export function stopLookupTitle(stop: PlaceableStop): string {
  return (stop.place_name ?? "").trim() || stop.city.trim();
}

/**
 * Stops to look up now: unplaced, named, not already tried, and capped.
 *
 * `tried` holds what this visit has already attempted, so a stop the geocoder
 * cannot find is not asked for again every time the list reloads — which it
 * does after each successful placement.
 */
export function stopsToPlace(
  stops: readonly PlaceableStop[],
  tried: ReadonlySet<string>,
): PlaceableStop[] {
  return stops
    .filter((stop) => !placed(stop) && stopLookupTitle(stop).length > 0 && !tried.has(stop.id))
    .slice(0, PLACE_ON_OPEN_LIMIT);
}
