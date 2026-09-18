import { foldAccents, levenshtein } from "./fuzzy.ts";

/**
 * Whether a single web-search hit may be presented as *the* place.
 *
 * A pasted link that carries no coordinates used to be resolved by searching
 * the name and taking the first global result. "Harvey's" is a Canadian burger
 * chain; the top worldwide hit is a Harvey's in Slovakia, and it was saved as
 * that — with a city, a country and coordinates, indistinguishable from a
 * place Béa actually knew.
 *
 * Silently inventing a location is worse than having none: an empty city is
 * obviously empty, whereas "Slovakia" looks like an answer. The rule is
 * therefore that a bare name is never enough. Something in the query has to
 * pin it to somewhere on Earth, and whatever comes back has to look like what
 * was asked for.
 */

/** Words that tell a geocoder where to look, rather than what to look for. */
const HAS_STREET_NUMBER = /\d/;

/**
 * Does the query say *where*, not just *what*?
 *
 * A street address does. A city or country does. A name on its own does not,
 * however distinctive it feels — distinctiveness is not something we can judge
 * from here, and chains are exactly the case that breaks it.
 */
export function queryIsLocatable(parts: {
  name?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
}): boolean {
  if (parts.city?.trim() || parts.country?.trim()) return true;
  const address = parts.address?.trim() ?? "";
  if (!address) return false;
  // "505 College St, Toronto" locates. A bare "Restaurant" does not.
  return HAS_STREET_NUMBER.test(address) || address.includes(",");
}

/**
 * Does the hit look like the thing that was searched for?
 *
 * Nominatim answers with its best effort, not with nothing, so a query it
 * cannot satisfy still returns something. Comparing names is what separates
 * "found it" from "found a thing".
 */
export function hitMatchesName(query: string, hitName: string): boolean {
  const q = normalise(query);
  const h = normalise(hitName);
  if (!q || !h) return false;
  if (q === h) return true;
  if (h.includes(q) || q.includes(h)) return true;
  // One or two characters of drift — accents, an apostrophe, a plural.
  const budget = q.length <= 6 ? 1 : 2;
  return levenshtein(q, h, budget + 1) <= budget;
}

/**
 * The whole decision: may this hit be returned as the place?
 *
 * Returns false when there is nothing locating in the query, or when the
 * result does not resemble the name. The caller should then keep the name and
 * the link and leave the map empty, which every add form already supports.
 */
export function geocodeIsTrustworthy(input: {
  name?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  hitName?: string | undefined;
}): boolean {
  if (!queryIsLocatable(input)) return false;
  const name = input.name?.trim();
  // Nothing to compare against: the query was an address alone, which is
  // already specific enough to trust on its own.
  if (!name) return true;
  if (!input.hitName?.trim()) return false;
  return hitMatchesName(name, input.hitName);
}

function normalise(value: string): string {
  return foldAccents(value)
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
