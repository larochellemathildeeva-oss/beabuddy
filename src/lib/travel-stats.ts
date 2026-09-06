import type { Pin } from "../data/atlas.ts";

/**
 * Travel counts came only from photo_memories, so a city added by hand on the
 * World map — which is written to `recommendations` with pin_type "visited" —
 * never moved the numbers. Somewhere you have been is somewhere you have been,
 * whether you happened to upload a photo of it.
 */

export type PhotoRowForStats = {
  city: string | null;
  country: string | null;
  taken_at: string | null;
};

export type TravelStats = {
  countries: number;
  cities: number;
  photos: number;
  days: number;
};

/** UN members plus the two observer states — the usual “how many countries” figure. */
export const WORLD_COUNTRY_COUNT = 195;

export function countryWorldShare(visited: number, world = WORLD_COUNTRY_COUNT) {
  const safe = Math.max(0, Math.floor(visited));
  const total = Math.max(1, world);
  const percent = Math.min(100, Math.round((safe / total) * 100));
  return { visited: safe, world: total, percent };
}

/** Case- and whitespace-insensitive, so "Paris" and "paris " are one city. */
function key(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function countsAsVisited(pin: Pin): boolean {
  return pin.type === "visited" || pin.visited === true;
}

/**
 * Counts distinct places across both sources. A city photographed *and* pinned
 * counts once — the two tables overlap by design, since a photo import and a
 * manual pin can describe the same trip.
 *
 * `photos` and `days` stay photo-only: a pin carries no image and no date you
 * can call a day of travel.
 */
export function deriveTravelStats(
  photoRows: readonly PhotoRowForStats[],
  pins: readonly Pin[] = [],
): TravelStats {
  const cities = new Set<string>();
  const countries = new Set<string>();
  const days = new Set<string>();

  for (const row of photoRows) {
    const city = key(row.city);
    const country = key(row.country);
    if (city) cities.add(`${city}|${country ?? ""}`);
    if (country) countries.add(country);
    const day = row.taken_at ? row.taken_at.slice(0, 10) : null;
    if (day) days.add(day);
  }

  for (const pin of pins) {
    if (!countsAsVisited(pin)) continue;
    const city = key(pin.city);
    const country = key(pin.country);
    if (city) cities.add(`${city}|${country ?? ""}`);
    if (country) countries.add(country);
  }

  return {
    countries: countries.size,
    cities: cities.size,
    photos: photoRows.length,
    days: days.size,
  };
}
