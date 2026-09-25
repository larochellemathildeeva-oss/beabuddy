/**
 * Geoapify, translated into the shapes the rest of Béa already reads.
 *
 * Béa's place search, pins and directions were written against OpenStreetMap's
 * Nominatim (an array of `{lat, lon, display_name, class, type, address,
 * namedetails}`) and the OSRM router (`{routes: [{distance, duration, legs}]}`).
 * LocationIQ speaks both dialects, which is why it could be swapped in by URL.
 * Geoapify answers in its own: `{results: [...]}` for geocoding and GeoJSON
 * for routing. Rather than teach every caller a second shape, the answer is
 * translated here, once, and nothing above `geo-endpoints.ts` has to know
 * which service answered.
 *
 * Why Geoapify at all: its terms let results be stored (the pins saved onto
 * stops and recs), it routes walking as well as driving with a key rather
 * than a demo server, and it is built on the same OpenStreetMap data — so a
 * place Béa could find before is still there, found more reliably.
 *
 * Pure: URL building and translation only, so each rule is tested.
 */

export const GEOAPIFY_BASE = "https://api.geoapify.com";

/** Nominatim's viewbox "lon1,lat1,lon2,lat2" as Geoapify's "rect:lon1,lat1,lon2,lat2". */
export function rectFromViewbox(viewbox: string): string | null {
  const n = viewbox.split(",").map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [x1, y1, x2, y2] = n as [number, number, number, number];
  return `rect:${Math.min(x1, x2)},${Math.min(y1, y2)},${Math.max(x1, x2)},${Math.max(y1, y2)}`;
}

/** The middle of a viewbox, as Geoapify's "proximity:lon,lat". */
function proximityFromViewbox(viewbox: string): string | null {
  const n = viewbox.split(",").map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [x1, y1, x2, y2] = n as [number, number, number, number];
  return `proximity:${(x1 + x2) / 2},${(y1 + y2) / 2}`;
}

export type GeoapifySearch = {
  query: string;
  limit?: number;
  /** Two letters, or "*" / nothing for the service's default. */
  language?: string;
  viewbox?: string;
  /** Only inside the viewbox; otherwise it only leans the ranking towards it. */
  bounded?: boolean;
};

function searchParams(key: string, options: GeoapifySearch): URLSearchParams {
  const params = new URLSearchParams();
  params.set("text", options.query);
  params.set("format", "json");
  params.set("limit", String(Math.max(1, Math.min(options.limit ?? 1, 20))));
  const lang = options.language?.slice(0, 2);
  if (lang && /^[a-z]{2}$/.test(lang)) params.set("lang", lang);
  if (options.viewbox) {
    const rect = rectFromViewbox(options.viewbox);
    if (rect && options.bounded) params.set("filter", rect);
    const near = proximityFromViewbox(options.viewbox);
    if (near) params.set("bias", near);
  }
  params.set("apiKey", key);
  return params;
}

export function geoapifySearchUrl(key: string, options: GeoapifySearch): string {
  return `${GEOAPIFY_BASE}/v1/geocode/search?${searchParams(key, options).toString()}`;
}

/** Search-as-you-type, matching the start of words. */
export function geoapifyAutocompleteUrl(key: string, options: GeoapifySearch): string {
  return `${GEOAPIFY_BASE}/v1/geocode/autocomplete?${searchParams(key, options).toString()}`;
}

export function geoapifyReverseUrl(key: string, lat: number, lon: number): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "json",
    lang: "en",
    apiKey: key,
  });
  return `${GEOAPIFY_BASE}/v1/geocode/reverse?${params.toString()}`;
}

/** Waypoints are "lat,lon" here, the other way round from OSRM. */
export function geoapifyRouteUrl(
  key: string,
  mode: "walking" | "driving",
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): string {
  const params = new URLSearchParams({
    waypoints: `${from.lat},${from.lon}|${to.lat},${to.lon}`,
    mode: mode === "walking" ? "walk" : "drive",
    lang: "en",
    apiKey: key,
  });
  return `${GEOAPIFY_BASE}/v1/routing?${params.toString()}`;
}

/** One Geoapify geocoding result — only the fields Béa reads. */
export type GeoapifyResult = {
  lat?: number;
  lon?: number;
  name?: string;
  formatted?: string;
  address_line1?: string;
  housenumber?: string;
  street?: string;
  suburb?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  result_type?: string;
  category?: string;
  place_id?: string;
  rank?: { importance?: number; confidence?: number };
  bbox?: { lon1: number; lat1: number; lon2: number; lat2: number };
  datasource?: { raw?: Record<string, unknown> };
};

/** The OSM tag keys that say what kind of thing a place is, most telling first. */
const KIND_KEYS = [
  "amenity",
  "shop",
  "tourism",
  "leisure",
  "historic",
  "railway",
  "public_transport",
  "aeroway",
  "man_made",
  "natural",
  "office",
  "craft",
  "healthcare",
  "building",
  "place",
  "boundary",
] as const;

/** Geoapify's top-level category, as the OSM class a Nominatim hit would carry. */
const CATEGORY_CLASS: Record<string, string> = {
  catering: "amenity",
  commercial: "shop",
  accommodation: "tourism",
  tourism: "tourism",
  entertainment: "tourism",
  leisure: "leisure",
  heritage: "historic",
  religion: "amenity",
  education: "amenity",
  healthcare: "amenity",
  service: "amenity",
  public_transport: "public_transport",
  airport: "aeroway",
  natural: "natural",
  building: "building",
};

/** Areas, as Nominatim tags them: a town is `place`, a region `boundary`. */
const AREA_TYPES: Record<string, [string, string]> = {
  country: ["boundary", "administrative"],
  state: ["boundary", "administrative"],
  county: ["boundary", "administrative"],
  city: ["place", "city"],
  postcode: ["place", "postcode"],
  suburb: ["place", "suburb"],
  district: ["place", "quarter"],
  street: ["highway", "residential"],
};

function kindOf(r: GeoapifyResult): { class: string; type: string } {
  const raw = r.datasource?.raw ?? {};
  for (const key of KIND_KEYS) {
    const value = raw[key];
    if (typeof value === "string" && value && !(key === "building" && value === "yes")) {
      return { class: key, type: value };
    }
  }
  const area = r.result_type ? AREA_TYPES[r.result_type] : undefined;
  if (area) return { class: area[0], type: area[1] };
  const [top, sub] = (r.category ?? "").split(".");
  if (top && CATEGORY_CLASS[top]) return { class: CATEGORY_CLASS[top]!, type: sub || top };
  return { class: "place", type: r.result_type || "yes" };
}

/** Every name the place carries — "name", "name:en", "name:ja" — as namedetails does. */
function nameDetails(r: GeoapifyResult): Record<string, string> | undefined {
  const raw = r.datasource?.raw ?? {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      (key === "name" || key.startsWith("name:") || key.endsWith("_name")) &&
      typeof value === "string"
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** A Nominatim-shaped hit, as the parsers above read it. */
export type NominatimShaped = {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  class: string;
  type: string;
  category: string;
  importance?: number;
  place_id?: string;
  boundingbox?: string[];
  address: Record<string, string>;
  namedetails?: Record<string, string>;
  extratags?: Record<string, string>;
};

export function toNominatimHit(r: GeoapifyResult): NominatimShaped | null {
  if (typeof r.lat !== "number" || typeof r.lon !== "number") return null;
  const kind = kindOf(r);
  const address: Record<string, string> = {};
  const put = (key: string, value: string | undefined) => {
    if (value) address[key] = value;
  };
  put("house_number", r.housenumber);
  put("road", r.street);
  put("suburb", r.suburb);
  put("neighbourhood", r.district);
  put("city", r.city);
  put("county", r.county);
  put("state", r.state);
  put("postcode", r.postcode);
  put("country", r.country);
  put("country_code", r.country_code);
  const name = r.name || (kind.class !== "place" && kind.class !== "boundary" ? "" : r.city || "");
  if (name) address[kind.class] = name;
  const raw = r.datasource?.raw ?? {};
  const brand = typeof raw["brand"] === "string" ? (raw["brand"] as string) : "";
  const names = nameDetails(r);
  return {
    lat: String(r.lat),
    lon: String(r.lon),
    display_name: r.formatted || [r.name, r.city, r.country].filter(Boolean).join(", "),
    ...(r.name ? { name: r.name } : {}),
    class: kind.class,
    type: kind.type,
    category: kind.class,
    ...(typeof r.rank?.importance === "number" ? { importance: r.rank.importance } : {}),
    ...(r.place_id ? { place_id: r.place_id } : {}),
    ...(r.bbox
      ? {
          boundingbox: [r.bbox.lat1, r.bbox.lat2, r.bbox.lon1, r.bbox.lon2].map(String),
        }
      : {}),
    address,
    ...(names ? { namedetails: names } : {}),
    ...(brand ? { extratags: { brand } } : {}),
  };
}

/** `{results: [...]}` as the array Nominatim would have sent. */
export function geoapifyToNominatim(json: unknown): NominatimShaped[] {
  const results = (json as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((r) => toNominatimHit(r as GeoapifyResult))
    .filter((hit): hit is NominatimShaped => hit !== null);
}

/** An OSRM-shaped route, as `leg()` in directions.functions.ts reads it. */
export type OsrmShaped = {
  routes: {
    distance: number;
    duration: number;
    legs: { steps: { distance: number; instruction?: string }[] }[];
  }[];
};

type GeoapifyRoute = {
  distance?: number;
  time?: number;
  legs?: { steps?: { distance?: number; instruction?: { text?: string } }[] }[];
};

/** GeoJSON (the default) or `format=json`, as OSRM's `{routes: [...]}`. */
export function geoapifyToOsrm(json: unknown): OsrmShaped {
  const j = json as { features?: { properties?: GeoapifyRoute }[]; results?: GeoapifyRoute[] };
  const route = j?.features?.[0]?.properties ?? j?.results?.[0];
  if (!route || typeof route.distance !== "number" || typeof route.time !== "number") {
    return { routes: [] };
  }
  return {
    routes: [
      {
        distance: route.distance,
        duration: route.time,
        legs: (route.legs ?? []).map((leg) => ({
          steps: (leg.steps ?? []).map((step) => ({
            distance: step.distance ?? 0,
            ...(step.instruction?.text ? { instruction: step.instruction.text } : {}),
          })),
        })),
      },
    ],
  };
}

/**
 * Kinds of place around a point, from Geoapify's Places API: "cafés within
 * 2 km", nearest first. `categories` is its comma-separated category names.
 */
export function geoapifyPlacesUrl(
  key: string,
  categories: string,
  at: { lat: number; lon: number },
  radiusM: number,
  limit = 40,
  /** Only places with this name — a chain, "McDonald's" — among those categories. */
  name?: string,
): string {
  const params = new URLSearchParams({
    categories,
    ...(name ? { name } : {}),
    filter: `circle:${at.lon},${at.lat},${Math.round(radiusM)}`,
    bias: `proximity:${at.lon},${at.lat}`,
    limit: String(Math.max(1, Math.min(limit, 100))),
    lang: "en",
    apiKey: key,
  });
  return `${GEOAPIFY_BASE}/v2/places?${params.toString()}`;
}

type PlaceFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: GeoapifyResult & { categories?: string[] };
};

/** An OSM-style element, as `readOverpass` in poi-search.ts reads it. */
export type TaggedElement = {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

/**
 * Geoapify's places as the OpenStreetMap elements they came from.
 *
 * Its answer carries the original OSM tags (`datasource.raw`), so a café
 * found here goes through the very reader, filters and naming rules an
 * Overpass answer does. The address fields fill in whatever the tags lack,
 * and a place with no kind tag gets one from its Geoapify category.
 */
export function geoapifyPlacesToElements(json: unknown): TaggedElement[] {
  const features = (json as { features?: PlaceFeature[] })?.features;
  if (!Array.isArray(features)) return [];
  const out: TaggedElement[] = [];
  features.forEach((feature, i) => {
    const p = feature.properties ?? {};
    const lat = p.lat ?? feature.geometry?.coordinates?.[1];
    const lon = p.lon ?? feature.geometry?.coordinates?.[0];
    if (typeof lat !== "number" || typeof lon !== "number") return;
    const tags: Record<string, string> = {};
    for (const [key, value] of Object.entries(p.datasource?.raw ?? {})) {
      if (typeof value === "string" || typeof value === "number") tags[key] = String(value);
    }
    const fill = (key: string, value: string | undefined) => {
      if (value && !tags[key]) tags[key] = value;
    };
    fill("name", p.name);
    fill("addr:housenumber", p.housenumber);
    fill("addr:street", p.street);
    fill("addr:city", p.city);
    fill("addr:country", p.country);
    if (!["amenity", "shop", "tourism", "leisure", "craft"].some((k) => tags[k])) {
      const category = (p.categories ?? []).find((c) => c.includes(".")) ?? p.categories?.[0] ?? "";
      const [top, sub] = category.split(".");
      const kind = top ? CATEGORY_CLASS[top] : undefined;
      if (kind === "amenity" || kind === "shop" || kind === "tourism" || kind === "leisure") {
        tags[kind] = sub || top!;
      }
    }
    const osmId = Number(tags["osm_id"]);
    out.push({
      type: tags["osm_type"] === "w" ? "way" : tags["osm_type"] === "r" ? "relation" : "node",
      id: Number.isFinite(osmId) && osmId > 0 ? osmId : i + 1,
      lat,
      lon,
      tags,
    });
  });
  return out;
}

/** Details of the place at a point: hours, website, phone, access. */
export function geoapifyDetailsUrl(key: string, lat: number, lon: number): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    features: "details",
    lang: "en",
    apiKey: key,
  });
  return `${GEOAPIFY_BASE}/v2/place-details?${params.toString()}`;
}

export type PlaceFacts = {
  name?: string;
  /** Every name the place carries, for matching against what the stop is called. */
  names: string[];
  /** As OpenStreetMap writes it; read with opening-hours.ts. */
  openingHours?: string;
  website?: string;
  phone?: string;
  wheelchair?: string;
};

type DetailsProps = GeoapifyResult & {
  feature_type?: string;
  opening_hours?: string;
  website?: string;
  contact?: { phone?: string; email?: string };
  facilities?: { wheelchair?: boolean | string };
};

/** The "details" feature of a place-details answer, or null. */
export function readPlaceDetails(json: unknown): PlaceFacts | null {
  const features = (json as { features?: { properties?: DetailsProps }[] })?.features;
  if (!Array.isArray(features)) return null;
  const p =
    features.find((f) => f.properties?.feature_type === "details")?.properties ??
    features[0]?.properties;
  if (!p) return null;
  const raw = p.datasource?.raw ?? {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const openingHours = str(p.opening_hours) ?? str(raw["opening_hours"]);
  const website = str(p.website) ?? str(raw["website"]) ?? str(raw["contact:website"]);
  const phone = str(p.contact?.phone) ?? str(raw["phone"]) ?? str(raw["contact:phone"]);
  const wheel = p.facilities?.wheelchair ?? raw["wheelchair"];
  const wheelchair =
    wheel === true ? "yes" : wheel === false ? "no" : typeof wheel === "string" ? wheel : undefined;
  const names = [
    p.name,
    ...Object.entries(raw)
      .filter(([k]) => k === "name" || k.startsWith("name:"))
      .map(([, v]) => v),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
  return {
    ...(p.name ? { name: p.name } : {}),
    names: [...new Set(names)],
    ...(openingHours ? { openingHours } : {}),
    ...(website && /^https?:\/\//i.test(website) ? { website } : {}),
    ...(phone ? { phone } : {}),
    ...(wheelchair ? { wheelchair } : {}),
  };
}

/**
 * A picture of a day: its stops as numbered pins, joined in order by a line.
 *
 * Fitted to the pins by Geoapify when no centre is given. The line joins the
 * stops in visiting order — it is not the walking route, and the picture
 * says so where it is shown. Colours are Béa's primary and ink.
 */
export function geoapifyStaticMapUrl(
  key: string,
  points: readonly { lat: number; lon: number }[],
  size: { width: number; height: number } = { width: 640, height: 420 },
): string {
  const pins = points
    .slice(0, 30)
    .map(
      (p, i) =>
        `lonlat:${p.lon.toFixed(6)},${p.lat.toFixed(6)};type:material;color:#c2410c;size:medium;text:${i + 1};textsize:small`,
    )
    .join("|");
  const params = new URLSearchParams({
    style: "osm-bright",
    width: String(size.width),
    height: String(size.height),
    scaleFactor: "2",
    format: "jpeg",
    apiKey: key,
  });
  if (pins) params.set("marker", pins);
  if (points.length > 1) {
    const line = points
      .slice(0, 30)
      .map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`)
      .join(",");
    params.set("geometry", `polyline:${line};linecolor:#2c2623;linewidth:3;lineopacity:0.6`);
  }
  return `https://maps.geoapify.com/v1/staticmap?${params.toString()}`;
}

/** How Béa travels between stops, in Geoapify's words. */
export type TravelMode = "walk" | "drive";

type LonLat = [number, number];
const lonLat = (p: { lat: number; lon: number }): LonLat => [
  Number(p.lon.toFixed(6)),
  Number(p.lat.toFixed(6)),
];

/**
 * A request for travel times between every pair of `points` (Route Matrix).
 *
 * POST, because the points go in the body. Every point is both a source and
 * a target, so the answer is square and `[i][j]` is i to j. Geoapify charges
 * max(n, n) × min(n, 10) credits for it, which is why callers cap `points`.
 */
export function geoapifyMatrixRequest(
  key: string,
  mode: TravelMode,
  points: readonly { lat: number; lon: number }[],
): { url: string; body: string } {
  const at = points.map((p) => ({ location: lonLat(p) }));
  return {
    url: `${GEOAPIFY_BASE}/v1/routematrix?apiKey=${encodeURIComponent(key)}`,
    body: JSON.stringify({ mode, sources: at, targets: at }),
  };
}

/**
 * Seconds from each point to each other, or null where no route came back.
 *
 * Read by index from the entries themselves rather than by array position,
 * and sized to `n` whatever arrived, so a short or shuffled answer cannot
 * put one pair's time on another.
 */
export function readMatrix(json: unknown, n: number): (number | null)[][] {
  const out: (number | null)[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => null),
  );
  const rows = (json as { sources_to_targets?: unknown })?.sources_to_targets;
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const c = cell as { time?: unknown; source_index?: unknown; target_index?: unknown } | null;
      const i = c?.source_index;
      const j = c?.target_index;
      const t = c?.time;
      if (typeof i !== "number" || typeof j !== "number" || i < 0 || j < 0 || i >= n || j >= n) {
        continue;
      }
      if (typeof t === "number" && Number.isFinite(t) && t >= 0) out[i]![j] = t;
    }
  }
  return out;
}
