/**
 * Forgiving text search for the vault.
 *
 * Travel names are exactly the case where exact matching fails: they carry
 * accents the traveller will not type ("Café" searched as "cafe"), and they get
 * remembered approximately ("Guggenheim" as "gugenheim"). So we fold accents
 * before comparing and allow a small edit distance per token.
 *
 * Deliberately local and dependency-free — this runs on every keystroke.
 */

/** "Café Cõrrer" -> "cafe correr". Strips diacritics, lowercases, collapses space. */
export function foldAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein distance, bounded: once every cell in a row exceeds `max` the
 * strings cannot come back under it, so we stop early. Keeps long note fields
 * from costing anything on a query that was never going to match.
 */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

/** How many edits we forgive on a token of this length. Short words get less rope. */
function tolerance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

/**
 * Score one field against one query, 0 (no match) to 1 (exact).
 * Both sides are folded first, so callers pass raw text.
 */
export function fuzzyScore(field: string, query: string): number {
  const haystack = foldAccents(field);
  const needle = foldAccents(query);
  if (!haystack || !needle) return 0;

  if (haystack === needle) return 1;
  if (haystack.startsWith(needle)) return 0.92;
  if (haystack.includes(needle)) return 0.84;

  // Every query token must find a home somewhere in the field, exactly or
  // within tolerance. The weakest token sets the score, so "cafe xyzzy" does
  // not match on "cafe" alone.
  const tokens = needle.split(" ").filter(Boolean);
  const words = haystack.split(" ").filter(Boolean);
  if (!tokens.length || !words.length) return 0;

  let weakest = 1;
  for (const token of tokens) {
    let best = 0;
    for (const word of words) {
      if (word === token) {
        best = 1;
        break;
      }
      if (word.startsWith(token)) {
        best = Math.max(best, 0.8);
        continue;
      }
      const allowed = tolerance(token.length);
      if (allowed === 0) continue;
      const distance = levenshtein(token, word, allowed);
      if (distance <= allowed) {
        best = Math.max(best, 0.7 - distance * 0.1);
      }
    }
    if (best === 0) return 0;
    weakest = Math.min(weakest, best);
  }
  return weakest * 0.75;
}

const MATCH_FLOOR = 0.3;

/**
 * Filter and order `items` by how well any of their `fields` match `query`.
 * Non-matches are dropped. Ties keep their original order, so an unhelpful
 * query never shuffles the list arbitrarily.
 */
export function fuzzyRank<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => (string | null | undefined)[],
  minScore = MATCH_FLOOR,
): T[] {
  const needle = query.trim();
  if (!needle) return [...items];

  return items
    .map((item, index) => {
      let score = 0;
      for (const field of fields(item)) {
        if (!field) continue;
        score = Math.max(score, fuzzyScore(field, needle));
        if (score === 1) break;
      }
      return { item, score, index };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

/** Extra Nominatim queries when the typed name is likely a typo. */
export function fuzzyQueryVariants(query: string): string[] {
  const q = foldAccents(query);
  if (q.length < 3) return [q];
  const out = [q];
  const squeezed = q.replace(/(.)\1+/g, "$1");
  if (squeezed !== q && squeezed.length >= 2) out.push(squeezed);
  if (q.length >= 5) out.push(q.slice(0, -1));
  return [...new Set(out)];
}
