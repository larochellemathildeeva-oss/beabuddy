import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  areaBoxFrom,
  boxAround,
  boxViewbox,
  distanceKm,
  inBox,
  planStopQueries,
  QUERIES_PER_STOP,
  widenBox,
  type AreaBox,
} from "@/lib/geocode-plan";
import { stopArea } from "@/lib/import-stop";
import { autoPinTrusted } from "@/lib/match-confidence";
import { looksLikeStreetAddress, placeQueryCandidates } from "@/lib/direction-stops";
import { pickOpenPlace, type OpenPlace } from "@/lib/open-places";
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
  /**
   * The earlier stop in this same request that this one is inside (a
   * monument in a park), by position. Looked up beside that stop's pin first.
   */
  within: z.number().int().min(0).nullish(),
});

type StopInput = {
  title: string;
  detail?: string | null;
  place?: string | null;
  address?: string | null;
  city?: string | null;
  area?: string | null;
  within?: number | null;
};

const Input = z.object({
  stops: z.array(StopIn).max(60),
  area: z.string().max(200).nullish(),
  /**
   * When the caller's previous batch made its requests (this server's
   * clock, as that call returned them), so the provider's pace — the gap
   * and the per-minute cap — carries across batches instead of restarting.
   */
  recent: z.array(z.number()).max(200).nullish(),
  /**
   * Look venues up in Overture's listings (Open Places API) when the map
   * misses them. Off for a trip's cities: "Hiroshima" searched near Kyoto
   * would find a restaurant of that name, not the city.
   */
  venues: z.boolean().nullish(),
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
  /**
   * Not found on its own, so pinned where the stop it is inside is: the
   * title of that stop. A gallery at its museum is close enough to walk to.
   */
  inside?: string;
  /**
   * How far it is from the middle of the town it was looked up in, in km,
   * when that is further than a stop in town usually is. A municipality's
   * box can run tens of kilometres into the countryside, and a namesake in a
   * village there is inside it; callers do not pin these unasked.
   */
  farKm?: number;
  /** Found in Overture's listings rather than on the map: its place id there. */
  overtureId?: string;
};

/** How far from the stop it is inside a place is looked for, in km. */
const INSIDE_KM = 2;

/**
 * Further than this from the middle of the stop's town, a find is flagged
 * rather than pinned. Most of a city's sights are well inside it; an
 * airport, which often is not, is exempt.
 */
const TOWN_KM = 15;

function isAirport(hit: GeoHit): boolean {
  return (
    hit.category === "aeroway" ||
    hit.kind === "aerodrome" ||
    /airport|aeroporto|aeropuerto|a[ée]roport/i.test(hit.label ?? "")
  );
}

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
async function geocode(
  provider: GeoProvider,
  query: string,
  box: AreaBox,
  near: { lat: number; lon: number } | null,
): Promise<GeoResult> {
  const hits = await lookup(provider, query, { limit: near ? 5 : 3, box });
  if (hits === "throttled") return "throttled";
  const found: GeoHit[] = [];
  for (const hit of hits) {
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inBox(box, lat, lon)) continue;
    found.push({
      lat,
      lon,
      ...(hit.display_name ? { label: hit.display_name } : {}),
      ...(hit.class ? { category: hit.class } : {}),
      ...(hit.type ? { kind: hit.type } : {}),
      ...(hit.namedetails ? { alsoNamed: Object.values(hit.namedetails) } : {}),
    });
  }
  // Namesakes: "Mercado Municipal, Barreiras" is also the market of a
  // village twenty kilometres out, inside the same municipality. The one
  // nearest the middle of town is the one a visitor means.
  if (near) found.sort((a, b) => distanceKm(a, near) - distanceKm(b, near));
  return found[0] ?? null;
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

/** At most this many Overture searches per stop: its name, then its title. */
const OVERTURE_QUERIES = 2;

/** The stop in Overture's listings near `centre`, or nothing that only looks like it. */
async function askOverture(
  search: (query: string, near: { lat: number; lon: number }) => Promise<OpenPlace[]>,
  stop: { title: string; place?: string | null | undefined; address?: string | null | undefined },
  centre: { lat: number; lon: number },
): Promise<OpenPlace | null> {
  const names = [
    stop.title,
    stop.place ?? "",
    stop.address && looksLikeStreetAddress(stop.address) ? stop.address : "",
  ].filter((name) => name.trim());
  const queries = [
    ...(stop.place?.trim() ? placeQueryCandidates(stop.place, null) : []),
    ...placeQueryCandidates(stop.title, null),
  ].filter((query, i, all) => all.findIndex((q) => q.toLowerCase() === query.toLowerCase()) === i);
  for (const query of queries.slice(0, OVERTURE_QUERIES)) {
    const found = pickOpenPlace(await search(query, centre), names, centre);
    if (found) return found;
  }
  return null;
}

export const geocodePlanStops = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      stops: StopInput[];
      area?: string | null;
      recent?: number[] | null;
      venues?: boolean | null;
    }) => Input.parse(input),
  )
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
    const overture = data.venues ? await import("@/lib/open-places.server") : null;

    const cache = new Map<string, GeoHit | null>();
    /** Timestamps of requests made, so both the burst and minute caps hold. */
    // Only the last minute matters to either cap.
    const sent: number[] = (data.recent ?? []).filter((t) => Date.now() - t < 60_000);
    let throttled = false;
    const deadline = Date.now() + WALL_MS;
    let budget = LOOKUP_BUDGET;
    let lookedUp = 0;
    let first = sent.length === 0;

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
    /** The middle of each area, as the geocoder gave it, for the nearest namesake. */
    const centres = new Map<string, { lat: number; lon: number }>();
    const boxFor = async (where: string): Promise<AreaBox | null | "throttled"> => {
      const key = where.toLowerCase();
      if (boxes.has(key)) return boxes.get(key) ?? null;
      if (!(await takeTurn())) return null;
      const hits = await lookup(provider, where);
      if (hits === "throttled") return "throttled";
      const found = areaBoxFrom(hits[0]?.boundingbox);
      const box = found ? widenBox(found) : null;
      boxes.set(key, box);
      const lat = Number(hits[0]?.lat);
      const lon = Number(hits[0]?.lon);
      if (box && Number.isFinite(lat) && Number.isFinite(lon)) centres.set(key, { lat, lon });
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
      /** The middle of the stop's town, which every find is measured from. */
      const centre = centres.get(where.toLowerCase()) ?? null;

      /** The stop's queries inside one area; true once one of them lands. */
      const tryIn = async (
        inWhere: string,
        bounds: AreaBox,
        near: { lat: number; lon: number } | null,
      ): Promise<boolean> => {
        const queries = planStopQueries(
          { title: stop.title, detail: stop.detail, place: stop.place, address: stop.address },
          inWhere,
        ).slice(0, QUERIES_PER_STOP);
        for (const query of queries) {
          // Per box: a miss beside the parent is not a miss across the city.
          // And per centre: the nearest namesake to one town is not the
          // nearest to another searching the same country box.
          const from = near ?? centre;
          const key = `${query.toLowerCase()}|${boxViewbox(bounds)}|${from ? `${from.lat.toFixed(3)},${from.lon.toFixed(3)}` : ""}`;
          if (cache.has(key)) {
            const hit = cache.get(key) ?? null;
            if (hit) {
              placed.push({ index, ...hit, ...farFrom(hit) });
              return true;
            }
            continue;
          }
          if (!(await takeTurn())) return false;
          const found = await geocode(provider, query, bounds, near ?? centre);
          if (found === "throttled") {
            // Asking harder will not help, and recording these as misses would
            // mark real places unfindable for the rest of the session.
            throttled = true;
            return false;
          }
          cache.set(key, found);
          if (found) {
            placed.push({ index, ...found, ...farFrom(found) });
            return true;
          }
        }
        return false;
      };

      // Inside an earlier stop that was found: beside it first. "Cenotaph,
      // Hiroshima" alone could be any memorial in the city.
      /** Measured from the town, unless it was found beside the stop it is inside. */
      let besideParent = false;
      const farFrom = (hit: GeoHit): { farKm?: number } => {
        if (besideParent || !centre || isAirport(hit)) return {};
        const km = distanceKm(hit, centre);
        return km > TOWN_KM ? { farKm: Math.round(km) } : {};
      };

      const parent =
        stop.within != null && stop.within < index
          ? placed.find((hit) => hit.index === stop.within && !hit.inside)
          : undefined;
      if (parent) {
        besideParent = true;
        const beside = await tryIn(where, boxAround(parent, INSIDE_KM), parent);
        besideParent = false;
        if (beside) continue;
      }
      if (throttled) break;

      let landed = await tryIn(where, box, null);

      // The map missed it, or found something that is not it (a namesake out
      // of town, another name): Overture's listings, near the middle of town.
      // OpenStreetMap is thin outside big cities; they are not.
      if (overture?.openPlacesReady() && centre && !throttled) {
        const mine = placed.findIndex((hit) => hit.index === index);
        const hit = mine >= 0 ? placed[mine] : undefined;
        const names = {
          title: stop.title,
          place: stop.place ?? null,
          address: stop.address ?? null,
        };
        if (!hit || hit.farKm || !autoPinTrusted(names, hit)) {
          const found = await askOverture(overture.searchOpenPlaces, stop, centre);
          if (found) {
            if (mine >= 0) placed.splice(mine, 1);
            placed.push({
              index,
              lat: found.lat,
              lon: found.lon,
              label: found.label,
              alsoNamed: [found.name],
              overtureId: found.id,
            });
            landed = true;
          }
        }
      }
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
        if (countryBox) await tryIn(country, countryBox, null);
      }
      // Still nowhere, but inside a stop that was found: pinned there.
      const parentTitle = stop.within != null ? data.stops[stop.within]?.title : undefined;
      if (parent && parentTitle && !throttled && !placed.some((hit) => hit.index === index)) {
        placed.push({
          index,
          lat: parent.lat,
          lon: parent.lon,
          ...(parent.label ? { label: parent.label } : {}),
          inside: parentTitle,
        });
      }
      // The inner break only leaves this stop's queries. Without this the
      // batch would carry on to the next stop and collect another 429.
      if (throttled) break;
    }

    return { placed, lookedUp, area, throttled, sent: sent.slice(-120) };
  });
