/**
 * Searching for a kind of place, or a chain, around a point.
 *
 * Nominatim is a geocoder: it turns a name or an address into a point. Asked
 * for "subway" it ranks every Subway on Earth, plus the transit systems and a
 * street or two, and picks by importance, not by where you are. That is how
 * two branches an hour away came back while one sat on the next block.
 *
 * OpenStreetMap already answers the real question in its tags. A branch is
 * mapped `brand=Subway` even when it has no name of its own; a café is
 * `amenity=cafe`; a sushi bar carries `cuisine=sushi`. Overpass reads those
 * tags directly around a point, so "subway", "coffee" and "sushi" become
 * lookups rather than guesses. Named places and addresses stay with the
 * geocoder, which is what it is for.
 *
 * Pure: builds the query and reads the answer. The request itself lives in
 * places.functions.ts.
 */
import { foldAccents } from "./fuzzy.ts";
import { haversine, type LatLon } from "./geo.ts";

/** One tag filter, as Overpass writes it: ["key"="value"] or ["key"~"regex",i]. */
type TagFilter = { key: string; value: string; regex?: boolean };

/**
 * `geoapify`: the same kind of place in Geoapify's category names, for its
 * Places API. Its answers are checked against `filters` all the same, so a
 * broader category there only costs a few results filtered out here.
 */
type Category = { label: string; filters: TagFilter[]; geoapify?: string };

const exact = (key: string, value: string): TagFilter => ({ key, value });
const like = (key: string, value: string): TagFilter => ({ key, value, regex: true });

/**
 * Words people type for a kind of place, and the tags that mean it. Singular,
 * accent-free and lower case; plurals and accents are folded before lookup.
 */
const CATEGORIES: Record<string, Category> = {
  coffee: {
    label: "Coffee",
    filters: [exact("amenity", "cafe"), like("cuisine", "coffee")],
    geoapify: "catering.cafe",
  },
  cafe: { label: "Cafés", filters: [exact("amenity", "cafe")], geoapify: "catering.cafe" },
  "coffee shop": {
    label: "Coffee",
    filters: [exact("amenity", "cafe")],
    geoapify: "catering.cafe",
  },
  bakery: {
    label: "Bakeries",
    filters: [exact("shop", "bakery")],
    geoapify: "commercial.food_and_drink.bakery",
  },
  boulangerie: {
    label: "Bakeries",
    filters: [exact("shop", "bakery")],
    geoapify: "commercial.food_and_drink.bakery",
  },
  bagel: {
    label: "Bagels",
    filters: [like("cuisine", "bagel"), like("name", "bagel")],
    geoapify: "catering",
  },
  sushi: { label: "Sushi", filters: [like("cuisine", "sushi")], geoapify: "catering.restaurant" },
  ramen: { label: "Ramen", filters: [like("cuisine", "ramen")], geoapify: "catering.restaurant" },
  pizza: {
    label: "Pizza",
    filters: [like("cuisine", "pizza")],
    geoapify: "catering.restaurant,catering.fast_food",
  },
  burger: {
    label: "Burgers",
    filters: [like("cuisine", "burger")],
    geoapify: "catering.restaurant,catering.fast_food",
  },
  "ice cream": {
    label: "Ice cream",
    filters: [exact("amenity", "ice_cream"), like("cuisine", "ice_cream")],
    geoapify: "catering.ice_cream",
  },
  gelato: {
    label: "Ice cream",
    filters: [exact("amenity", "ice_cream"), like("cuisine", "ice_cream")],
    geoapify: "catering.ice_cream",
  },
  restaurant: {
    label: "Restaurants",
    filters: [exact("amenity", "restaurant")],
    geoapify: "catering.restaurant",
  },
  bar: { label: "Bars", filters: [exact("amenity", "bar")], geoapify: "catering.bar" },
  pub: { label: "Pubs", filters: [exact("amenity", "pub")], geoapify: "catering.pub" },
  brewery: {
    label: "Breweries",
    filters: [like("craft", "brewery"), like("microbrewery", "yes")],
    geoapify: "catering",
  },
  museum: {
    label: "Museums",
    filters: [exact("tourism", "museum")],
    geoapify: "entertainment.museum",
  },
  musee: {
    label: "Museums",
    filters: [exact("tourism", "museum")],
    geoapify: "entertainment.museum",
  },
  gallery: {
    label: "Galleries",
    filters: [exact("tourism", "gallery")],
    geoapify: "entertainment.culture",
  },
  park: { label: "Parks", filters: [exact("leisure", "park")], geoapify: "leisure.park" },
  hotel: { label: "Hotels", filters: [exact("tourism", "hotel")], geoapify: "accommodation.hotel" },
  pharmacy: {
    label: "Pharmacies",
    filters: [exact("amenity", "pharmacy")],
    geoapify: "healthcare.pharmacy",
  },
  supermarket: {
    label: "Supermarkets",
    filters: [exact("shop", "supermarket")],
    geoapify: "commercial.supermarket",
  },
  grocery: {
    label: "Groceries",
    filters: [exact("shop", "supermarket"), exact("shop", "convenience")],
    geoapify: "commercial.supermarket,commercial.convenience",
  },
  atm: { label: "ATMs", filters: [exact("amenity", "atm")], geoapify: "service.financial.atm" },
  toilet: { label: "Toilets", filters: [exact("amenity", "toilets")], geoapify: "amenity.toilet" },
  bookstore: {
    label: "Bookshops",
    filters: [exact("shop", "books")],
    geoapify: "commercial.books",
  },
  bookshop: { label: "Bookshops", filters: [exact("shop", "books")], geoapify: "commercial.books" },
  market: {
    label: "Markets",
    filters: [exact("amenity", "marketplace")],
    geoapify: "commercial.marketplace",
  },
  temple: {
    label: "Temples",
    filters: [exact("amenity", "place_of_worship"), like("religion", "buddhist")],
    geoapify: "religion.place_of_worship",
  },
  shrine: {
    label: "Shrines",
    filters: [like("religion", "shinto")],
    geoapify: "religion.place_of_worship",
  },
};

/** "Bagels" → "bagel", "cafés" → "cafe", "Coffee shops" → "coffee shop". */
function categoryKey(query: string): string | null {
  const q = foldAccents(query)
    .replace(/['’]/g, "")
    .replace(/\s+near me$/, "")
    .trim();
  if (CATEGORIES[q]) return q;
  const singular = q
    .replace(/(ie)s$/, "y")
    .replace(/(s|x|z|ch|sh)es$/, "$1")
    .replace(/s$/, "");
  if (CATEGORIES[singular]) return singular;
  return null;
}

export type PoiIntent =
  | { kind: "category"; label: string; filters: TagFilter[]; geoapify?: string }
  | { kind: "brand"; text: string };

/**
 * Geoapify's broad categories a chain can be in: somewhere to eat, shop, sleep
 * or go. A brand search asks all of them with the name, and `matchesBrand`
 * keeps only that brand.
 */
export const BRAND_CATEGORIES =
  "catering,commercial,accommodation,entertainment,leisure,tourism,service,healthcare";

/**
 * Whether a place's tags are the chain a brand search asked for — the same
 * rule the Overpass query uses: the brand itself, or a name (or English
 * name) that starts with it, apostrophes and a plural s optional.
 */
export function matchesBrand(tags: Readonly<Record<string, string>>, text: string): boolean {
  const key = (v: string) => foldAccents(v).replace(/['’]/g, "").trim();
  const want = key(text).replace(/s$/, "");
  if (!want) return false;
  const brand = tags["brand"] ? key(tags["brand"]).replace(/s$/, "") : "";
  if (brand === want) return true;
  return [tags["name"], tags["name:en"]].some((n) => n != null && key(n).startsWith(want));
}

/** Whether a place's tags are the kind a category search asked for. */
export function matchesCategory(
  tags: Readonly<Record<string, string>>,
  intent: Extract<PoiIntent, { kind: "category" }>,
): boolean {
  return intent.filters.some((f) => {
    const value = tags[f.key];
    if (!value) return false;
    return f.regex ? value.toLowerCase().includes(f.value.toLowerCase()) : value === f.value;
  });
}

/**
 * What kind of search this is. Null means "leave it to the geocoder": an
 * address, a long phrase, or anything with a number in it is not a brand.
 */
export function poiIntent(query: string): PoiIntent | null {
  const q = query.trim();
  if (q.length < 2 || q.length > 40) return null;
  const key = categoryKey(q);
  if (key) return { kind: "category", ...CATEGORIES[key]! };
  // Addresses and long phrases belong to the geocoder.
  if (/\d/.test(q) || q.split(/\s+/).length > 4 || /,/.test(q)) return null;
  // "subways" was typed for "Subway": the plural is how people say chains.
  const text = q.replace(/['’]?s$/i, "").trim() || q;
  return { kind: "brand", text };
}

/** A regex that matches `value` literally. */
function regexEscape(value: string): string {
  return value.replace(/[\\^$.|?*+()[\]{}]/g, "\\$&");
}

/**
 * A regex source, ready for Overpass's double-quoted strings, where a
 * backslash and a quote must themselves be escaped.
 */
function qlString(regex: string): string {
  return regex.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Matches the name with or without its apostrophes: "Mandys", "Mandy's", "Mandy’s". */
function apostropheTolerant(text: string): string {
  return [...text.replace(/['’]/g, "")].map(regexEscape).join("['’]?");
}

function filterQL(f: TagFilter): string {
  return f.regex
    ? `["${f.key}"~"${qlString(regexEscape(f.value))}",i]`
    : `["${f.key}"="${f.value}"]`;
}

/**
 * The Overpass request for an intent around a point. Brand searches match the
 * `brand` tag or the start of the `name`, so a branch mapped with only a brand
 * is found, and so is "Mandy's" by its own name.
 */
export function overpassQuery(intent: PoiIntent, at: LatLon, radiusM: number, limit = 40): string {
  const around = `(around:${Math.round(radiusM)},${at.lat.toFixed(5)},${at.lon.toFixed(5)})`;
  const parts: string[] = [];
  if (intent.kind === "category") {
    for (const f of intent.filters) parts.push(`nwr${around}${filterQL(f)}["name"];`);
  } else {
    const t = qlString(apostropheTolerant(intent.text));
    // The trailing s was taken off as a plural; the chain may be named with it.
    parts.push(`nwr${around}["brand"~"^${t}(['’]?s)?$",i];`);
    parts.push(`nwr${around}["name"~"^${t}",i];`);
    // A place mapped under its local name (厳島神社) is found by its English
    // one ("Itsukushima Shrine") only through this tag.
    parts.push(`nwr${around}["name:en"~"^${t}",i];`);
  }
  return `[out:json][timeout:15];(${parts.join("")});out center tags ${limit};`;
}

export type OverpassElement = {
  type?: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type PoiHit = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  placeType?: string;
  openingHours?: string;
  /** The chain, when OSM tags one: a branch is often named only by this. */
  brand?: string;
  /** OSM's name:en, when the place carries one. */
  nameEn?: string;
  distanceM: number;
};

const KIND_KEYS = ["amenity", "shop", "tourism", "leisure", "craft"] as const;

/**
 * The answer, as places: named, placed, nearest first, one per spot. Streets
 * and bus stops that happen to share a chain's name are dropped — a brand
 * search wants somewhere you can walk into.
 */
export function readOverpass(elements: readonly OverpassElement[], at: LatLon): PoiHit[] {
  const out: PoiHit[] = [];
  for (const e of elements) {
    const tags = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (lat == null || lon == null) continue;
    const kindKey = KIND_KEYS.find((k) => tags[k]);
    if (!kindKey) continue; // a road, a stop, a boundary: not a place to go
    const local = tags["name"] || tags["brand"];
    if (!local) continue;
    // A name in another script gets its English one first, the local one
    // kept beside it: "Itsukushima Shrine (厳島神社)", which is both what the
    // person typed and what the sign says.
    const english = tags["name:en"];
    const name =
      english && english !== local && /[^\u0020-\u024F]/.test(local)
        ? `${english} (${local})`
        : local;
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    const city = tags["addr:city"];
    const address = [street, city].filter(Boolean).join(", ");
    out.push({
      id: `${e.type ?? "node"}/${e.id}`,
      name,
      lat,
      lon,
      ...(address ? { address } : {}),
      ...(city ? { city } : {}),
      ...(tags["addr:country"] ? { country: tags["addr:country"] } : {}),
      category: kindKey,
      placeType: tags[kindKey]!,
      ...(tags["opening_hours"] ? { openingHours: tags["opening_hours"] } : {}),
      ...(tags["brand"] ? { brand: tags["brand"] } : {}),
      ...(english ? { nameEn: english } : {}),
      distanceM: haversine(at, { lat, lon }),
    });
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  // The same café mapped as a node and as its building is one place.
  const kept: PoiHit[] = [];
  for (const hit of out) {
    const twin = kept.some(
      (k) =>
        foldAccents(k.name) === foldAccents(hit.name) && Math.abs(k.distanceM - hit.distanceM) < 40,
    );
    if (!twin) kept.push(hit);
  }
  return kept;
}

/** How far to look: walking distance around you, a city around a trip. */
export const RADIUS_NEAR_YOU_M = 2_000;
export const RADIUS_AROUND_TRIP_M = 6_000;

/** "Tim Horton's", "tim hortons", "Tim Hortons" → one key. */
function nameKey(value: string): string {
  return foldAccents(value).replace(/['’]/g, "").replace(/s$/, "").trim();
}

/**
 * Whether a hit is the thing asked for, not only something whose name starts
 * the same way: the brand itself, or a place with exactly that name. "Paris"
 * typed in Montreal is not answered by "Paris Pizza" alone.
 */
export function isExactPoiMatch(
  hit: Pick<PoiHit, "name" | "brand" | "nameEn">,
  text: string,
): boolean {
  const want = nameKey(text);
  return (
    nameKey(hit.name) === want ||
    (hit.brand != null && nameKey(hit.brand) === want) ||
    (hit.nameEn != null && nameKey(hit.nameEn) === want)
  );
}
