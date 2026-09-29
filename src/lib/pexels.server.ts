import countryBoxes from "../../public/geo/admin1/index.json";
import {
  countryFilterAt,
  pexelsSearchUrl,
  pexelsTownQuery,
  readPexelsPhoto,
  takeFromHour,
  type PexelsUse,
} from "./pexels.ts";
import type { PlacePhoto } from "./wikimedia.ts";

/**
 * Pexels, on the server and nowhere else: the key is read here, and callers
 * import this lazily inside their handlers.
 *
 * No key, no lookups — photos come from Wikimedia Commons as before. The free
 * plan allows 200 searches an hour for the whole app, so Béa keeps under it
 * itself (`HOURLY_MAX`), gives no one traveller more than `PER_USER_HOURLY`
 * of them, and stops early when Pexels says few are left. When it refuses
 * anyway (a wrong key) it is left alone for an hour. Commons answers whenever
 * Pexels is not asked. Answers, found or not, are kept for the life of the
 * process; a failure is not.
 */
const HOURLY_MAX = 180;
const PER_USER_HOURLY = 40;
/** Searches Pexels must still have left before Béa asks it for another. */
const RESERVE = 10;

let refusedUntil = 0;
let announced = false;
const searches: number[] = [];
const byUser = new Map<string, number[]>();

const cache = new Map<string, Promise<PlacePhoto | null>>();
const CACHE_MAX = 2_000;

function pexelsKey(): string {
  return (process.env["PEXELS_API_KEY"] ?? "").trim();
}

/** A photo of a trip's town for its banner, or null. */
export function pexelsTownPhoto(
  userId: string,
  city: string,
  country?: string | null,
): Promise<PlacePhoto | null> {
  const query = pexelsTownQuery(city, country);
  const town = (city.split(",")[0] ?? "").trim();
  return query ? search(userId, query, [town], "banner", country) : Promise.resolve(null);
}

/**
 * A photo of a stop, described by one of its names, or null. With the stop's
 * pin, a photo that names a country the pin is not in is passed over.
 */
export function pexelsPlacePhoto(
  userId: string,
  names: readonly string[],
  at?: { lat: number; lon: number },
): Promise<PlacePhoto | null> {
  const asked = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!asked[0]) return Promise.resolve(null);
  const where = at ? { ...at, mayBeIn: countryFilterAt(at.lat, at.lon, countryBoxes) } : undefined;
  return search(userId, asked[0], asked, "place", null, where);
}

/** One more search for this traveller, if the hour allows it. */
function allowed(userId: string, now: number): boolean {
  let mine = byUser.get(userId);
  if (!mine) {
    if (byUser.size >= CACHE_MAX) byUser.delete(byUser.keys().next().value!);
    mine = [];
    byUser.set(userId, mine);
  }
  if (!takeFromHour(mine, now, PER_USER_HOURLY)) return false;
  if (takeFromHour(searches, now, HOURLY_MAX)) return true;
  mine.pop();
  return false;
}

function search(
  userId: string,
  query: string,
  names: string[],
  use: PexelsUse,
  country?: string | null,
  where?: { lat: number; lon: number; mayBeIn: (code: string) => boolean },
): Promise<PlacePhoto | null> {
  const key = pexelsKey();
  const now = Date.now();
  if (!key || now < refusedUntil) return Promise.resolve(null);
  const url = pexelsSearchUrl(query, use);
  const id = `${url}|${names.join("|").toLowerCase()}|${(country ?? "").toLowerCase()}|${
    where ? `${where.lat.toFixed(1)},${where.lon.toFixed(1)}` : ""
  }`;
  const hit = cache.get(id);
  if (hit) return hit;
  if (!allowed(userId, now)) return Promise.resolve(null);
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
    // Few searches left this period: rest until Pexels resets them.
    const left = Number(res.headers.get("x-ratelimit-remaining"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (res.headers.has("x-ratelimit-remaining") && Number.isFinite(left) && left <= RESERVE) {
      refusedUntil =
        Number.isFinite(reset) && reset * 1000 > Date.now()
          ? Math.min(reset * 1000, Date.now() + 24 * 60 * 60_000)
          : Date.now() + 60 * 60_000;
    }
    if (!res.ok) throw new Error(`Pexels answered ${res.status}`);
    return readPexelsPhoto(await res.json(), names, use, country, where?.mayBeIn);
  })().catch(() => {
    cache.delete(id);
    return null;
  });
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(id, pending);
  return pending;
}
