/**
 * The arithmetic behind the Recs tab's browsing: which of the five kinds a
 * place is, how its type reads, and what "recently saved" and a collection's
 * count mean. Pure, so the landing, Explore nearby and the saved list agree.
 */
import { recMapsUrl } from "./reco-open.ts";

export const BROWSE_KINDS = ["Restaurants", "Cafés", "Things to do", "Stays", "More"] as const;
export type BrowseKind = (typeof BROWSE_KINDS)[number];

const plain = (text: string) =>
  ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/** Checked in order; the first kind with a matching word wins. */
const KIND_WORDS: [Exclude<BrowseKind, "More">, string[]][] = [
  [
    "Cafés",
    ["cafe", "coffee", "ice cream", "bakery", "tea", "patisserie", "pastry", "brunch", "espresso"],
  ],
  [
    "Restaurants",
    [
      "restaurant",
      "fast food",
      "food court",
      "bistro",
      "brasserie",
      "trattoria",
      "pizza",
      "sushi",
      "ramen",
      "tapas",
      "meal",
      "bar",
      "pub",
      "biergarten",
      "eatery",
      "diner",
    ],
  ],
  [
    "Stays",
    [
      "hotel",
      "hostel",
      "guest house",
      "motel",
      "apartment",
      "chalet",
      "camp site",
      "lodging",
      "stay",
      "bed and breakfast",
      "b b",
      "ryokan",
    ],
  ],
  [
    "Things to do",
    [
      "attraction",
      "museum",
      "gallery",
      "viewpoint",
      "artwork",
      "zoo",
      "aquarium",
      "theme park",
      "castle",
      "monument",
      "memorial",
      "landmark",
      "sight",
      "park",
      "garden",
      "beach",
      "church",
      "cathedral",
      "temple",
      "shrine",
      "market",
      "marketplace",
      "theatre",
      "cinema",
      "activity",
      "tour",
      "information",
      "picnic site",
      "walk",
      "trail",
    ],
  ],
];

/** Which of the five kinds a place falls under, from its category text. */
export function browseKindOf(category: string | null | undefined): BrowseKind {
  const text = plain(category ?? "");
  if (text.trim() === "") return "More";
  for (const [kind, words] of KIND_WORDS) {
    if (words.some((word) => text.includes(` ${word} `))) return kind;
  }
  return "More";
}

/** Whether a place belongs under a chip ("All" takes everything). */
export function inBrowseKind(
  category: string | null | undefined,
  chip: BrowseKind | "All",
): boolean {
  return chip === "All" || browseKindOf(category) === chip;
}

const NICE: Record<string, string> = {
  cafe: "Café",
  fast_food: "Fast food",
  ice_cream: "Ice cream",
  marketplace: "Market",
  guest_house: "Guest house",
  camp_site: "Camp site",
  picnic_site: "Picnic site",
  theme_park: "Theme park",
  viewpoint: "Viewpoint",
  attraction: "Attraction",
  artwork: "Artwork",
  information: "Information",
  books: "Bookshop",
  clothes: "Clothes shop",
};

/** "fast_food" → "Fast food", "cafe" → "Café"; anything else capitalised. */
export function prettyTag(tag: string | null | undefined): string {
  const raw = (tag ?? "").trim();
  if (!raw) return "Place";
  const nice = NICE[raw.toLowerCase()];
  if (nice) return nice;
  const spaced = raw.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * About how long on foot, from the straight-line distance. Streets are not
 * straight, so the line is stretched by a third and walked at 4.8 km/h; it is
 * always shown as "about", never as a measured time.
 */
export function walkMinutesAbout(metres: number): number | null {
  if (!Number.isFinite(metres) || metres < 0) return null;
  return Math.max(1, Math.round((metres * 1.3) / 80));
}

/** The newest saves first, at most `n`. */
export function recentlySaved<T extends { created_at: string }>(
  rows: readonly T[],
  n: number,
): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, n);
}

/** How many saves each list holds; a row with no list is a recommendation. */
export function listCounts(
  rows: readonly { pin_type: string | null }[],
): Record<"reco" | "wishlist" | "nexttime" | "visited", number> {
  const out = { reco: 0, wishlist: 0, nexttime: 0, visited: 0 };
  for (const r of rows) {
    const t = (r.pin_type ?? "reco") as keyof typeof out;
    if (t in out) out[t] += 1;
    else out.reco += 1;
  }
  return out;
}

export const PARTS_OF_DAY = ["Morning", "Afternoon", "Evening"] as const;
export type PartOfDay = (typeof PARTS_OF_DAY)[number];

/**
 * The days a place can be added to on a trip: every date from start to end
 * (inclusive, at most 60), or none when the trip has no dates yet.
 */
export function tripDays(start: string | null, end: string | null): string[] {
  if (!start) return [];
  const last = end && end >= start ? end : start;
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return [];
  while (out.length < 60) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > last) break;
    out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Directions in the phone's maps app: to the pin, or to the place by name. */
export function directionsUrl(place: {
  name: string;
  address?: string | null | undefined;
  city?: string | null | undefined;
  country?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
}): string {
  if (place.lat != null && place.lon != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;
  }
  return recMapsUrl(place);
}
