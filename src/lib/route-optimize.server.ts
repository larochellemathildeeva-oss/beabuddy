import type { GeoProvider } from "./geo-endpoints.ts";
import { reserveGeoCredits } from "./geo-budget.server.ts";
import { factsCached, placeFactsFor } from "./place-facts.server.ts";
import { isMovable, type OptStop } from "./route-optimize.ts";

/**
 * The one lookup Optimize makes: opening hours from Place Details, for the
 * "Open when you get there" goal. Travel times are estimated from the pins
 * (route-optimize.ts) and cost nothing. The key comes from
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
