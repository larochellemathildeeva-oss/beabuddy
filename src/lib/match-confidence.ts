/**
 * How sure Béa is that she found the right place.
 *
 * The geocoder has no opinion about this. It returns one result and no score,
 * so "Mandy's" and "Mandy's Old Montréal" and a suburb called Mandy come back
 * looking identical — a point, and nothing to say how much to trust it. Every
 * match was therefore presented the same way, which is to say silently, and
 * the wrong ones were indistinguishable from the right ones until someone
 * stood outside the wrong building.
 *
 * But the answer does carry evidence we were throwing away: what the place is
 * called in full, and what kind of thing OSM thinks it is. A restaurant whose
 * name appears in the result is a good match. A restaurant that came back as
 * a neighbourhood is not — it is the Old Montréal failure, which pinned a
 * café to the middle of a district, and it is detectable from the answer
 * rather than from luck.
 *
 * Three tiers, because the point is to interrupt for one of them and stay
 * quiet for the others. A wall of confirmations costs the same afternoon the
 * wrong pins did.
 */

import { looksLikeStreetAddress } from "./direction-stops.ts";
import { foldAccents } from "./fuzzy.ts";

export type Confidence = "high" | "medium" | "low";

export type MatchEvidence = {
  /** What the row is called on the timeline. */
  title: string;
  /** The geocoder's full name for what it found. */
  label?: string | null | undefined;
  /** OSM's class: amenity, shop, tourism, place, boundary… */
  category?: string | null | undefined;
  /** OSM's type: restaurant, cafe, museum, suburb, neighbourhood… */
  kind?: string | null | undefined;
  /**
   * The place's other names — local, English, alternative — when the lookup
   * returned them. 広島駅 is Hiroshima Station; comparing the stop's English
   * name only to the local label called a right answer wrong.
   */
  alsoNamed?: readonly string[] | null | undefined;
};

/**
 * Classes and types that describe an *area* rather than somewhere you go.
 *
 * Landing on one of these when a venue was asked for is the specific failure
 * worth flagging: it is not a miss, so nothing looks broken, and the pin sits
 * plausibly in the right part of the right city while being the wrong place.
 */
const AREA_TYPES = new Set([
  "suburb",
  "neighbourhood",
  "neighborhood",
  "quarter",
  "city_district",
  "district",
  "borough",
  "city",
  "town",
  "village",
  "hamlet",
  "municipality",
  "county",
  "state",
  "region",
  "province",
  "administrative",
]);

/** Words that carry no identity, so matching on them means nothing. */
const NOISE = new Set([
  "the",
  "a",
  "an",
  "de",
  "la",
  "le",
  "les",
  "du",
  "des",
  "and",
  "et",
  "cafe",
  "café",
  "bar",
  "restaurant",
  "hotel",
  "museum",
  "park",
  "station",
  "market",
  "lunch",
  "dinner",
  "breakfast",
  // A shop's own words for itself, shared by every shop.
  "main",
  "store",
  "shop",
  "branch",
  "honten",
  // What the timeline says you do there, not what the place is called.
  "arrive",
  "arrival",
  "depart",
  "departure",
  "visit",
  "explore",
]);

function meaningfulWords(text: string): string[] {
  return foldAccents(text.toLowerCase())
    .split(/[^a-z0-9぀-ヿ一-鿿가-힯]+/)
    .filter((word) => word.length > 1 && !NOISE.has(word));
}

/**
 * Does the geocoder's name contain the distinctive part of what we asked for?
 *
 * Compared on the words that carry identity: "Gourmando" decides a match,
 * "cafe" and "the" decide nothing. For scripts without spaces the fallback is
 * a substring test, since splitting into words is not available there.
 */
export function nameEchoes(title: string, label: string): boolean {
  const asked = meaningfulWords(title);
  const got = foldAccents(label.toLowerCase());
  if (asked.length === 0) {
    const bare = foldAccents(title.toLowerCase().trim());
    return bare.length > 1 && got.includes(bare);
  }
  return asked.some((word) => got.includes(word));
}

/**
 * The name of what the geocoder found, without where it is.
 *
 * A label is the place's name followed by its address: "Kakiya, 539
 * Miyajimacho, Hatsukaichi". Checking the stop's name against the whole of it
 * meant any word of the stop that is also a place — "Miyajima" in "Fujiiya
 * Miyajima Main Store" — matched every result on the island, and a shop was
 * saved at the middle of Miyajimacho. A label that starts with a house number
 * is an address, with no name of its own.
 */
export function hitName(label: string): string {
  const first = label.split(",")[0]?.trim() ?? "";
  return /^\d/.test(first) ? "" : first;
}

/**
 * The words of the stop that could tell this place from its neighbours.
 *
 * A word that appears in the label's address ("miyajima" beside
 * "Miyajimacho, Hatsukaichi") is where the place is, and every place there
 * shares it. When the stop's name is nothing but such words ("Hiroshima
 * Station"), they are all it has, so they are kept.
 */
function identityWords(title: string, label: string): string[] {
  const asked = meaningfulWords(title);
  const where = foldAccents(label.split(",").slice(1).join(",").toLowerCase());
  const own = asked.filter((word) => !where.includes(word));
  return own.length > 0 ? own : asked;
}

/**
 * The tier, and why — the reason is shown, because "Béa is unsure" without a
 * cause is just an apology.
 */
export function scoreMatch(evidence: MatchEvidence): { confidence: Confidence; reason: string } {
  const label = (evidence.label ?? "").trim();
  const kind = (evidence.kind ?? "").trim().toLowerCase();
  const category = (evidence.category ?? "").trim().toLowerCase();

  if (!label) {
    return { confidence: "medium", reason: "Béa found a spot but not a name for it." };
  }

  const areaish = AREA_TYPES.has(kind) || category === "boundary";
  const names = [hitName(label), ...(evidence.alsoNamed ?? [])]
    .map((name) => foldAccents(name.trim().toLowerCase()))
    .filter(Boolean);
  const words = identityWords(evidence.title, label);
  // A street address is matched against the whole label, which is where the
  // street is; a name only against the place's own names.
  const echoes = looksLikeStreetAddress(evidence.title)
    ? nameEchoes(evidence.title, label)
    : words.length === 0
      ? names.some((name) => nameEchoes(evidence.title, name))
      : // A whole area answering for a venue has to be the whole of what was
        // asked: "Miyajimacho" for "Fujiiya Miyajima" is the island, not the shop.
        names.some((name) =>
          areaish ? words.every((w) => name.includes(w)) : words.some((w) => name.includes(w)),
        );

  // A street named after the place ("Rua Rio de Ondas" for the Rio de
  // Ondas bathing spot) echoes the name perfectly and is somewhere else.
  // Only a stop that is itself a street may be answered by one.
  if (category === "highway" && !namesAStreet(evidence.title)) {
    return {
      confidence: "low",
      reason: "This is a street named after it, not the place itself.",
    };
  }
  if (areaish && !echoes) {
    return {
      confidence: "low",
      reason: "This looks like a whole area rather than the place itself.",
    };
  }
  if (!echoes) {
    return { confidence: "low", reason: "The name Béa found does not look like this one." };
  }
  if (areaish) {
    return { confidence: "medium", reason: "Béa matched the area, not a specific address." };
  }
  return { confidence: "high", reason: "" };
}

/** Words that make a name a street, in the languages Béa's trips are in. */
const STREET_WORDS =
  /\b(?:rua|r\.|avenida|av\.?|travessa|estrada|rodovia|alameda|rue|boulevard|bd|calle|avda|carrer|via|viale|corso|strasse|straße|street|st|road|rd|avenue|ave|blvd|lane|ln|drive|dr|way|highway|dori|dōri|tōri|-dori|-dōri)\b/i;

function namesAStreet(title: string): boolean {
  return looksLikeStreetAddress(title) || STREET_WORDS.test(foldAccents(title.toLowerCase()));
}

/** Counts for the line that says how the batch went. */
export function tallyConfidence(list: readonly Confidence[]): {
  high: number;
  medium: number;
  low: number;
  needsLook: number;
} {
  const high = list.filter((c) => c === "high").length;
  const medium = list.filter((c) => c === "medium").length;
  const low = list.filter((c) => c === "low").length;
  return { high, medium, low, needsLook: medium + low };
}

/**
 * Whether a pin found without anyone looking may be saved.
 *
 * Background lookups — filling in a trip's stops, the add-stop form, the
 * directions — used to save whatever came back, so a wrong namesake was
 * saved as confidently as the right place. This holds them to the same bar
 * the import review uses: anything but "low" is saved, "low" is not, and the
 * stop stays unplaced for the person to set, which is honest.
 *
 * A lookup may have been made by the stop's address or venue rather than its
 * title ("Lunch by the water" found at "310 Rue de la Commune"), so the name
 * found is checked against each of them; any one that echoes is enough.
 *
 * The address counts only when it is a street address. "Hatsukaichi, Japan"
 * is a town, and every place in the town has it in its label.
 */
export function autoPinTrusted(
  stop: {
    title: string;
    address?: string | null | undefined;
    place?: string | null | undefined;
  },
  hit: Omit<MatchEvidence, "title"> & { farKm?: number | undefined },
): boolean {
  // Well outside the stop's town: a namesake, however well the name matches.
  if (hit.farKm) return false;
  const street = stop.address && looksLikeStreetAddress(stop.address) ? stop.address : null;
  const names = [stop.title, stop.place, street].filter((name): name is string =>
    Boolean(name && name.trim()),
  );
  return names.some((title) => scoreMatch({ ...hit, title }).confidence !== "low");
}
