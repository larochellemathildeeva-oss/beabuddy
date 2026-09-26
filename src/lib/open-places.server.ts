import { openPlacesUrl, readOpenPlaces, type OpenPlace } from "./open-places.ts";

/**
 * Open Places API, on the server and nowhere else: the key is read here, and
 * callers import this lazily inside their handlers, as with the geocoder.
 *
 * No key, no lookups — Béa places stops as she did before. When the service
 * refuses (the monthly cap, a revoked key), it is left alone for the rest of
 * the process instead of being asked again for every stop.
 */
let refusedUntil = 0;
let announced = false;

/** In process: the same name near the same town is asked once. */
const cache = new Map<string, OpenPlace[]>();
const CACHE_MAX = 500;

function openPlacesKey(): string {
  return (process.env["OPEN_PLACES_API_KEY"] ?? "").trim();
}

export function openPlacesReady(): boolean {
  return openPlacesKey().length > 0 && Date.now() >= refusedUntil;
}

/** Places matching `query` near `near`; empty on any failure. */
export async function searchOpenPlaces(
  query: string,
  near: { lat: number; lon: number },
): Promise<OpenPlace[]> {
  const key = openPlacesKey();
  if (!key || Date.now() < refusedUntil) return [];
  const url = openPlacesUrl(query, near);
  const hit = cache.get(url);
  if (hit) return hit;
  if (!announced) {
    announced = true;
    console.info(`[geo] Open Places API for stops the map misses (key ${key.length} chars)`);
  }
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 429) {
      // Out of calls, or the key is wrong: an hour's rest, then try again.
      refusedUntil = Date.now() + 60 * 60_000;
      console.warn(`[geo] Open Places API refused (${res.status}); pausing it for an hour`);
      return [];
    }
    if (!res.ok) return [];
    const places = readOpenPlaces(await res.json());
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(url, places);
    return places;
  } catch {
    return [];
  }
}
