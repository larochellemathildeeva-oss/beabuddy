import { geoapifyDetailsUrl, readPlaceDetails, type PlaceFacts } from "./geoapify.ts";
import { nameEchoes } from "./match-confidence.ts";

/**
 * What Geoapify's Place Details knows about the place at a point, shared by
 * the stop card (place-details.functions.ts) and Optimize, so a place looked
 * up by one is not paid for again by the other.
 *
 * Server only: the key is passed in by a caller that read it from
 * geo-provider.server.ts.
 */

const UA = "BeaTravelApp/1.0 (travel memory vault)";

/** Answers kept for the life of the server process: hours rarely change mid-trip. */
const factsCache = new Map<string, PlaceFacts | null>();
const CACHE_MAX = 2_000;

/** Whether this point has been asked about already, so the caller can skip the wait. */
export function factsCached(lat: number, lon: number): boolean {
  return factsCache.has(`${lat.toFixed(5)},${lon.toFixed(5)}`);
}

/**
 * The facts at a point, or null when there are none or the lookup failed.
 * A failure is not remembered: the next look tries again.
 */
export async function placeFactsAt(
  key: string,
  lat: number,
  lon: number,
): Promise<PlaceFacts | null> {
  const at = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  const cached = factsCache.get(at);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(geoapifyDetailsUrl(key, lat, lon), {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const facts = readPlaceDetails(await res.json());
    if (factsCache.size >= CACHE_MAX) factsCache.delete(factsCache.keys().next().value!);
    factsCache.set(at, facts);
    return facts;
  } catch {
    return null;
  }
}

/**
 * The facts, but only when the place at the pin is the one named. A pin on
 * the café next door would otherwise lend it the wrong hours — shown with
 * confidence, which is the one thing Béa must not do.
 */
export async function placeFactsFor(
  key: string,
  stop: { lat: number; lon: number; name: string },
): Promise<PlaceFacts | null> {
  const facts = await placeFactsAt(key, stop.lat, stop.lon);
  if (!facts) return null;
  return facts.names.some((n) => nameEchoes(stop.name, n)) ? facts : null;
}
