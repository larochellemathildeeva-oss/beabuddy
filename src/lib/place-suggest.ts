/**
 * "Did you mean…" for a place search that found nothing.
 *
 * A search for "Miyajma" returns nothing at all: the geocoder matches names,
 * and one wrong letter is a different name. Autocomplete matches the start
 * of a word, though, and the start of a misspelt word is usually right —
 * "Miyaj" finds Miyajima. So the typed name is asked for again, cut short,
 * and only answers that closely resemble what was typed are offered: a
 * suggestion that is merely nearby is a guess, and it would be picked.
 *
 * Pure, so the cutting and the judging are tested on their own.
 */
import { foldAccents, fuzzyScore, levenshtein } from "./fuzzy.ts";

/** At most this many shortened searches per empty result: each one is a request. */
export const SUGGESTION_TRIES = 2;

/** How close a name must be to what was typed to be offered, 0 to 1. */
const CLOSE_ENOUGH = 0.6;

/**
 * Shorter forms of the typed name to search for, best first: the name less
 * its last two letters, then with its last word cut to a stub. Nothing for a
 * name too short to cut, or when cutting leaves under four letters.
 */
export function suggestionPrefixes(name: string): string[] {
  const text = name.replace(/\s+/g, " ").trim();
  if (text.length < 5) return [];
  const out: string[] = [];
  const add = (value: string) => {
    const v = value.trim();
    if (v.replace(/\s/g, "").length >= 4 && v !== text && !out.includes(v)) out.push(v);
  };
  add(text.slice(0, -2));
  const words = text.split(" ");
  const last = words[words.length - 1]!;
  if (last.length >= 5) {
    add([...words.slice(0, -1), last.slice(0, Math.max(3, Math.ceil(last.length / 2)))].join(" "));
  }
  return out.slice(0, SUGGESTION_TRIES);
}

/** How alike two names are, 0 to 1, forgiving accents and case. */
export function nameSimilarity(a: string, b: string): number {
  const x = foldAccents(a);
  const y = foldAccents(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const longest = Math.max(x.length, y.length);
  const edits = 1 - levenshtein(x, y) / longest;
  // Token-wise too, so "peace memoral park" still finds "Hiroshima Peace
  // Memorial Park", whose extra word costs the whole-string measure.
  return Math.max(edits, fuzzyScore(b, a));
}

/**
 * The answers worth offering: close to what was typed, not what was typed
 * (that search already came back empty), one per name, best first.
 */
export function closeSuggestions<T extends { name: string }>(
  found: readonly T[],
  typed: string,
  max = 3,
): T[] {
  const want = foldAccents(typed);
  const scored = found
    .map((place, index) => ({ place, index, score: nameSimilarity(typed, place.name) }))
    .filter((entry) => entry.score >= CLOSE_ENOUGH && foldAccents(entry.place.name) !== want)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const { place } of scored) {
    const key = foldAccents(place.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
    if (out.length >= max) break;
  }
  return out;
}
