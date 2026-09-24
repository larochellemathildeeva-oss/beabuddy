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
  const echoes = nameEchoes(evidence.title, label);

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
 */
export function autoPinTrusted(
  stop: {
    title: string;
    address?: string | null | undefined;
    place?: string | null | undefined;
  },
  hit: Omit<MatchEvidence, "title">,
): boolean {
  const names = [stop.title, stop.place, stop.address].filter((name): name is string =>
    Boolean(name && name.trim()),
  );
  return names.some((title) => scoreMatch({ ...hit, title }).confidence !== "low");
}
