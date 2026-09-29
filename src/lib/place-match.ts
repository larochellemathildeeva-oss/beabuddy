/**
 * Is a search result the place that was asked for, or only somewhere in the
 * same area?
 *
 * "Caffé Shinsaibashi" found the "Shinsaibashi Mocha Cat Cafe": it shares
 * the neighbourhood's name and "cafe", and nothing that is the café's own.
 * Such a result is still offered — it may be what was meant — but after the
 * real matches, and marked, so it is not taken for the place itself. Pure,
 * so it is tested.
 */
import { distanceKm } from "./geocode-plan.ts";
import { canonicalSpelling, levenshtein } from "./fuzzy.ts";
import { isNoiseWord } from "./match-confidence.ts";

export type MatchPlace = {
  name: string;
  address?: string | null | undefined;
  city?: string | null | undefined;
  country?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

/** The words that could name a place: accents folded, "the" and "cafe" dropped. */
function nameWords(text: string): string[] {
  return canonicalSpelling(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1 && !isNoiseWord(word));
}

const compact = (text: string) => canonicalSpelling(text).replace(/[^\p{L}\p{N}]+/gu, "");

/** One typo forgiven in a longer word, two in a long one. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const allowed = Math.min(a.length, b.length) >= 8 ? 2 : Math.min(a.length, b.length) >= 5 ? 1 : 0;
  return allowed > 0 && levenshtein(a, b, allowed) <= allowed;
}

/**
 * Scripts written without spaces: "心斎橋" is found inside "心斎橋店" at any
 * length. Latin words only from four letters, so "an" is not in "Namba".
 */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;

/** Is `word` in this text: as a word, or inside a longer one ("sushido" in "sushidokoro")? */
function foundIn(word: string, words: readonly string[], joined: string): boolean {
  if (words.some((w) => sameWord(w, word))) return true;
  return (word.length >= 4 || UNSPACED.test(word)) && joined.includes(word);
}

/**
 * True when the place shares no more than the area's words with what was
 * asked: its district, town or street, and words like "cafe".
 *
 * The words of the ask that also appear in where the place is ("Shinsaibashi"
 * beside "Higashi-Shinsaibashi 1-chome") are the area's, not a name. The rest
 * must all be in the place's name. When the ask is nothing but area words
 * ("Hiroshima Station"), a place called just that matches, and one with a
 * name of its own besides ("GRAM Shinsaibashi") does not.
 */
export function onlyAreaMatches(
  asked: string,
  place: MatchPlace,
  near?: string | null,
  /** The place's full label, when the result's own address is only its town. */
  where?: string | null,
): boolean {
  const ask = nameWords(asked);
  // "cafe", "museum": a kind of place, which every result of that kind is.
  if (ask.length === 0) return false;
  const name = place.name.trim();
  // The place's name leads its label ("EXCELSIOR CAFE, Shinsaibashisuji…"):
  // it is the name, not where the place is.
  const withoutName = (text: string | null | undefined) => {
    const t = (text ?? "").trim();
    return t.toLowerCase().startsWith(name.toLowerCase()) ? t.slice(name.length) : t;
  };
  const areaText = [withoutName(place.address), withoutName(where), place.city, place.country, near]
    .filter(Boolean)
    .join(" ");
  const areaWords = nameWords(areaText);
  const areaJoined = compact(areaText);
  const isArea = (word: string) => foundIn(word, areaWords, areaJoined);

  const got = nameWords(name);
  const gotJoined = compact(name);
  const own = ask.filter((word) => !isArea(word));
  if (own.length > 0) return !own.every((word) => foundIn(word, got, gotJoined));
  // Nothing but area words asked: the place must be called that, with no
  // name of its own besides.
  if (!ask.some((word) => foundIn(word, got, gotJoined))) return true;
  return got.some((word) => !isArea(word) && !ask.some((a) => sameWord(a, word)));
}

/**
 * Asked in one script, answered only in another ("エクセルシオール カフェ"
 * answered "EXCELSIOR CAFE"): there is nothing to compare, so no verdict.
 */
export function scriptsDiffer(asked: string, names: readonly string[]): boolean {
  if (/\p{Script=Latin}/u.test(asked)) return false;
  const scripts = [...asked.matchAll(/\p{L}/gu)]
    .map((m) => scriptOf(m[0]))
    .filter((script) => script !== "other");
  if (!scripts.length) return false;
  return !names.some((name) => [...name].some((ch) => scripts.includes(scriptOf(ch))));
}

const SCRIPTS = [
  "Han",
  "Hiragana",
  "Katakana",
  "Hangul",
  "Thai",
  "Cyrillic",
  "Greek",
  "Arabic",
  "Hebrew",
];
function scriptOf(ch: string): string {
  return SCRIPTS.find((script) => new RegExp(`\\p{Script=${script}}`, "u").test(ch)) ?? "other";
}

/** Near enough to the stop's pin to be the same place, or its next-door twin. */
export const STOP_PIN_NEAR_KM = 0.5;

/**
 * Real matches first, then the ones that share only the area, marked `weak`.
 * With the stop's pin (changing a stop's place), the matches beside it lead
 * within each group. Otherwise the order is kept.
 */
export function rankByName<T extends MatchPlace>(
  places: readonly T[],
  asked: string,
  opts: {
    near?: string | null | undefined;
    pin?: { lat: number; lon: number } | null;
    /** Each place's full label, when its own address is only its town. */
    whereOf?: (place: T) => string | null | undefined;
    /** The place's other names (its name in the local script, in English…). */
    namesOf?: (place: T) => readonly string[] | undefined;
  } = {},
): (T & { weak?: true })[] {
  const pin = opts.pin;
  const nearPin = (place: T) =>
    pin && place.lat != null && place.lon != null
      ? distanceKm({ lat: place.lat, lon: place.lon }, pin) <= STOP_PIN_NEAR_KM
      : false;
  return places
    .map((place, index) => ({
      place,
      index,
      weak: judged(place, asked, opts.namesOf?.(place) ?? [], (name) =>
        onlyAreaMatches(asked, { ...place, name }, opts.near, opts.whereOf?.(place)),
      ),
      beside: nearPin(place),
    }))
    .sort(
      (a, b) =>
        Number(a.weak) - Number(b.weak) || Number(b.beside) - Number(a.beside) || a.index - b.index,
    )
    .map(({ place, weak }) => (weak ? { ...place, weak: true as const } : place));
}

/** Weak under every name it has, unless the ask cannot be compared with them. */
function judged(
  place: MatchPlace,
  asked: string,
  others: readonly string[],
  weakAs: (name: string) => boolean,
): boolean {
  const names = [place.name, ...others];
  if (scriptsDiffer(asked, names)) return false;
  return names.every(weakAs);
}

/**
 * The stop's own name is worth searching for as well: the text typed is
 * shorter than it ("Caffé Shinsaibashi" for "Excelsior Caffé Shinsaibashi"),
 * or different. Not when it adds nothing, or names only a kind of place.
 */
export function stopTitleAddsToQuery(query: string, title: string | null | undefined): boolean {
  const t = (title ?? "").trim();
  if (!t) return false;
  if (compact(t) === compact(query)) return false;
  return nameWords(t).length > 0;
}
