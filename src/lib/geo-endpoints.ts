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

export type GeoProvider = {
  /** Which service is answering, for logs and for the attribution line. */
  name: "nominatim" | "locationiq";
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
 * User-Agent instead. Everything else is the same query string, which is the
 * point.
 */
export function searchUrl(provider: GeoProvider, options: SearchOptions): string {
  const params = new URLSearchParams();
  params.set("q", options.query);
  params.set("format", options.format ?? "json");
  params.set("limit", String(options.limit ?? 1));
  if (options.addressDetails) params.set("addressdetails", "1");
  if (options.nameDetails) params.set("namedetails", "1");
  if (options.language) params.set("accept-language", options.language);
  if (options.viewbox) params.set("viewbox", options.viewbox);
  if (options.bounded && options.viewbox) params.set("bounded", "1");
  if (provider.token) params.set("key", provider.token);
  return `${provider.searchBase}/search?${params.toString()}`;
}

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
  const params = new URLSearchParams({
    format: "jsonv2",
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
  return provider.name === "locationiq" ? "walking" : "foot";
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
