import { supabase } from "@/integrations/supabase/client";
import { searchPlaces } from "@/lib/places.functions";
import { safeStorage } from "@/lib/tour-state";
import { PLACE_LOOKUP_GAP_MS } from "@/lib/world-countries";
import {
  citiesToLocate,
  cityKey,
  cityQuery,
  pickCityHit,
  stopsToPin,
  type CityStop,
  type Position,
} from "@/lib/city-position";

/**
 * Finding a typed city on the map, and keeping the answer.
 *
 * Each city is asked once a session (a miss too), and the answers are kept
 * on the phone, so a trip's cities are looked up once, not each time Home
 * opens. The search itself is Béa's own (`searchPlaces`), cached on the
 * server for every traveller, so a city anyone asked for costs nothing.
 */

const STORE_KEY = "bea-city-positions-v1";
const STORE_MAX = 200;

const known = new Map<string, Position | null>();
const asking = new Map<string, Promise<Position | null>>();
let lastAsked = 0;

function readStore(): Record<string, [number, number]> {
  try {
    const raw = safeStorage().getItem(STORE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, [number, number]>) : {};
  } catch {
    return {};
  }
}

function keep(key: string, at: Position) {
  try {
    const store = readStore();
    delete store[key];
    store[key] = [at.lat, at.lon];
    // The oldest go first: insertion order is the order they were found.
    const keys = Object.keys(store);
    for (const old of keys.slice(0, Math.max(0, keys.length - STORE_MAX))) delete store[old];
    safeStorage().setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Not kept on the phone: it is asked again next session, from the cache.
  }
}

/** A city already found, on this phone or this session; undefined when never asked. */
export function knownCityPosition(key: string): Position | null | undefined {
  if (known.has(key)) return known.get(key);
  const kept = readStore()[key];
  if (
    Array.isArray(kept) &&
    typeof kept[0] === "number" &&
    typeof kept[1] === "number" &&
    Number.isFinite(kept[0]) &&
    Number.isFinite(kept[1])
  ) {
    const at = { lat: kept[0], lon: kept[1] };
    known.set(key, at);
    return at;
  }
  return undefined;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Where a city is, by its name; null when the map does not know it. */
export function locateCity(city: string, country?: string | null): Promise<Position | null> {
  const key = cityKey(city, country);
  const found = knownCityPosition(key);
  if (found !== undefined) return Promise.resolve(found);
  const pending = asking.get(key);
  if (pending) return pending;
  const ask = (async () => {
    // One lookup at a time, spaced, like every list Béa looks up.
    const gap = lastAsked + PLACE_LOOKUP_GAP_MS - Date.now();
    lastAsked = Math.max(Date.now(), lastAsked + PLACE_LOOKUP_GAP_MS);
    if (gap > 0) await wait(gap);
    try {
      const hits = await searchPlaces({ data: { query: cityQuery(city, country), areas: true } });
      const at = pickCityHit(hits, city);
      known.set(key, at);
      if (at) keep(key, at);
      return at;
    } catch {
      // Unreachable is not "not a city": asked again next session.
      known.set(key, null);
      return null;
    } finally {
      asking.delete(key);
    }
  })();
  asking.set(key, ask);
  return ask;
}

/** Where each city without a position is, as far as the map knows. */
export async function locateCities(stops: readonly CityStop[]): Promise<Map<string, Position>> {
  const out = new Map<string, Position>();
  for (const { city, country, key } of citiesToLocate(stops)) {
    const at = await locateCity(city, country);
    if (at) out.set(key, at);
  }
  return out;
}

/**
 * Give the trip's saved city stops their position, found by name. Only a
 * stop still without one is written, so a place picked meanwhile on another
 * phone is never replaced. Failures are quiet: the stop is saved either way.
 */
export async function pinCityStops(
  stops: readonly CityStop[],
  positions?: ReadonlyMap<string, Position>,
): Promise<void> {
  try {
    const found = positions ?? (await locateCities(stops));
    for (const pin of stopsToPin(stops, found)) {
      const { error } = await supabase
        .from("trip_stops")
        .update({ lat: pin.lat, lon: pin.lon })
        .eq("id", pin.id)
        .is("lat", null);
      if (error) console.warn("[trips] city position not saved", error.message);
    }
  } catch (e) {
    console.warn("[trips] city position not saved", e);
  }
}
