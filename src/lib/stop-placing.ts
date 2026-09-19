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

/**
 * A timeline entry that still needs a point.
 *
 * The same problem as a trip stop, on the other table. An itinerary row picked
 * from search arrives placed; one typed by hand, or written by the planner,
 * does not — and until now nothing ever went back for it. Placing the trip's
 * cities was never the thing being asked for: what belongs on the map is where
 * you are actually going that day.
 */
export type PlaceableRow = {
  id: string;
  title: string;
  address?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

export function rowsToPlace(
  rows: readonly PlaceableRow[],
  tried: ReadonlySet<string>,
): PlaceableRow[] {
  return rows
    .filter(
      (row) =>
        !(typeof row.lat === "number" && typeof row.lon === "number") &&
        row.title.trim().length > 0 &&
        !tried.has(row.id),
    )
    .slice(0, PLACE_ON_OPEN_LIMIT);
}

/**
 * The area every lookup is anchored to, and never the trip's title.
 *
 * The import path used to fall back to `plan.trip_title`, so a day trip with
 * no city set searched for "Peace Memorial Museum, Hiroshima Day Trip" — a
 * sentence, not a place, which matches nothing. Then it saved the stops
 * unplaced and said so to no one.
 *
 * A trip's own stops are a better fallback than its name, because they are
 * real places that were themselves geocoded. Failing that, this returns "",
 * and the caller must say so rather than quietly looking nothing up: a bare
 * venue name is what put a Montreal burger in Slovakia, and that rule stands.
 */
export function tripLookupArea(trip: {
  city?: string | null | undefined;
  country?: string | null | undefined;
  stops?: readonly { city?: string | null; country?: string | null }[] | undefined;
}): string {
  const own = joinArea(trip.city, trip.country);
  if (own) return own;
  for (const stop of trip.stops ?? []) {
    const fromStop = joinArea(stop.city, stop.country ?? trip.country);
    if (fromStop) return fromStop;
  }
  return "";
}

function joinArea(city?: string | null, country?: string | null): string {
  const local = (city ?? "").trim();
  const nation = (country ?? "").trim();
  if (!local) return nation;
  if (!nation) return local;
  return local.toLowerCase().includes(nation.toLowerCase()) ? local : `${local}, ${nation}`;
}
