import type { GeoProvider } from "./geo-endpoints.ts";
import { reserveGeoCredits } from "./geo-budget.server.ts";
import { factsCached, placeFactsFor } from "./place-facts.server.ts";
import { isMovable, legKey, type Leg, type OptStop } from "./route-optimize.ts";

/**
 * The lookups Optimize makes: opening hours from Place Details, for the
 * "Open when you get there" goal, and a check of the chosen day's journeys on
 * real routes. Travel times for planning are estimated from the pins
 * (route-optimize.ts) and cost nothing; only the journeys actually in the
 * plan are checked, one credit each. The key comes from
 * geo-provider.server.ts and never reaches the browser; each batch of new
 * lookups is reserved against the day's ceiling first (geo-budget.server.ts).
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Most new places looked up for hours in one Optimize: 40 credits, eight seconds. */
export const HOURS_LOOKUP_MAX = 40;

/**
 * Opening hours for the stops Optimize may move, by id, when Place Details
 * has them for the place actually named. Absent means unknown. Places looked
 * up before cost nothing and are always used; new lookups are reserved as
 * one batch, and skipped when today's share is spent.
 */
export async function hoursFor(
  provider: GeoProvider,
  stops: readonly OptStop[],
  deadline: number,
): Promise<{ hours: Map<string, string>; limited: boolean }> {
  const hours = new Map<string, string>();
  if (provider.name !== "geoapify") return { hours, limited: false };
  const seen = new Set<string>();
  const movable = stops.filter(isMovable).filter((s) => !seen.has(s.id) && seen.add(s.id));
  const fresh = movable.filter((s) => !factsCached(s.lat, s.lon)).slice(0, HOURS_LOOKUP_MAX);
  const allowed = fresh.length === 0 || (await reserveGeoCredits(fresh.length));
  const lookUp = new Set(allowed ? fresh.map((s) => s.id) : []);
  let asked = 0;
  for (const s of movable) {
    const cached = factsCached(s.lat, s.lon);
    if (!cached && !lookUp.has(s.id)) continue;
    if (!cached) {
      if (Date.now() > deadline) break;
      if (asked > 0) await wait(provider.gapMs);
      asked += 1;
    }
    const facts = await placeFactsFor(provider.token, { lat: s.lat, lon: s.lon, name: s.title });
    if (facts?.openingHours) hours.set(s.id, facts.openingHours);
  }
  return { hours, limited: !allowed };
}

/** Most new journeys checked in one Optimize: 40 credits. */
export const CHECK_MAX_LEGS = 40;

/**
 * Real travel times for `legs`, by legKey, from the router directions use and
 * through the same cache (route-legs.server.ts): a journey checked here is
 * free when its directions are kept, and the other way round. Journeys known
 * already are free and always used; new ones are reserved as one batch and
 * skipped when today's share is spent. Requests start at the provider's pace
 * but run side by side, so forty journeys take seconds, not forty round trips.
 */
export async function checkLegs(
  provider: GeoProvider,
  legs: readonly Leg[],
  deadline: number,
): Promise<{ times: Map<string, number>; limited: boolean }> {
  const times = new Map<string, number>();
  if (provider.name !== "geoapify") return { times, limited: false };
  const { legCached, routeOnce } = await import("./route-legs.server.ts");
  const how = (leg: Leg): "walking" | "driving" => (leg.mode === "walk" ? "walking" : "driving");
  const where = (leg: Leg) =>
    `${how(leg)}|${leg.from.lat.toFixed(5)},${leg.from.lon.toFixed(5)}|${leg.to.lat.toFixed(5)},${leg.to.lon.toFixed(5)}`;
  const fresh = new Map<string, Leg>();
  for (const leg of legs) {
    if (legCached(provider, leg.from, leg.to, how(leg))) continue;
    if (fresh.size < CHECK_MAX_LEGS) fresh.set(where(leg), leg);
  }
  const allowed = fresh.size === 0 || (await reserveGeoCredits(fresh.size));
  const pending: Promise<unknown>[] = [];
  let first = true;
  if (allowed) {
    for (const leg of fresh.values()) {
      if (Date.now() > deadline) break;
      if (!first) await wait(provider.gapMs);
      first = false;
      pending.push(routeOnce(provider, leg.from, leg.to, how(leg)));
    }
  }
  await Promise.all(pending);
  // Every journey the cache now knows, including repeats of the same pair.
  for (const leg of legs) {
    if (!legCached(provider, leg.from, leg.to, how(leg))) continue;
    const routed = await routeOnce(provider, leg.from, leg.to, how(leg));
    if (routed) times.set(legKey(leg.from.id, leg.to.id), routed.duration);
  }
  return { times, limited: !allowed };
}
