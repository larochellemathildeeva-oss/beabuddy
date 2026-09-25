import { readGeoJson, routeProfile, routeUrl, type GeoProvider } from "./geo-endpoints.ts";

/**
 * One journey from the router, shared by directions (directions.functions.ts)
 * and Optimize's route check (route-optimize.server.ts), with one cache.
 *
 * Each journey is a credit on Geoapify. A traveller who optimizes a day and
 * then keeps its directions would otherwise buy the same journeys twice; with
 * one cache, whichever asks second gets them free. The key is the provider,
 * the mode and both ends to five decimals (about a metre), so a pin nudged
 * across the street is a new journey and a different provider never answers
 * for another.
 *
 * Only answers are kept — a failure is tried again next time. Held for the
 * life of the server process, like the other geo caches.
 */

export type RoutedLeg = {
  distance: number;
  duration: number;
  steps: { instruction: string; distance: number }[];
};

const UA = "BeaBot/1.0 (travel app)";
const cache = new Map<string, RoutedLeg>();
const CACHE_MAX = 5_000;

type Point = { lat: number; lon: number };

function key(provider: GeoProvider, mode: "walking" | "driving", a: Point, b: Point): string {
  const at = (p: Point) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  return `${provider.name}|${mode}|${at(a)}|${at(b)}`;
}

/** Whether this journey is already known, so a caller can budget only for new ones. */
export function legCached(
  provider: GeoProvider,
  a: Point,
  b: Point,
  mode: "walking" | "driving",
): boolean {
  return cache.has(key(provider, mode, a, b));
}

function stepText(s: {
  maneuver?: { type?: string; modifier?: string };
  name?: string;
  instruction?: string;
}): string {
  const type = s.maneuver?.type ?? "continue";
  const mod = s.maneuver?.modifier ? ` ${s.maneuver.modifier}` : "";
  const name = s.name ? ` onto ${s.name}` : "";
  if (s.instruction) return s.instruction;
  if (type === "arrive") return "Arrive at your destination";
  if (type === "depart") return `Head off${name}`;
  return `${type}${mod}${name}`.replace(/^\w/, (c) => c.toUpperCase());
}

/** The journey from a to b, from the cache or the router; null when no route came back. */
export async function routeOnce(
  provider: GeoProvider,
  a: Point,
  b: Point,
  mode: "walking" | "driving",
): Promise<RoutedLeg | null> {
  const k = key(provider, mode, a, b);
  const known = cache.get(k);
  if (known) return known;
  // "foot" on the demo router, "walking" on LocationIQ — the same mode under
  // two names, and the wrong one 400s every walking leg without saying so.
  const url = routeUrl(provider, routeProfile(provider, mode), a, b);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await readGeoJson(provider, "route", res)) as {
      routes?: {
        distance: number;
        duration: number;
        legs: {
          steps: {
            distance: number;
            name?: string;
            instruction?: string;
            maneuver?: { type?: string; modifier?: string };
          }[];
        }[];
      }[];
    };
    const route = json.routes?.[0];
    if (!route) return null;
    const steps = (route.legs[0]?.steps ?? [])
      .map((s) => ({ instruction: stepText(s), distance: Math.round(s.distance) }))
      .filter((s) => s.distance > 0 || s.instruction.startsWith("Arrive"));
    const leg = {
      distance: Math.round(route.distance),
      duration: Math.round(route.duration),
      steps,
    };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(k, leg);
    return leg;
  } catch {
    return null;
  }
}
