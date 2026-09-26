/**
 * Which geocoder and router Béa is talking to, and how fast it may talk.
 *
 * Every lookup went straight to OpenStreetMap's own Nominatim and OSRM's demo
 * router — free, keyless, and the reason imports are slow. Their usage policy
 * is one request a second, which is where `PLAN_LOOKUP_GAP_MS` came from, and
 * which is why placing eighteen stops takes twenty seconds and needed a
 * running dog to watch. The policy also asks people not to do systematic
 * geocoding on the public endpoint, which is exactly what this app does.
 *
 * LocationIQ speaks the same dialect — the same `/search?format=json` request,
 * the same `[{lat, lon, display_name, class, type}]` answer, and an
 * OSRM-compatible directions endpoint — so switching is a base URL and a
 * token rather than a rewrite. That compatibility is the whole reason to
 * prefer it: nothing above this file has to know which one answered.
 *
 * The URLs are built here, away from the token, so they can be tested. The
 * token lives in `geo-provider.server.ts` and never reaches the browser.
 */

import {
  GEOAPIFY_BASE,
  geoapifyAutocompleteUrl,
  geoapifyReverseUrl,
  geoapifyRouteUrl,
  geoapifySearchUrl,
  geoapifyToNominatim,
  geoapifyToOsrm,
} from "./geoapify.ts";

export type GeoProvider = {
  /** Which service is answering, for logs and for the attribution line. */
  name: "nominatim" | "locationiq" | "geoapify";
  /** No trailing slash. */
  searchBase: string;
  routeBase: string;
  /** Empty on the keyless public endpoints. */
  token: string;
  /**
   * Milliseconds between requests.
   *
   * Nominatim's policy is one a second. LocationIQ's free tier allows two a
   * second but caps a minute at sixty, so a sustained 1/s is what a long plan
   * actually gets — the gap below is the burst rate, and `perMinute` is what
   * keeps a big import from tripping the other limit.
   */
  gapMs: number;
  perMinute: number;
};

/** The public endpoints: no key, slow, and strictly speaking not for this. */
export const PUBLIC_PROVIDER: GeoProvider = {
  name: "nominatim",
  searchBase: "https://nominatim.openstreetmap.org",
  routeBase: "https://router.project-osrm.org",
  token: "",
  gapMs: 1_100,
  perMinute: 60,
};

/** LocationIQ, once a token exists. Same shapes, a faster allowance. */
export function locationIqProvider(token: string): GeoProvider {
  return {
    name: "locationiq",
    searchBase: "https://us1.locationiq.com/v1",
    routeBase: "https://us1.locationiq.com/v1/directions",
    token,
    gapMs: 500,
    perMinute: 60,
  };
}

/**
 * Geoapify, once a key exists. OpenStreetMap data, answered in its own shape
 * and translated back in `geoapify.ts`. Its terms allow keeping results, it
 * routes walking with a key rather than a demo server, and the free plan
 * allows five requests a second (3,000 a day).
 */
export function geoapifyProvider(key: string): GeoProvider {
  return {
    name: "geoapify",
    searchBase: GEOAPIFY_BASE,
    routeBase: GEOAPIFY_BASE,
    token: key,
    gapMs: 250,
    perMinute: 240,
  };
}

export type SearchOptions = {
  query: string;
  limit?: number;
  /**
   * `jsonv2` carries the address breakdown and name tags the place parser
   * reads; plain `json` is enough when only a point is wanted.
   */
  format?: "json" | "jsonv2";
  addressDetails?: boolean;
  nameDetails?: boolean;
  /**
   * OSM's free-form tags, `brand` among them.
   *
   * Many chain locations are mapped with no `name` of their own — only
   * `brand=Subway` on an otherwise anonymous point — because the branch has
   * no name beyond the chain's. Without this, that node's own name is empty
   * and the place parser falls back all the way to the city it is in, so a
   * real, in-stock Subway reads as a search that found nothing but "Montreal."
   */
  extraTags?: boolean;
  /** "*" asks for the local name — 清水寺 rather than a translation of it. */
  language?: string;
  /**
   * A box around the search, as "x1,y1,x2,y2".
   *
   * On its own this is almost worthless for chains. Nominatim (and LocationIQ
   * speaking the same dialect) will still answer with a Subway on another
   * continent, because "prefer" is a soft hint that identical shop names
   * ignore. Pair it with `bounded: true` when the person asked to look near
   * them — that is the only form that actually finds the one they can walk to.
   */
  viewbox?: string;
  /**
   * Restrict results to the viewbox.
   *
   * Without this, a search for "subway" or "harveys" near you returns the
   * same worldwide list it would have without a box at all — and Recs looks
   * empty of anything useful, or empty entirely when nothing worldwide
   * matches the typed spelling.
   */
  bounded?: boolean;
};

/**
 * A geocoding URL for whichever provider is configured.
 *
 * LocationIQ takes `key`; Nominatim takes none and is identified by its
 * User-Agent instead. Everything else is the same query string — almost.
 * LocationIQ's documented formats are `json` and `xml` only. `jsonv2` is a
 * Nominatim extension; send it to LocationIQ and the answer is HTTP 400
 * "Invalid Request", which Recs treated as "no such place" for every search
 * the moment `LOCATIONIQ_TOKEN` was set. Coerce here so callers can keep
 * asking for jsonv2 on Nominatim without breaking the paid provider.
 */
export function searchUrl(provider: GeoProvider, options: SearchOptions): string {
  if (provider.name === "geoapify") return geoapifySearchUrl(provider.token, options);
  const params = new URLSearchParams();
  params.set("q", options.query);
  const format = provider.name === "locationiq" ? "json" : (options.format ?? "json");
  params.set("format", format);
  params.set("limit", String(options.limit ?? 1));
  if (options.addressDetails) params.set("addressdetails", "1");
  if (options.nameDetails) params.set("namedetails", "1");
  if (options.extraTags) params.set("extratags", "1");
  if (options.language) params.set("accept-language", options.language);
  if (options.viewbox) params.set("viewbox", options.viewbox);
  if (options.bounded && options.viewbox) params.set("bounded", "1");
  if (provider.token) params.set("key", provider.token);
  return `${provider.searchBase}/search?${params.toString()}`;
}

/**
 * Search-as-you-type, where the provider offers it.
 *
 * LocationIQ's autocomplete matches the start of words ("olive et g" finds
 * Olive et Gourmando), answers faster than a full search, and can be told to
 * return only towns and countries. The public Nominatim server has no such
 * thing and its usage policy forbids building one on it, so there this is
 * null and the ordinary search carries on alone.
 *
 * Same OpenStreetMap data as the search: it changes how well a half-typed
 * name is understood, not which places exist.
 */
export type AutocompleteOptions = {
  query: string;
  limit?: number;
  /** Only these OSM kinds, as "class:type" ("place:city") or "class" ("amenity"). */
  tags?: readonly string[];
  viewbox?: string;
  bounded?: boolean;
  language?: string;
};

export function autocompleteUrl(
  provider: GeoProvider,
  options: AutocompleteOptions,
): string | null {
  if (provider.name === "geoapify") return geoapifyAutocompleteUrl(provider.token, options);
  if (provider.name !== "locationiq" || !provider.token) return null;
  const params = new URLSearchParams();
  params.set("key", provider.token);
  params.set("q", options.query);
  params.set("limit", String(Math.min(options.limit ?? 10, 20)));
  params.set("dedupe", "1");
  if (options.tags?.length) params.set("tag", options.tags.join(","));
  if (options.viewbox) params.set("viewbox", options.viewbox);
  if (options.bounded && options.viewbox) params.set("bounded", "1");
  if (options.language) params.set("accept-language", options.language);
  return `https://api.locationiq.com/v1/autocomplete?${params.toString()}`;
}

/** The kinds a trip destination can be: a country, a region, a town. */
export const DESTINATION_TAGS = [
  "place:country",
  "place:state",
  "place:region",
  "place:province",
  "place:island",
  "place:city",
  "place:town",
  "place:village",
  "boundary:administrative",
] as const;

/**
 * Coordinates back into a city and a country.
 *
 * This was a third company — BigDataCloud — reached directly, in two places,
 * one of them from the browser. Three services holding pieces of the same job
 * is three sets of terms, three outages and, for the client-side one, the
 * person's exact position leaving their phone for a company the app never
 * names. Both providers here already answer this, so it belongs on the seam
 * with everything else.
 */
export function reverseUrl(provider: GeoProvider, lat: number, lon: number): string {
  if (provider.name === "geoapify") return geoapifyReverseUrl(provider.token, lat, lon);
  // Same jsonv2 trap as searchUrl — LocationIQ 400s it.
  const format = provider.name === "locationiq" ? "json" : "jsonv2";
  const params = new URLSearchParams({
    format,
    lat: String(lat),
    lon: String(lon),
    "accept-language": "en",
  });
  if (provider.token) params.set("key", provider.token);
  return `${provider.searchBase}/reverse?${params.toString()}`;
}

/** A routing URL. Both providers serve OSRM's shape, so callers parse one thing. */
export function routeUrl(
  provider: GeoProvider,
  profile: string,
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): string {
  if (provider.name === "geoapify") {
    return geoapifyRouteUrl(
      provider.token,
      profile === "driving" ? "driving" : "walking",
      from,
      to,
    );
  }
  const params = new URLSearchParams({ overview: "false", steps: "true" });
  if (provider.token) params.set("key", provider.token);
  const pair = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  return `${provider.routeBase}/route/v1/${profile}/${pair}?${params.toString()}`;
}

/**
 * The credit OSM's licence asks for, wherever its data is shown.
 *
 * ODbL requires attributing OpenStreetMap contributors for derived data, and
 * both providers serve OSM underneath, so this is owed either way. It was
 * owed before this file existed, too, and nobody had written it down.
 */
export const OSM_ATTRIBUTION = "Places and routes © OpenStreetMap contributors";

/** Geoapify's own credit, which its free plan asks for beside its results. */
export const GEOAPIFY_ATTRIBUTION = "Powered by Geoapify";

/** Stops the map misses are found in Overture's listings (CDLA Permissive 2.0). */
export const OVERTURE_ATTRIBUTION = "Places © Overture Maps Foundation";

/**
 * OSRM's profile names are not the same on both services.
 *
 * The public demo router calls walking "foot". LocationIQ's fork calls it
 * "walking" and rejects "foot" outright, so the seam would have swapped the
 * base URL and then asked for a profile that does not exist — every walking
 * leg failing the moment a token was set, and failing quietly, because a
 * route that does not come back is already handled as "no route".
 */
export function routeProfile(provider: GeoProvider, mode: "walking" | "driving"): string {
  if (mode === "driving") return "driving";
  return provider.name === "nominatim" ? "foot" : "walking";
}

/**
 * What a response status means for a batch that is still running.
 *
 * `!res.ok → null` treated every failure as "no such place". A rate limit
 * therefore looked exactly like a venue that does not exist: the stop was
 * marked unfindable, remembered as tried, and never looked up again. The
 * difference matters most precisely when a provider is pushing back.
 */
export function classifyGeoStatus(status: number): "ok" | "retry" | "miss" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 429 || status === 408 || status >= 500) return "retry";
  return "miss";
}

/**
 * How long to wait before the next request, honouring both limits at once.
 *
 * A provider that allows two a second and sixty a minute is not a provider
 * that allows 120 a minute. The burst rate empties the minute's allowance in
 * thirty seconds, so a long import needs to know about the slower ceiling or
 * it walks into a wall of 429s halfway through.
 *
 * `recent` holds the timestamps of requests already made, newest last.
 */
export function nextDelayMs(provider: GeoProvider, recent: readonly number[], now: number): number {
  const last = recent[recent.length - 1];
  const sinceLast = last === undefined ? Infinity : now - last;
  const burstWait = sinceLast >= provider.gapMs ? 0 : provider.gapMs - sinceLast;

  const windowStart = now - 60_000;
  const inWindow = recent.filter((at) => at > windowStart);
  if (inWindow.length < provider.perMinute) return burstWait;

  // The minute is full: wait for the oldest request in it to age out.
  const oldest = inWindow[inWindow.length - provider.perMinute] ?? windowStart;
  return Math.max(burstWait, oldest + 60_000 - now);
}

/**
 * A box around a point, for a nearby search.
 *
 * Searching for a chain by name — "subway", "pret", "starbucks" — is the case
 * that breaks without this. There are thousands, the geocoder has no idea
 * which one is meant, and an unanchored search answers with one in another
 * country or with nothing recognisable at all. A person searching for Subway
 * means the one they can walk to.
 *
 * The default radius is wide enough that a shop a short drive past the
 * densest part of town still falls inside when the search is bounded — the
 * earlier 12 km box cut off too much of a city once `bounded=1` was required
 * for the box to do anything at all.
 *
 * Degrees of longitude shrink towards the poles, so the east-west span is
 * widened by latitude. Without that, a box in Reykjavík is half the intended
 * width and one in Singapore is right.
 */
export function viewboxAround(lat: number, lon: number, km = 25): string {
  const latSpan = km / 111;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lonSpan = km / (111 * Math.max(cosLat, 0.01));
  const clampLat = (v: number) => Math.max(-90, Math.min(90, v));
  const wrapLon = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;
  return [
    wrapLon(lon - lonSpan),
    clampLat(lat + latSpan),
    wrapLon(lon + lonSpan),
    clampLat(lat - latSpan),
  ]
    .map((n) => n.toFixed(5))
    .join(",");
}

/**
 * A response's JSON in the shape callers parse: a Nominatim array for
 * "search", one Nominatim object for "reverse", OSRM's `{routes}` for
 * "route". Only Geoapify needs translating; the others already speak it.
 */
export async function readGeoJson(
  provider: GeoProvider,
  kind: "search" | "reverse" | "route",
  res: Response,
): Promise<unknown> {
  const json: unknown = await res.json();
  if (provider.name !== "geoapify") return json;
  if (kind === "route") return geoapifyToOsrm(json);
  const hits = geoapifyToNominatim(json);
  return kind === "reverse" ? (hits[0] ?? {}) : hits;
}
