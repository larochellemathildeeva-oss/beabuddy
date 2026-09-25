import { geoapifyMatrixRequest, readMatrix } from "./geoapify.ts";
import type { GeoProvider } from "./geo-endpoints.ts";
import { reserveGeoCredits } from "./geo-budget.server.ts";
import { factsCached, placeFactsFor } from "./place-facts.server.ts";
import {
  isMovable,
  isPinned,
  matrixCredits,
  matrixGroups,
  modeFor,
  type OptStop,
  type TravelTable,
} from "./route-optimize.ts";

/**
 * The fetching half of route-optimize.ts: Route Matrix and Place Details,
 * with the key from geo-provider.server.ts and never in anything the browser
 * downloads. Every call is bounded in time and in count, reserves its credits
 * against the day's ceiling first (geo-budget.server.ts), and falls back to
 * what Optimize did before — the model's arrangement, unmeasured — rather
 * than to an error.
 */

const UA = "BeaTravelApp/1.0 (travel memory vault)";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Matrices already bought, by their points; a second Optimize of the same trip is free. */
const matrixCache = new Map<string, TravelTable>();
const MATRIX_CACHE_MAX = 200;

async function postJson(url: string, body: string, timeoutMs: number): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "user-agent": UA, "content-type": "application/json", accept: "application/json" },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Real travel times between the trip's pinned stops, one table per place.
 * `limited` is true when today's share of credits stopped a table being bought.
 */
export async function travelTables(
  provider: GeoProvider,
  stops: readonly OptStop[],
  deadline: number,
): Promise<{ tables: TravelTable[]; limited: boolean }> {
  const tables: TravelTable[] = [];
  let limited = false;
  if (provider.name !== "geoapify") return { tables, limited };
  const seen = new Set<string>();
  const pinned = stops.filter(isPinned).filter((s) => !seen.has(s.id) && seen.add(s.id));
  let first = true;
  for (const group of matrixGroups(pinned)) {
    if (Date.now() > deadline) break;
    const mode = modeFor(group);
    const cacheKey = `${mode}|${group.map((s) => `${s.lat.toFixed(5)},${s.lon.toFixed(5)}`).join(";")}`;
    const ids = group.map((s) => s.id);
    const cached = matrixCache.get(cacheKey);
    if (cached) {
      tables.push({ ...cached, ids });
      continue;
    }
    if (!(await reserveGeoCredits(matrixCredits(group.length)))) {
      limited = true;
      continue;
    }
    if (!first) await wait(provider.gapMs);
    first = false;
    const { url, body } = geoapifyMatrixRequest(provider.token, mode, group);
    const json = await postJson(
      url,
      body,
      Math.max(1_000, Math.min(12_000, deadline - Date.now())),
    );
    if (!json) continue;
    const table: TravelTable = { ids, mode, seconds: readMatrix(json, group.length) };
    if (matrixCache.size >= MATRIX_CACHE_MAX) matrixCache.delete(matrixCache.keys().next().value!);
    matrixCache.set(cacheKey, table);
    tables.push(table);
  }
  return { tables, limited };
}

/** Most places looked up for hours in one Optimize: 40 credits, eight seconds. */
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
