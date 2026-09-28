import { pexelsSearchUrl, pexelsTownQuery, readPexelsPhoto, type PexelsUse } from "./pexels.ts";
import type { PlacePhoto } from "./wikimedia.ts";

/**
 * Pexels, on the server and nowhere else: the key is read here, and callers
 * import this lazily inside their handlers.
 *
 * No key, no lookups — photos come from Wikimedia Commons as before. The free
 * plan allows 200 searches an hour; when Pexels refuses (that limit, a wrong
 * key) it is left alone for an hour and Commons answers instead. Answers,
 * found or not, are kept for the life of the process; a failure is not.
 */
let refusedUntil = 0;
let announced = false;

const cache = new Map<string, Promise<PlacePhoto | null>>();
const CACHE_MAX = 2_000;

function pexelsKey(): string {
  return (process.env["PEXELS_API_KEY"] ?? "").trim();
}

/** A photo of a trip's town for its banner, or null. */
export function pexelsTownPhoto(city: string, country?: string | null): Promise<PlacePhoto | null> {
  const query = pexelsTownQuery(city, country);
  const town = (city.split(",")[0] ?? "").trim();
  return query ? search(query, [town], "banner") : Promise.resolve(null);
}

/** A photo of a stop, described by one of its names, or null. */
export function pexelsPlacePhoto(names: readonly string[]): Promise<PlacePhoto | null> {
  const asked = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  return asked[0] ? search(asked[0], asked, "place") : Promise.resolve(null);
}

function search(query: string, names: string[], use: PexelsUse): Promise<PlacePhoto | null> {
  const key = pexelsKey();
  if (!key || Date.now() < refusedUntil) return Promise.resolve(null);
  const url = pexelsSearchUrl(query, use);
  const id = `${url}|${names.join("|").toLowerCase()}`;
  const hit = cache.get(id);
  if (hit) return hit;
  if (!announced) {
    announced = true;
    console.info(`[photos] Pexels first for photos (key ${key.length} chars)`);
  }
  const pending = (async () => {
    const res = await fetch(url, {
      headers: { Authorization: key, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      refusedUntil = Date.now() + 60 * 60_000;
      console.warn(`[photos] Pexels refused (${res.status}); pausing it for an hour`);
      throw new Error("refused");
    }
    if (!res.ok) throw new Error(`Pexels answered ${res.status}`);
    return readPexelsPhoto(await res.json(), names, use);
  })().catch(() => {
    cache.delete(id);
    return null;
  });
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(id, pending);
  return pending;
}
