/**
 * Working out what a place *is*, so picking it off the map fills in the rest.
 *
 * Nominatim reports a café as `type: "cafe"` with `addresstype: "amenity"`.
 * The label Béa kept was the addresstype, which is why the only category on
 * offer was the word "amenity". The type is the useful half.
 */

export type PlaceKindInput = {
  /** Nominatim `type` — "cafe", "hotel", "aerodrome", "museum", … */
  placeType?: string | undefined;
  /** The coarser addresstype Béa already stored. */
  category?: string | undefined;
  /** Falls back to reading the name when a link gave us no type at all. */
  name?: string | undefined;
};

export type TimelineKind = "activity" | "meal" | "transport" | "lodging" | "note";

const MEAL = [
  "restaurant",
  "cafe",
  "coffee",
  "bar",
  "pub",
  "bistro",
  "brasserie",
  "fast_food",
  "food_court",
  "ice_cream",
  "bakery",
  "patisserie",
  "biergarten",
  "taverna",
  "trattoria",
  "osteria",
  "izakaya",
  "winery",
  "brewery",
  "deli",
];

const LODGING = [
  "hotel",
  "hostel",
  "motel",
  "guest_house",
  "guesthouse",
  "bed_and_breakfast",
  "apartment",
  "chalet",
  "camp_site",
  "campsite",
  "caravan_site",
  "resort",
  "ryokan",
  "riad",
  "auberge",
];

const TRANSPORT = [
  "aerodrome",
  "airport",
  "terminal",
  "station",
  "halt",
  "bus_station",
  "bus_stop",
  "ferry_terminal",
  "ferry",
  "train_station",
  "railway",
  "subway",
  "tram_stop",
  "car_rental",
  "taxi",
  "port",
  "harbour",
  "marina",
];

/**
 * Words in a place's own name, for when no type came back at all.
 *
 * Bracketed with `(^|\W)…(\W|$)` rather than `\b`: `\b` is ASCII-only, so it
 * does not match after the accented "café" and the hint was never found.
 */
const NAME_HINTS: [TimelineKind, RegExp][] = [
  [
    "lodging",
    /(^|\W)(hotel|hostel|motel|inn|b&b|bed and breakfast|guesthouse|resort|lodge|ryokan)(\W|$)/i,
  ],
  [
    "transport",
    /(^|\W)(airport|a[ée]roport|aeroporto|flughafen|aeropuerto|station|gare|bahnhof|terminal|ferry|pier)(\W|$)/i,
  ],
  [
    "meal",
    /(^|\W)(restaurant|caf[ée]|coffee|bar|pub|bistro|brasserie|trattoria|osteria|pizzeria|taqueria|izakaya|bakery|boulangerie|p[âa]tisserie)(\W|$)/i,
  ],
];

function haystack(input: PlaceKindInput): string {
  return `${input.placeType ?? ""} ${input.category ?? ""}`.toLowerCase().replace(/[\s-]+/g, "_");
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

/**
 * The timeline entry kind a place should default to. Always returns something
 * sensible; "activity" is the honest default for a museum, park or shop.
 */
export function timelineKindForPlace(input: PlaceKindInput): TimelineKind {
  const text = haystack(input);
  if (text.trim()) {
    if (hasAny(text, LODGING)) return "lodging";
    if (hasAny(text, TRANSPORT)) return "transport";
    if (hasAny(text, MEAL)) return "meal";
  }
  const name = input.name ?? "";
  for (const [kind, pattern] of NAME_HINTS) {
    if (pattern.test(name)) return kind;
  }
  return "activity";
}

/** An airport or station on a route is a stopover, not a destination. */
export function stopKindForPlace(input: PlaceKindInput): "destination" | "layover" {
  return timelineKindForPlace(input) === "transport" ? "layover" : "destination";
}

/** True when the hit is a city/town rather than a venue inside one. */
export function isLocalityCategory(category: string | undefined): boolean {
  if (!category) return false;
  return [
    "city",
    "town",
    "village",
    "hamlet",
    "municipality",
    "suburb",
    "neighbourhood",
    "county",
    "state",
    "country",
    "island",
  ].includes(category.toLowerCase().replace(/\s+/g, "_"));
}

/**
 * A category worth showing a person. "amenity" is not one; "Cafe" is.
 * Falls back to the coarse category, then to a plain "Place".
 */
export function prettyPlaceCategory(input: PlaceKindInput): string {
  const pick = [input.placeType, input.category].find(
    (value) => value && value.trim() && value.trim().toLowerCase() !== "amenity",
  );
  const raw = (pick ?? "").trim().replace(/_/g, " ");
  if (!raw) return "Place";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** One line saying what was filled in, so a silent auto-fill is visible. */
export function filledFromMapSummary(filled: {
  address?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  lat?: number | null | undefined;
}): string {
  const parts: string[] = [];
  if (filled.address) parts.push("address");
  if (filled.city || filled.country) parts.push("city");
  if (filled.lat != null) parts.push("map pin");
  if (parts.length === 0) return "";
  const list =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Filled in the ${list} from the map.`;
}
