import { foldAccents } from "./fuzzy.ts";

/**
 * Whether a hit list looks like an unanchored chain search.
 *
 * "subway" without a location returns shops in Mexico, New Zealand, Finland…
 * The person meant the one they can walk to. Two or more countries in the
 * answer is the tell — a real unique place almost never fans out like that.
 */
export function hitsSpanCountries(
  hits: readonly { country?: string | null }[],
  minCountries = 2,
): boolean {
  const countries = new Set<string>();
  for (const hit of hits) {
    const country = foldAccents(hit.country ?? "");
    if (country) countries.add(country);
  }
  return countries.size >= minCountries;
}

type AreaHitLike = {
  name?: string | undefined;
  class?: string | undefined;
  category?: string | undefined;
  type?: string | undefined;
};

const AREA_CLASSES = new Set(["boundary", "place"]);

/** The words of a name, folded, for telling whether a hit is about it. */
function nameWords(text: string): string[] {
  return foldAccents(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
}

/**
 * Drop answers that are only the trip's area, not the place asked for.
 *
 * A venue search is sent with the trip's city on the end ("Motoyasubashi
 * Pier, Kyoto, Japan"). When the venue is not in that city — a day trip to
 * Hiroshima on a Kyoto trip — search-as-you-type answers with the city and
 * its look-alikes (Kyoto, Kyotamba, Kyoto Prefecture), which reads as though
 * Béa thinks the pier is Kyoto. A town or region that shares no word with
 * the typed name is that noise; one that does ("Gion") is kept.
 */
export function dropBareAreas<H extends AreaHitLike>(hits: readonly H[], name: string): H[] {
  const wanted = nameWords(name);
  if (!wanted.length) return [...hits];
  return hits.filter((hit) => {
    const kind = hit.class ?? hit.category ?? "";
    if (!AREA_CLASSES.has(kind)) return true;
    const got = new Set(nameWords(hit.name ?? ""));
    return wanted.some((w) => got.has(w));
  });
}

/**
 * Where to look next when the name is not in the trip's city: its country,
 * then anywhere. "Kyoto, Kyoto Prefecture, Japan" gives ["X, Japan", "X"].
 */
export function widerQueries(name: string, near: string): string[] {
  const parts = near
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const country = parts.length > 1 ? parts[parts.length - 1] : "";
  return country ? [`${name}, ${country}`, name] : [name];
}
