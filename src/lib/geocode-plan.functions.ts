import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  areaBoxFrom,
  boxViewbox,
  inBox,
  planStopQueries,
  QUERIES_PER_STOP,
  widenBox,
  type AreaBox,
} from "@/lib/geocode-plan";
import { stopArea } from "@/lib/import-stop";
import {
  classifyGeoStatus,
  nextDelayMs,
  readGeoJson,
  searchUrl,
  type GeoProvider,
} from "@/lib/geo-endpoints";

const UA = "BeaBot/1.0 (travel app)";

/** Nominatim asks for no more than one request a second. This is the gap. */
export const PLAN_LOOKUP_GAP_MS = 1_100;

/** Bounds on a single call, so one enormous plan cannot run away. */
const LOOKUP_BUDGET = 60;
const WALL_MS = 90_000;

const StopIn = z.object({
  title: z.string().max(200),
  detail: z.string().nullish(),
  place: z.string().max(200).nullish(),
  address: z.string().max(300).nullish(),
  /** The stop's own town, when the plan names one; looked up instead of the trip's area. */
  city: z.string().max(120).nullish(),
  /**
   * Where the trip is on the stop's day ("Hiroshima, Japan"), from its route.
   * Takes the place of the trip's area for this stop: a multi-city trip's
   * home city is the wrong place for most of its days.
   */
  area: z.string().max(200).nullish(),
});

type StopInput = {
  title: string;
  detail?: string | null;
  place?: string | null;
  address?: string | null;
  city?: string | null;
  area?: string | null;
};

const Input = z.object({
  stops: z.array(StopIn).max(60),
  area: z.string().max(200).nullish(),
});

/**
 * A placed stop, with the evidence needed to say how sure Béa is.
 *
 * `lat`/`lon` used to be the whole of it, so every match arrived looking
 * equally certain. The geocoder was already telling us what it found and what
 * kind of thing it is; we were discarding both on the way through.
 */
export type PlacedStop = {
  index: number;
  lat: number;
  lon: number;
  /** The geocoder's full name for it: "Olive et Gourmando, Rue Saint-Paul…". */
  label?: string;
  /** OSM class, e.g. amenity, shop, place. */
  category?: string;
  /** OSM type, e.g. cafe, museum, suburb. */
  kind?: string;
  /** Its other names (local, English, alternative), for the confidence check. */
  alsoNamed?: string[];
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GeoHit = {
  lat: number;
  lon: number;
  label?: string;
  category?: string;
  kind?: string;
  alsoNamed?: string[];
};
type GeoResult = GeoHit | null | "throttled";

type RawHit = {
  lat: string;
  lon: string;
  display_name?: string;
  class?: string;
  type?: string;
  boundingbox?: string[];
  /** With namedetails=1: name, name:en, name:ja, alt_name… */
  namedetails?: Record<string, string>;
};

async function lookup(
  provider: GeoProvider,
  query: string,
  extra: { limit?: number; box?: AreaBox } = {},
): Promise<RawHit[] | "throttled"> {
  // English labels, and every name the place has. The labels were asked for
  // in the local language, so a stop called "Hiroshima Station" was checked
  // against "広島駅" and judged a mismatch although it was the right place.
  // namedetails carries the local name too, and the check reads all of them.
  const url = searchUrl(provider, {
    query,
    limit: extra.limit ?? 1,
    language: "en",
    nameDetails: true,
    ...(extra.box ? { viewbox: boxViewbox(extra.box), bounded: true } : {}),
  });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    const verdict = classifyGeoStatus(res.status);
    if (verdict !== "ok") return verdict === "retry" ? "throttled" : [];
    const json = (await readGeoJson(provider, "search", res)) as RawHit[];
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

/**
 * A stop, looked up only inside the trip's area. The request is bounded to
 * the box, and the answer is checked against it too, because a provider that
 * treats the box as a hint would otherwise still hand back a namesake in the
 * next province.
 */
async function geocode(provider: GeoProvider, query: string, box: AreaBox): Promise<GeoResult> {
  const hits = await lookup(provider, query, { limit: 3, box });
  if (hits === "throttled") return "throttled";
  for (const hit of hits) {
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inBox(box, lat, lon)) continue;
    return {
      lat,
      lon,
      ...(hit.display_name ? { label: hit.display_name } : {}),
      ...(hit.class ? { category: hit.class } : {}),
      ...(hit.type ? { kind: hit.type } : {}),
      ...(hit.namedetails ? { alsoNamed: Object.values(hit.namedetails) } : {}),
    };
  }
  return null;
}

/**
 * Places the stops a plan produced, so they land on the map with the rest.
 *
 * Only stops that resolve come back. A stop that does not is left alone rather
 * than guessed at — the whole reason the queries are anchored to the trip's
 * area is that an unanchored lookup once put a Montreal burger in Slovakia,
 * and a wrong pin is worse than no pin.
 *
 * The one-a-second gap is Nominatim's usage policy, not caution. It is why
 * this is slow enough to need something to look at while it runs.
 */
/** "Kyoto, Kyoto Prefecture, Japan" → "Japan"; nothing for a one-part area. */
function countryOf(area: string): string {
  const parts = area
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : "";
}

export const geocodePlanStops = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stops: StopInput[]; area?: string | null }) => Input.parse(input))
  .handler(async ({ data }) => {
    const area = data.area?.trim() ?? "";
    const placed: PlacedStop[] = [];
    // A trip with no area can still be placed stop by stop when the plan
    // names each stop's town; with neither, nothing is looked up.
    if (!area && !data.stops.some((stop) => stop.city?.trim() || stop.area?.trim()))
      return { placed, lookedUp: 0, area: "" };

    // Which service answers, and how fast it lets us ask. Imported here
    // rather than at the top of the file: this module ships to the client
    // bundle, and the token must not go with it.
    const { geoProvider } = await import("@/lib/geo-provider.server");
    const provider = geoProvider();

    const cache = new Map<string, GeoHit | null>();
    /** Timestamps of requests made, so both the burst and minute caps hold. */
    const sent: number[] = [];
    let throttled = false;
    const deadline = Date.now() + WALL_MS;
    let budget = LOOKUP_BUDGET;
    let lookedUp = 0;
    let first = true;

    /** Waits its turn, then counts the request. False when out of time or budget. */
    const takeTurn = async (): Promise<boolean> => {
      if (budget <= 0 || Date.now() > deadline) return false;
      // The gap goes before every request but the first, so a one-stop plan
      // does not sit still for a second before it starts. The delay honours
      // the minute cap too: two a second empties sixty a minute in thirty
      // seconds, and the rest of the batch would meet a wall of 429s.
      if (!first) {
        const delay = nextDelayMs(provider, sent, Date.now());
        if (Date.now() + delay > deadline) return false;
        if (delay > 0) await wait(delay);
      }
      first = false;
      budget -= 1;
      lookedUp += 1;
      sent.push(Date.now());
      return true;
    };

    // Each area once, for its box. No box, no placing: an unbounded lookup
    // is how a Montreal stop landed at a water park near Quebec City.
    const boxes = new Map<string, AreaBox | null>();
    const boxFor = async (where: string): Promise<AreaBox | null | "throttled"> => {
      const key = where.toLowerCase();
      if (boxes.has(key)) return boxes.get(key) ?? null;
      if (!(await takeTurn())) return null;
      const hits = await lookup(provider, where);
      if (hits === "throttled") return "throttled";
      const found = areaBoxFrom(hits[0]?.boundingbox);
      const box = found ? widenBox(found) : null;
      boxes.set(key, box);
      return box;
    };

    for (const [index, stop] of data.stops.entries()) {
      // The stop's own town first (a Miyajima lunch on a Hiroshima trip),
      // then where the trip is that day, then the trip's area.
      const dayArea = stop.area?.trim() || area;
      const own = stopArea(stop.city, dayArea);
      let where = own;
      let box = own ? await boxFor(own) : null;
      if (box === "throttled") {
        throttled = true;
        break;
      }
      for (const fallback of [dayArea, area]) {
        if (box || !fallback || fallback === where) continue;
        where = fallback;
        box = await boxFor(fallback);
        if (box === "throttled") break;
      }
      if (box === "throttled") {
        throttled = true;
        break;
      }
      if (!box) continue;

      /** The stop's queries inside one area; true once one of them lands. */
      const tryIn = async (inWhere: string, bounds: AreaBox): Promise<boolean> => {
        const queries = planStopQueries(
          { title: stop.title, detail: stop.detail, place: stop.place, address: stop.address },
          inWhere,
        ).slice(0, QUERIES_PER_STOP);
        for (const query of queries) {
          const key = query.toLowerCase();
          if (cache.has(key)) {
            const hit = cache.get(key) ?? null;
            if (hit) {
              placed.push({ index, ...hit });
              return true;
            }
            continue;
          }
          if (!(await takeTurn())) return false;
          const found = await geocode(provider, query, bounds);
          if (found === "throttled") {
            // Asking harder will not help, and recording these as misses would
            // mark real places unfindable for the rest of the session.
            throttled = true;
            return false;
          }
          cache.set(key, found);
          if (found) {
            placed.push({ index, ...found });
            return true;
          }
        }
        return false;
      };

      const landed = await tryIn(where, box);
      // Not in its town: the trip's country, last. A stop saved without its
      // town (a Hiroshima day on a trip filed under Kyoto) is otherwise only
      // ever looked for in the wrong city. Callers still check the match
      // before saving it (autoPinTrusted), and the stray-pin warning flags
      // anything far from the rest of the trip.
      const country = countryOf(dayArea) || countryOf(area);
      if (!landed && !throttled && country && country.toLowerCase() !== where.toLowerCase()) {
        const countryBox = await boxFor(country);
        if (countryBox === "throttled") {
          throttled = true;
          break;
        }
        if (countryBox) await tryIn(country, countryBox);
      }
      // The inner break only leaves this stop's queries. Without this the
      // batch would carry on to the next stop and collect another 429.
      if (throttled) break;
    }

    return { placed, lookedUp, area, throttled };
  });
