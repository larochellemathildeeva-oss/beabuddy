/**
 * What Home says while a trip is under way and while there is none: today's
 * current and next stop, and the places saved in each city waiting for a trip.
 * Pure, so each rule is tested on its own.
 */

import { companionState, companionStops, type CompanionStop } from "./companion.ts";
import { clockMinutes } from "./timeline-kind.ts";

type TodayItem = CompanionStop & { day_date: string | null };

/**
 * Today's places in plan order and where the traveller is among them, read
 * from the taps ("I'm here", "Leaving"), never from the clock.
 */
export function todaysCompanion<T extends TodayItem>(items: readonly T[], today: string) {
  const stops = companionStops(items.filter((item) => item.day_date === today));
  return { stops, ...companionState(stops) };
}

/**
 * "In 2 h 20 min", for a stop with a clock time still ahead today. Empty when
 * the stop has no time, or its time has gone: Home never says "late".
 */
export function untilLabel(timeLabel: string | null | undefined, now: Date): string {
  const at = clockMinutes(timeLabel);
  if (at === null) return "";
  const gap = at - (now.getHours() * 60 + now.getMinutes());
  if (gap <= 0) return "";
  if (gap < 60) return `In ${gap} min`;
  const hours = Math.floor(gap / 60);
  const minutes = gap % 60;
  return minutes ? `In ${hours} h ${minutes} min` : `In ${hours} h`;
}

type SavedPlace = {
  city: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  visited?: boolean | null;
};

export type SavedCity = {
  city: string;
  country: string | null;
  count: number;
  /** Where the city is, from its saved places that have a pin. */
  lat: number | null;
  lon: number | null;
};

const cityName = (raw: string) => (raw.split(",")[0] ?? "").trim();

/**
 * The cities the traveller has saved places in and not yet been to, most
 * places first. A city is one row however it is spelled in the city field
 * ("Lisbon" and "Lisbon, Portugal"); its position is the middle of its pins.
 */
export function savedCities(places: readonly SavedPlace[]): SavedCity[] {
  const byCity = new Map<
    string,
    { city: string; country: string | null; count: number; lats: number[]; lons: number[] }
  >();
  for (const place of places) {
    if (place.visited) continue;
    const city = cityName(place.city ?? "");
    if (!city) continue;
    const key = `${city.toLowerCase()}|${(place.country ?? "").trim().toLowerCase()}`;
    const row = byCity.get(key) ?? {
      city,
      country: place.country?.trim() || null,
      count: 0,
      lats: [],
      lons: [],
    };
    row.count += 1;
    if (
      place.lat !== null &&
      place.lon !== null &&
      Number.isFinite(place.lat) &&
      Number.isFinite(place.lon)
    ) {
      row.lats.push(place.lat);
      row.lons.push(place.lon);
    }
    byCity.set(key, row);
  }
  const mean = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return [...byCity.values()]
    .map((row) => ({
      city: row.city,
      country: row.country,
      count: row.count,
      lat: mean(row.lats),
      lon: mean(row.lons),
    }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}

/** "16 saved places in 3 cities are waiting for a trip." */
export function savedSummary(cities: readonly SavedCity[]): { strong: string; rest: string } {
  const places = cities.reduce((sum, c) => sum + c.count, 0);
  const strong = `${places} saved ${places === 1 ? "place" : "places"}`;
  const rest =
    cities.length > 1
      ? ` in ${cities.length} cities ${places === 1 ? "is" : "are"} waiting for a trip.`
      : ` in ${cities[0]?.city ?? "one city"} ${places === 1 ? "is" : "are"} waiting for a trip.`;
  return { strong, rest };
}
