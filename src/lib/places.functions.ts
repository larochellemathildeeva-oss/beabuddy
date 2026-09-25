import {
  RADIUS_AROUND_TRIP_M,
  RADIUS_NEAR_YOU_M,
  isExactPoiMatch,
  matchesCategory,
  overpassQuery,
  poiIntent,
  readOverpass,
  type OverpassElement,
  type PoiHit,
  type PoiIntent,
} from "@/lib/poi-search";
import { haversine } from "@/lib/geo";
import { geoapifyPlacesToElements, geoapifyPlacesUrl } from "@/lib/geoapify";
import { dropBareAreas, widerQueries } from "@/lib/place-search-near";
import { placeQueryParts } from "@/lib/place-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractPastedPlaceLink } from "@/lib/place-paste";
import { fetchPlaceHtml, UnsupportedPlaceUrlError, type FetchFailure } from "@/lib/place-url";
import { geocodeIsTrustworthy, queryIsLocatable } from "@/lib/geocode-trust";
import { foldAccents, fuzzyQueryVariants, fuzzyRank } from "@/lib/fuzzy";
import {
  placeFromNominatim,
  refineNominatimHits,
  exactPlaceHits,
  isVenueHit,
  type NominatimHitLike,
} from "@/lib/place-label";
import {
  cleanPageTitle,
  googleQueryPlaceText,
  placePathSegment,
  resolvePlaceCoords,
  splitPlacePathName,
} from "@/lib/place-link";
import {
  countriesStartingWith,
  localPlaceHits,
  placeFromWorldCountry,
} from "@/lib/world-countries";
import {
  reverseUrl,
  searchUrl,
  viewboxAround,
  autocompleteUrl,
  DESTINATION_TAGS,
  classifyGeoStatus,
  nextDelayMs,
  readGeoJson,
  type GeoProvider,
} from "@/lib/geo-endpoints";
import { mapsPlaceUrl } from "@/lib/direction-stops";

export type ParsedPlace = {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  /** Nominatim's `type`, used to work out what kind of stop this is. */
  placeType?: string;
  lat?: number;
  lon?: number;
  source: string;
  url: string;
  /**
   * Set when a link gave up nothing useful — a short link the page would not
   * resolve for us, or a site that serves nothing to a bot. The caller should
   * say so rather than presenting an empty draft as a successful read.
   */
  partial?: boolean;
  /**
   * Why it gave up nothing, when `partial` is set. The interface needs this to
   * say something true: telling someone to paste a longer link is useless when
   * the page was never reached, and telling them the site shared nothing is
   * wrong when the request itself failed.
   */
  partialReason?: PartialReason;
  /**
   * The name is good but Béa could not put it on the map — no coordinates in
   * the link, and nothing locating enough to look up safely. The caller should
   * say so: an empty map with no explanation is what let a wrong location go
   * unnoticed in the first place.
   */
  unlocated?: boolean;
  /** OSM's opening_hours, when the place carries it. Not stored yet. */
  openingHours?: string;
};

/**
 * `unreachable`  the request did not complete — network, TLS, timeout, or a
 *                server with no outbound access at all.
 * `refused`      the page answered, but not with a page: 403, 404, a login
 *                wall, a redirect chain that ran out.
 * `no-details`   the page was read fine and simply carries no place in it.
 */
export type PartialReason = "unreachable" | "refused" | "no-details";

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function meta(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return undefined;
}

function nameFromAppleMapsUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "maps.apple.com" && !host.endsWith(".maps.apple.com")) return undefined;
    const q =
      new URL(url).searchParams.get("name") ||
      new URL(url).searchParams.get("address") ||
      new URL(url).searchParams.get("q");
    const cleaned = q?.trim();
    if (!cleaned || cleaned.length < 2 || cleaned.length > 120) return undefined;
    // Coordinate-only q= is not a place name.
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(cleaned)) return undefined;
    return cleaned;
  } catch {
    return undefined;
  }
}

const ParsePlaceLinkInput = z.object({
  url: z.string().min(1).max(4000),
  nameHint: z.string().min(1).max(120).optional(),
  addressHint: z.string().min(1).max(200).optional(),
});

function normalizePlaceLinkInput(data: unknown): {
  url: string;
  nameHint?: string;
  addressHint?: string;
} {
  const raw = ParsePlaceLinkInput.parse(data);
  const extracted = extractPastedPlaceLink(raw.url);
  if (!extracted) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["url"],
        message: "Paste a Maps, Yelp, or place link.",
      },
    ]);
  }
  const hint = raw.nameHint?.trim() || extracted.nameHint;
  // The address the share sheet printed above the link is the strongest
  // locating signal Béa gets for a short link, and it costs nothing.
  const addressHint = raw.addressHint?.trim() || extracted.addressHint;
  return {
    url: extracted.url,
    ...(hint ? { nameHint: hint } : {}),
    ...(addressHint ? { addressHint } : {}),
  };
}

const UA = "BeaTravelApp/1.0 (travel memory vault)";

/**
 * Coordinates to a city and a country, through the same provider as the rest.
 *
 * This used to call BigDataCloud — a third company doing a job both of the
 * other two already do, with its own terms and its own outage. The address
 * object comes back with the locality under whichever of several keys fits
 * the country, which is why the fallback chain is long rather than fussy: a
 * hamlet, a town and a city are all "where you are".
 */
async function reverse(lat: number, lon: number) {
  const { geoProvider } = await import("@/lib/geo-provider.server");
  try {
    const provider = geoProvider();
    const res = await fetch(reverseUrl(provider, lat, lon), {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return {};
    const d = (await readGeoJson(provider, "reverse", res)) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        hamlet?: string;
        municipality?: string;
        suburb?: string;
        state?: string;
        country?: string;
      };
    };
    const a = d.address ?? {};
    return {
      city: a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || a.state,
      country: a.country,
    };
  } catch {
    return {};
  }
}

type NominatimHit = NominatimHitLike;

/**
 * How long the caller of `nominatim()` must wait before its next call.
 *
 * One search tries several spelling variants (`fuzzyQueryVariants`), and a
 * nearby miss retries worldwide — up to a handful of requests for one search
 * box. Nothing paced them against each other, unlike the batch lookups in
 * `directions.functions.ts` and `geocode-plan.functions.ts`, so a search that
 * needed more than one variant could burst past the provider's one-a-second
 * (or two-a-second, on LocationIQ) policy and throw partway through — before
 * the worldwide fallback below ever ran. Shared across both the nearby and
 * worldwide passes of one search, the same way a batch import shares it
 * across stops.
 */
type Pace = { provider: GeoProvider; sent: number[] };

async function wait(pace: Pace) {
  const delay = nextDelayMs(pace.provider, pace.sent, Date.now());
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  pace.sent.push(Date.now());
}

/**
 * A geocoder hiccup is not "no such place".
 *
 * Returning [] on every non-200 made a rate limit, an outage and a real miss
 * look identical — Recs said nothing matched while Nominatim was refusing the
 * request. Throw on anything that should be retried so the search box can say
 * the map was unreachable; only a clean empty answer means the name is gone.
 */
async function nominatim(
  q: string,
  limit: number,
  area?: { viewbox: string; bounded: boolean },
  pace?: Pace,
): Promise<NominatimHit[]> {
  // Server-only: the token must not be compiled into the client bundle.
  const { geoProvider } = await import("@/lib/geo-provider.server");
  const { PUBLIC_PROVIDER } = await import("@/lib/geo-endpoints");
  const provider = geoProvider();
  if (pace) await wait(pace);
  const options = {
    query: q,
    limit,
    format: "jsonv2" as const,
    addressDetails: true,
    nameDetails: true,
    // Recovers a chain's name for a branch OSM maps with no name of its own
    // — see extraTags in geo-endpoints.ts.
    extraTags: true,
    language: "en",
    ...(area ? { viewbox: area.viewbox, bounded: area.bounded } : {}),
  };

  const headers = {
    "user-agent": UA,
    accept: "application/json",
    "accept-language": "en",
  } as const;

  async function fetchProvider(which: typeof provider) {
    return fetch(searchUrl(which, options), {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
  }

  let res: Response;
  let answered = provider;
  try {
    res = await fetchProvider(provider);
  } catch (error) {
    // A thrown fetch (timeout, DNS, TLS) never reaches the !res.ok branch
    // below. A keyed service is the one we can replace; Nominatim failures
    // stay failures so the box can say the map was unreachable.
    if (!provider.token) throw error;
    answered = PUBLIC_PROVIDER;
    res = await fetchProvider(PUBLIC_PROVIDER);
  }
  // HTTP errors from a keyed service (400, bad key, …) — same idea.
  if (!res.ok && answered.token) {
    answered = PUBLIC_PROVIDER;
    res = await fetchProvider(PUBLIC_PROVIDER);
  }
  const verdict = classifyGeoStatus(res.status);
  if (verdict === "retry" || res.status === 401 || res.status === 403) {
    throw new Error(`Geocoder temporarily unavailable (${res.status})`);
  }
  if (verdict !== "ok") return [];
  const json = (await readGeoJson(answered, "search", res)) as NominatimHit[];
  return Array.isArray(json) ? json : [];
}

function hitToPlace(h: NominatimHit): ParsedPlace {
  const found = placeFromNominatim(h);
  return {
    ...found,
    source: "Web search",
    // Saved on the recommendation and tapped months later, so it wants to
    // open the phone's maps app rather than the OpenStreetMap website. The
    // data still comes from OSM; this is only where the link goes.
    url: mapsPlaceUrl(found.name, { lat: found.lat, lon: found.lon }),
  };
}

/**
 * Run the typed name and its typo / possessive forms against the geocoder.
 *
 * When looking nearby, keep going after a street or park hit so a later
 * possessive variant can still find the shop — "harvey" hits Rue Harvey
 * (highway) before Harvey's (amenity). Around the world, the first non-empty
 * answer is enough; unique landmarks should not wait on extras.
 */
async function nominatimVariants(
  query: string,
  area: { viewbox: string; bounded: boolean } | undefined,
  pace: Pace,
  prefer: "venue" | "area" = "venue",
): Promise<NominatimHit[]> {
  let fallback: NominatimHit[] = [];
  // Choosing a destination: the fuzzy variants ("japa", "japan's") exist to
  // find shops, and a place people travel to is spelt as typed.
  const variants = prefer === "area" ? [foldAccents(query)] : fuzzyQueryVariants(query);
  for (const variant of variants) {
    const batch = await nominatim(variant, 10, area, pace);
    if (!batch.length) continue;
    // A destination is a country, a region or a town — never the restaurant
    // in Ohio that happens to be called "Japan".
    if (prefer === "area") {
      const places = batch.filter((hit) => !isVenueHit(hit));
      if (places.length) return places;
      if (!fallback.length) fallback = batch;
      continue;
    }
    // Prefer a venue over whatever else came back, bounded or not. Returning
    // the first non-empty worldwide batch outright — as this used to do —
    // trusted Nominatim's raw ranking for a query like "subway", which is
    // also a transit system and an ordinary word, and a country or a metro
    // station can rank ahead of the sandwich shop that was actually meant.
    const venues = batch.filter(isVenueHit);
    // The name exactly as typed is a town or country: that is the answer,
    // with any venues of the same name after it, and no spelling variants.
    // Worldwide only — near you, a chain's branch is still what is meant.
    const exact = !area && variant === variants[0] ? exactPlaceHits(batch, query) : [];
    if (exact.length) return [...exact, ...venues];
    if (venues.length) return venues;
    if (!fallback.length) fallback = batch;
  }
  // A bounded search that never turned up a venue is not a real answer, even
  // when Nominatim handed back something: a chain with no branch in this box
  // still gets a "best effort" reply, and that reply is the city or region
  // itself — "Montreal, Quebec" for "subway" — because that is the largest
  // thing inside the viewbox, not because it is what was asked for. Handing
  // that up would end the search right here: `hits` reads as non-empty, so
  // the worldwide retry in searchPlaces never runs, and the city stands in
  // for a shop it is not.
  //
  // Worldwide has nowhere further to fall back to, so once every variant has
  // been tried, a non-venue hit is kept as a last resort — it can still be
  // the actual answer to a search for a landmark or a neighbourhood by name,
  // which is not a venue either.
  return area ? [] : fallback;
}

/**
 * OSM tags around a point, from the public Overpass servers: the main one,
 * then an independent mirror. An empty list on any failure — the geocoder is
 * still there behind it, so a slow Overpass costs a few seconds, not a search.
 */
async function overpassPlaces(
  intent: PoiIntent,
  at: { lat: number; lon: number },
  radiusM: number,
): Promise<PoiHit[]> {
  // A kind of place, with Geoapify configured: its Places API first. The
  // public Overpass servers time out or refuse often enough that "coffee
  // near me" came back empty; Geoapify answers from the same OSM data with a
  // key. Its places are checked against the same tags, and Overpass is still
  // there if Geoapify fails.
  if (intent.kind === "category" && intent.geoapify) {
    const { geoProvider } = await import("@/lib/geo-provider.server");
    const provider = geoProvider();
    if (provider.name === "geoapify") {
      try {
        const res = await fetch(geoapifyPlacesUrl(provider.token, intent.geoapify, at, radiusM), {
          headers: { "user-agent": UA, accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
          const elements = geoapifyPlacesToElements(await res.json()).filter((e) =>
            matchesCategory(e.tags, intent),
          );
          const hits = readOverpass(elements, at);
          if (hits.length) return hits;
        } else {
          console.warn(`[places] Geoapify places answered ${res.status}`);
        }
      } catch (error) {
        console.warn(
          `[places] Geoapify places failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  const body = overpassQuery(intent, at, radiusM);
  for (const base of [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ]) {
    try {
      const res = await fetch(base, {
        method: "POST",
        body: new URLSearchParams({ data: body }),
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        console.warn(`[places] Overpass ${new URL(base).host} answered ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return readOverpass(json.elements ?? [], at);
    } catch (error) {
      // Logged so a quiet fallback is visible in the server log; then the mirror.
      console.warn(
        `[places] Overpass ${new URL(base).host} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return [];
}

function poiToPlace(hit: PoiHit): ParsedPlace {
  return {
    name: hit.name,
    ...(hit.address ? { address: hit.address } : {}),
    ...(hit.city ? { city: hit.city } : {}),
    ...(hit.country ? { country: hit.country } : {}),
    ...(hit.category ? { category: hit.category } : {}),
    ...(hit.placeType ? { placeType: hit.placeType } : {}),
    ...(hit.openingHours ? { openingHours: hit.openingHours } : {}),
    lat: hit.lat,
    lon: hit.lon,
    source: "OpenStreetMap",
    url: mapsPlaceUrl(hit.name, { lat: hit.lat, lon: hit.lon }),
  };
}

/** LocationIQ autocomplete's answer, as the search's hits look. */
type AutocompleteHit = {
  lat: string;
  lon: string;
  display_name?: string;
  display_place?: string;
  /** Geoapify's, translated in geoapify.ts; LocationIQ uses display_place. */
  name?: string;
  class?: string;
  type?: string;
  address?: Record<string, string>;
  namedetails?: Record<string, string>;
};

/**
 * Autocomplete, read into the same shape as a search hit so ranking, labels
 * and the venue rules all apply unchanged. Empty when the provider has no
 * autocomplete (public Nominatim) or the call fails — never an error, because
 * the full search is still behind it.
 */
async function autocompleteHits(
  query: string,
  pace: Pace,
  opts: { areas: boolean; area?: { viewbox: string; bounded: boolean } },
): Promise<NominatimHit[]> {
  const url = autocompleteUrl(pace.provider, {
    query,
    limit: 10,
    language: "en",
    ...(opts.areas ? { tags: DESTINATION_TAGS } : {}),
    ...(opts.area ? { viewbox: opts.area.viewbox, bounded: opts.area.bounded } : {}),
  });
  if (!url) return [];
  try {
    await wait(pace);
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const json = (await readGeoJson(pace.provider, "search", res)) as AutocompleteHit[];
    if (!Array.isArray(json)) return [];
    const hits: NominatimHit[] = json.map((raw) => ({
      lat: raw.lat,
      lon: raw.lon,
      ...(raw.address?.["name"] || raw.display_place || raw.name
        ? { name: raw.address?.["name"] || raw.display_place || raw.name }
        : {}),
      ...(raw.namedetails ? { namedetails: raw.namedetails } : {}),
      ...(raw.display_name ? { display_name: raw.display_name } : {}),
      ...(raw.class ? { class: raw.class } : {}),
      ...(raw.type ? { type: raw.type } : {}),
      ...(raw.address ? { address: raw.address } : {}),
    }));
    return opts.areas ? hits.filter((hit) => !isVenueHit(hit)) : hits;
  } catch {
    return [];
  }
}

/** Nearby look-alikes first, then the geocoder's answers, without repeats. */
function mergeNearbyFirst(nearby: ParsedPlace[], rest: ParsedPlace[]): ParsedPlace[] {
  const out = [...nearby];
  for (const place of rest) {
    const twin = out.some(
      (p) =>
        p.name.toLowerCase() === place.name.toLowerCase() &&
        p.lat != null &&
        place.lat != null &&
        p.lon != null &&
        place.lon != null &&
        haversine({ lat: p.lat, lon: p.lon }, { lat: place.lat, lon: place.lon }) < 60,
    );
    if (!twin) out.push(place);
  }
  return out.slice(0, 10);
}

/** Search the web for a place by name, so anything can be saved without a link. */
export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        query: z.string().min(2).max(200),
        /**
         * Where the person is, so a search for a chain finds the branch they
         * mean. "Subway" is thousands of identical places and an unanchored
         * lookup answers with one on another continent, or with nothing
         * recognisable — which reads as "there isn't one" while they are
         * standing outside it.
         */
        at: z.object({ lat: z.number(), lon: z.number() }).nullish(),
        /**
         * The trip's city and country, sent apart from the name so that when
         * the name is several names ("Peace Park / Atomic Bomb Dome", "Shrine
         * (厳島神社)") each part can be asked for in the same place.
         */
        near: z.string().max(200).nullish(),
        /**
         * Choosing where a trip goes: countries and towns, not venues. Adds
         * countries that start with what is typed, skips the tag search, and
         * drops shops and restaurants from the geocoder's answer.
         */
        areas: z.boolean().nullish(),
        /**
         * The middle of the trip, when there is no position: where "coffee"
         * or "subway" should be looked for while planning from home.
         */
        center: z.object({ lat: z.number(), lon: z.number() }).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data: input }): Promise<ParsedPlace[]> => {
    const name = input.query;
    const within = (q: string) => (input.near ? `${q}, ${input.near}` : q);
    const data = { ...input, query: within(name) };
    const local = localPlaceHits(data.query);
    if (local.length) return local;
    const typedCountries = input.areas
      ? countriesStartingWith(name).map(placeFromWorldCountry)
      : [];

    // A chain or a kind of place, with somewhere to look around: ask OSM's
    // tags first (see poi-search.ts). A category is answered by its tags
    // alone; a name is, when the answer is that exact brand or name —
    // otherwise its nearby look-alikes go first and the geocoder still runs.
    const anchor = input.at ?? input.center ?? null;
    const intent = anchor && !input.areas ? poiIntent(name) : null;
    let nearbyFirst: ParsedPlace[] = [];
    if (anchor && intent) {
      const radius = input.at ? RADIUS_NEAR_YOU_M : RADIUS_AROUND_TRIP_M;
      const found = await overpassPlaces(intent, anchor, radius);
      if (found.length) {
        const places = found.slice(0, 10).map(poiToPlace);
        if (intent.kind === "category") return places;
        if (found.some((hit) => isExactPoiMatch(hit, intent.text))) {
          return found
            .filter((hit) => isExactPoiMatch(hit, intent.text))
            .slice(0, 10)
            .map(poiToPlace);
        }
        nearbyFirst = places.slice(0, 5);
      }
    }
    // Server-only: the token must not be compiled into the client bundle.
    const { geoProvider } = await import("@/lib/geo-provider.server");
    const categoryHere = Boolean(anchor && intent?.kind === "category");
    // Shared across every variant tried below, nearby and worldwide alike, so
    // a search that needs several attempts paces them instead of bursting
    // past the provider's own rate limit.
    const pace: Pace = { provider: geoProvider(), sent: [] };
    // Nearby first, and actually bounded — a soft viewbox is ignored for
    // chains. If the box is empty (Eiffel Tower while standing in Montreal,
    // or a chain that is not in this city), fall back to the world so
    // turning location on does not make every other search go blank.
    const area = data.at
      ? { viewbox: viewboxAround(data.at.lat, data.at.lon), bounded: true }
      : undefined;
    let hits: NominatimHit[] = [];
    // "coffee" near you is a kind of place, not a word to look for: with
    // nothing tagged nearby, the geocoder may look only around the same
    // point, never worldwide — where "coffee" found a school called "CofE"
    // in Chester for someone standing in Montreal.
    if (categoryHere && anchor) {
      try {
        const around = { viewbox: viewboxAround(anchor.lat, anchor.lon), bounded: true };
        hits = await nominatimVariants(data.query, around, pace);
      } catch {
        hits = [];
      }
      return hits.length ? refineNominatimHits(hits, data.query).map(hitToPlace) : [];
    }
    // Search-as-you-type first, where the provider has it (LocationIQ): it
    // understands a half-typed name and can be held to towns and countries.
    // Nothing from it, or no such service, and the full search below runs.
    hits = await autocompleteHits(data.query, pace, {
      areas: Boolean(input.areas),
      ...(area ? { area } : {}),
    });
    if (!hits.length && area) {
      try {
        hits = await nominatimVariants(data.query, area, pace, input.areas ? "area" : "venue");
      } catch {
        // A rate limit or outage on the *bounded* attempt must not skip the
        // worldwide fallback below — only a worldwide failure should reach
        // the caller as "couldn't reach the map."
        hits = [];
      }
    }
    if (!hits.length) {
      try {
        hits = await nominatimVariants(data.query, undefined, pace, input.areas ? "area" : "venue");
      } catch (error) {
        // "Jap" still has Japan to offer when the map service is busy.
        if (!typedCountries.length) throw error;
        return typedCountries;
      }
    }
    // Still nothing: the name may be a list, or carry its local-script name in
    // brackets. One plain request per part, in the same place, first answer
    // wins. A failure here returns what there is rather than an error: the
    // full name was already asked for successfully.
    let asked = data.query;
    // A venue that is not in the trip's city (a day trip away): the answers
    // above are the city itself, so set them aside and look in the country,
    // then anywhere, by the name alone.
    const venueNear = Boolean(input.near && !input.areas);
    if (venueNear) hits = dropBareAreas(hits, name);
    if (!hits.length && venueNear && input.near) {
      for (const wider of widerQueries(name, input.near)) {
        try {
          hits = dropBareAreas(await nominatimVariants(wider, undefined, pace, "venue"), name);
        } catch {
          break;
        }
        if (hits.length) {
          asked = wider;
          break;
        }
      }
    }
    if (!hits.length) {
      // Each part in the trip's city, then — for a stop away from it — in
      // the trip's country.
      const places = (part: string) =>
        venueNear && input.near
          ? [within(part), widerQueries(part, input.near)[0]!]
          : [within(part)];
      search: for (const part of placeQueryParts(name, 3)) {
        for (const q of places(part)) {
          try {
            hits = dropBareAreas(await nominatim(q, 10, undefined, pace), part);
          } catch {
            break search;
          }
          if (hits.length) {
            asked = q;
            break search;
          }
        }
      }
    }
    const refined = refineNominatimHits(hits, asked);
    const places = (refined.length ? refined : hits).map(hitToPlace);
    const ranked = fuzzyRank(
      places,
      asked,
      (place) => [place.name, place.address, place.city, place.country],
      0,
    );
    // Searching near you: the nearest branch is the answer, whatever order the
    // map service ranked them in. Sort is stable, so equal distances keep it.
    const at = data.at;
    if (typedCountries.length) {
      const rest = ranked.filter(
        (p) => !typedCountries.some((c) => c.name.toLowerCase() === p.name.toLowerCase()),
      );
      return [...typedCountries, ...rest].slice(0, 10);
    }
    if (nearbyFirst.length) return mergeNearbyFirst(nearbyFirst, ranked);
    if (!at) return ranked;
    const away = (p: ParsedPlace) =>
      p.lat != null && p.lon != null ? haversine(at, { lat: p.lat, lon: p.lon }) : Infinity;
    return [...ranked].sort((a, b) => away(a) - away(b));
  });

/** Pull a place out of a pasted link: title, address, category and coordinates. */
export const parsePlaceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => normalizePlaceLinkInput(data))
  .handler(async ({ data }): Promise<ParsedPlace> => {
    const target = new URL(data.url);

    let html = "";
    let finalUrl = target.toString();
    let failure: FetchFailure | undefined;
    try {
      const fetched = await fetchPlaceHtml(data.url);
      html = fetched.html;
      finalUrl = fetched.finalUrl;
      failure = fetched.failure;
    } catch (error) {
      if (error instanceof UnsupportedPlaceUrlError) throw error;
      // Nothing below needs the page, so carry on with URL-only parsing — but
      // remember that the read failed, so the message can say which it was.
      failure = "unreachable";
    }

    // Google puts the name and often the street address in one path segment
    // on a /place/ URL — or, on the older ?q=Name,+Address&ftid=… share
    // shape, which has no /place/ segment at all, in the q= param instead.
    const fromPath = splitPlacePathName(
      placePathSegment(data.url) ||
        placePathSegment(finalUrl) ||
        googleQueryPlaceText(data.url) ||
        googleQueryPlaceText(finalUrl),
    );
    const placeName = fromPath.name;
    const coords = resolvePlaceCoords(data.url, finalUrl, Boolean(placeName));
    const place = coords ? await reverse(coords.lat, coords.lon) : {};

    const rawTitle =
      meta(html, "og:site_name") && meta(html, "og:title")
        ? meta(html, "og:title")!
        : (meta(html, "og:title") ??
          meta(html, "twitter:title") ??
          decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ""));

    const titleName = cleanPageTitle(rawTitle || "");

    const appleName = nameFromAppleMapsUrl(data.url) ?? nameFromAppleMapsUrl(finalUrl);
    const name = placeName || titleName || data.nameHint || appleName || "Saved place";

    const description = meta(html, "og:description") ?? "";
    const addressMatch = description.match(/([\dA-Za-zÀ-ÿ.,'’\- ]+\d[\dA-Za-zÀ-ÿ.,'’\- ]*)/);

    // The path address is the place's own, and the share sheet's is the same
    // thing typed out by the app that shared it; the og:description one is a
    // guess pulled out of prose, so it only fills a gap.
    const address =
      fromPath.address ??
      data.addressHint ??
      (addressMatch?.[1] ? addressMatch[1].trim().slice(0, 160) : undefined);

    // No coordinates in the link (a blocked page, a short link that would not
    // resolve): the name and address can be looked up instead — but only when
    // the query actually says *where*.
    //
    // This used to search on whatever it had and keep the first worldwide
    // result. A link to a Harvey's in Montreal carries the name and nothing
    // else, the top global hit for "Harvey's" is in Slovakia, and that was
    // saved with a city, a country and coordinates, looking exactly like a
    // place Béa knew. An empty map is obviously empty; "Slovakia" looks like
    // an answer, which makes it the worse failure by far.
    if (!coords) {
      const named = name !== "Saved place" ? name : "";
      const searchName = placeName || named || data.nameHint || appleName || "";
      const locatable = queryIsLocatable({ name: searchName, address });
      const query = [searchName, address].filter(Boolean).join(", ");
      let found: ParsedPlace | undefined;
      if (locatable && query.length > 2) {
        try {
          const hit = (await nominatim(query, 1))[0];
          found = hit ? hitToPlace(hit) : undefined;
        } catch {
          // A geocoder outage here must not fail the whole paste — keep the
          // name and leave the map empty, same as a miss.
        }
      }
      // And the answer has to look like the question: Nominatim always returns
      // its best effort, never nothing, so an unmatched query still comes back
      // with a place attached.
      if (found && geocodeIsTrustworthy({ name: searchName, address, hitName: found.name })) {
        return {
          ...found,
          name: searchName || found.name,
          ...(address ? { address } : {}),
          source: target.hostname.replace(/^www\./, ""),
          url: data.url,
        };
      }
      // Otherwise fall through: keep the name and the link, leave the map
      // empty. Every add form already offers a map search to finish the job.
    }

    // Nothing but the URL came back: no name of its own, nowhere on the map.
    const gotNothing = name === "Saved place" && !coords && !address;
    // A name with nowhere to put it. Not a failed read — the name is right and
    // worth keeping — but the map is empty and saying nothing about that is
    // how the old "Slovakia" result slipped through unannounced.
    const unlocated = !gotNothing && !coords;
    const partialReason: PartialReason =
      failure === "unreachable" || failure === "bad-url"
        ? "unreachable"
        : failure === "http-error" || failure === "blocked-host"
          ? "refused"
          : "no-details";

    return {
      name,
      ...(address ? { address } : {}),
      ...(place.city ? { city: place.city } : {}),
      ...(place.country ? { country: place.country } : {}),
      ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
      source: target.hostname.replace(/^www\./, ""),
      url: data.url,
      ...(gotNothing ? { partial: true, partialReason } : {}),
      ...(unlocated ? { unlocated: true } : {}),
    };
  });

/** Look up the city and country for a set of coordinates. */
export const lookupCoords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ lat: z.number().gte(-90).lte(90), lon: z.number().gte(-180).lte(180) }).parse(data),
  )
  .handler(async ({ data }) => reverse(data.lat, data.lon));
