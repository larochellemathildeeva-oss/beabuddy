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
