/**
 * Which list a saved place is in, and whether it is a location or a rec.
 *
 * Wishlist and Next time were two names for wanting to go back, so they are
 * one Bucket list on every screen; both stored values stay, so nothing is
 * rewritten. Locations (a city, a country) live on World; everything else
 * (businesses, landmarks, attractions, neighbourhoods) lives in Recs, and a
 * location shows the recs saved for it.
 */
import type { PinType } from "../data/atlas.ts";
import { countryDisplayName, countryKey } from "./country-names.ts";
import { foldAccents } from "./fuzzy.ts";
import { isCountryLevelPlace, isLocation, type RecoPlaceFields } from "./reco-place.ts";

export { isLocation };

export type ShownList = "recommendation" | "bucket" | "been";

/** What a person can choose when saving. Next time is gone: it is the Bucket list. */
export const SAVE_LISTS: readonly PinType[] = ["reco", "wishlist", "visited"];

export function listOf(row: { pin_type: string | null; visited?: boolean | null }): ShownList {
  if (row.visited || row.pin_type === "visited") return "been";
  if (row.pin_type === "wishlist" || row.pin_type === "nexttime") return "bucket";
  return "recommendation";
}

type Where = { city: string | null | undefined; country: string | null | undefined };

const cityKey = (city: string | null | undefined) =>
  foldAccents((city ?? "").split(",")[0] ?? "")
    .toLowerCase()
    .trim();

const sameCountry = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a?.trim() && b?.trim()) && countryKey(a) === countryKey(b);

/**
 * The recs saved for a location. A city matches recs in that city (any
 * spelling, the same country); a country matches recs in it whose city is
 * not a saved location of its own, so a rec is counted under one place.
 */
export function recsForLocation<T extends RecoPlaceFields>(
  location: Where,
  rows: readonly T[],
  locations: readonly Where[],
): T[] {
  const city = cityKey(location.city);
  if (city) {
    return rows.filter((row) => {
      if (cityKey(row.city) !== city) return false;
      // A city saved with no country matches on the city alone; one with a
      // country never claims a rec without one (it could be a namesake).
      if (!location.country?.trim()) return true;
      return sameCountry(row.country, location.country);
    });
  }
  if (!location.country?.trim()) return [];
  const savedCities = new Set(
    locations
      .filter((l) => cityKey(l.city) && sameCountry(l.country, location.country))
      .map((l) => cityKey(l.city)),
  );
  return rows.filter(
    (row) => sameCountry(row.country, location.country) && !savedCities.has(cityKey(row.city)),
  );
}

export type LocationGroup<T> = {
  key: string;
  name: string;
  /** Null for a country. */
  city: string | null;
  country: string | null;
  rows: T[];
};

/**
 * World's Bucket list: every location not yet been to (Bucket list, or saved
 * as a plain recommendation, which no other screen shows), one entry per
 * place however many times or spellings it was saved.
 */
export function bucketLocationGroups<
  T extends RecoPlaceFields & { pin_type: string | null; visited?: boolean | null },
>(rows: readonly T[]): LocationGroup<T>[] {
  const groups = new Map<string, LocationGroup<T>>();
  for (const row of rows) {
    if (listOf(row) === "been" || !isLocation(row)) continue;
    const isCountry = isCountryLevelPlace(row);
    const country = row.country?.trim() || (isCountry ? row.name : null);
    const city = isCountry ? null : row.city?.split(",")[0]?.trim() || row.name.trim();
    const key = isCountry
      ? `c:${countryKey(country)}`
      : `t:${cityKey(city)}|${countryKey(country)}`;
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
      continue;
    }
    const name = isCountry ? countryDisplayName(row.name) || row.name : (city ?? row.name);
    groups.set(key, { key, name, city, country, rows: [row] });
  }
  return [...groups.values()];
}
