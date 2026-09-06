/** Lowercase, strip accents and punctuation so "café" matches "cafe". */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i;
    row[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const next = a[i] === b[j] ? prev : Math.min(prev, row[j] ?? 0, row[j + 1] ?? 0) + 1;
      prev = row[j + 1] ?? 0;
      row[j + 1] = next;
    }
  }
  return row[b.length] ?? b.length;
}

function isSubsequence(query: string, text: string): boolean {
  let i = 0;
  for (const ch of text) {
    if (ch === query[i]) i += 1;
    if (i === query.length) return true;
  }
  return false;
}

/** 0 = no match. Higher is closer. */
export function fuzzyScore(query: string, text: string): number {
  const q = fold(query);
  const t = fold(text);
  if (!q) return 1;
  if (!t) return 0;
  if (t === q) return 1;
  if (t.includes(q)) return 0.95;
  if (t.split(" ").some((word) => word.startsWith(q))) return 0.9;

  let bestEdit = Infinity;
  for (const word of t.split(" ")) {
    if (!word) continue;
    bestEdit = Math.min(bestEdit, levenshtein(q, word));
    if (q.length >= 4 && word.length >= 4) {
      bestEdit = Math.min(bestEdit, levenshtein(q, word.slice(0, q.length)));
    }
  }
  if (bestEdit <= 1 && q.length >= 3) return 0.82;
  if (bestEdit <= 2 && q.length >= 5) return 0.62;
  if (isSubsequence(q, t) && q.length >= 3) return 0.48;
  return 0;
}

export function bestFuzzyScore(query: string, texts: Array<string | null | undefined>): number {
  let best = 0;
  for (const text of texts) {
    if (!text) continue;
    best = Math.max(best, fuzzyScore(query, text));
  }
  return best;
}

export function fuzzyRank<T>(
  items: T[],
  query: string,
  texts: (item: T) => Array<string | null | undefined>,
  minScore = 0.45,
): T[] {
  const q = query.trim();
  if (!q) return items;
  return items
    .map((item) => ({ item, score: bestFuzzyScore(q, texts(item)) }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}

/** Extra Nominatim queries when the typed name is likely a typo. */
export function fuzzyQueryVariants(query: string): string[] {
  const q = fold(query);
  if (q.length < 3) return [q];
  const out = [q];
  const squeezed = q.replace(/(.)\1+/g, "$1");
  if (squeezed !== q && squeezed.length >= 2) out.push(squeezed);
  if (q.length >= 5) out.push(q.slice(0, -1));
  return [...new Set(out)];
}
