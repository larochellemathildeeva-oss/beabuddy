/**
 * What makes two place searches the same search, so the second is served
 * from the first's answer instead of being paid for again
 * (place-search-cache.server.ts). Pure, so it is tested.
 *
 * The same words in the same place: case and spacing do not matter, and a
 * position is rounded (about 100 m near you, about 1 km for the middle of a
 * trip), so a step down the street is still the same search. Bump
 * `SEARCH_CACHE_VERSION` when the search itself changes, so old answers are
 * not served for it.
 */
export const SEARCH_CACHE_VERSION = 1;

type Point = { lat: number; lon: number } | null | undefined;

const round = (point: Point, places: number) =>
  point ? [Number(point.lat.toFixed(places)), Number(point.lon.toFixed(places))] : null;

const tidy = (text: string | null | undefined) =>
  (text ?? "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

export function searchCacheKey(search: {
  provider: string;
  query: string;
  near?: string | null | undefined;
  at?: Point;
  center?: Point;
  areas?: boolean | null | undefined;
  quick?: boolean | null | undefined;
}): string {
  return JSON.stringify([
    SEARCH_CACHE_VERSION,
    search.provider,
    tidy(search.query),
    tidy(search.near),
    round(search.at, 3),
    // The middle of the trip only leans the search when it has no town.
    search.near?.trim() ? null : round(search.center, 2),
    Boolean(search.areas),
    Boolean(search.quick),
  ]);
}

/** A cached answer: the places, and what the server knows of each beside them. */
export type CachedSearch<P> = {
  places: P[];
  /** Each place's full label, or null. */
  where: (string | null)[];
  /** Each place's other names, or null. */
  names: (string[] | null)[];
};

/** Kept two weeks; an empty answer only an hour, since a miss may be the map's hiccup. */
export const SEARCH_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const EMPTY_SEARCH_TTL_MS = 60 * 60 * 1000;

export function stillFresh(savedAt: number, empty: boolean, now: number): boolean {
  return now - savedAt < (empty ? EMPTY_SEARCH_TTL_MS : SEARCH_CACHE_TTL_MS);
}
