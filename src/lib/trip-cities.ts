/**
 * The pure parts of picking dates and cities for a new trip.
 *
 * A trip to one place is a city and a date range. A trip to several is a list
 * of cities, each with its own dates inside the trip's, saved as the trip's
 * stops — the same list as Settings → Cities on this trip.
 */

export type CityDraft = {
  city: string;
  country: string;
  lat?: number | undefined;
  lon?: number | undefined;
  start: string;
  end: string;
};

export const EMPTY_CITY: CityDraft = { city: "", country: "", start: "", end: "" };

/**
 * One tap on a range calendar. The first tap starts a range and leaves the
 * calendar open; the second finishes it, in whichever order the two days
 * were tapped. `pending` is the start of a range still waiting for its end.
 */
export function rangeTap(
  pending: string | null,
  day: string,
): { start: string; end: string; done: boolean } {
  if (!pending) return { start: day, end: "", done: false };
  return day < pending
    ? { start: day, end: pending, done: true }
    : { start: pending, end: day, done: true };
}

/** The whole trip's dates, from the first city's arrival to the last departure. */
export function tripDatesFromCities(cities: CityDraft[]): { start: string; end: string } {
  const starts = cities
    .map((c) => c.start)
    .filter(Boolean)
    .sort();
  const ends = cities
    .map((c) => c.end || c.start)
    .filter(Boolean)
    .sort();
  return { start: starts[0] ?? "", end: ends[ends.length - 1] ?? "" };
}

/** A city's dates that fall outside the trip's own, when both are known. */
export function cityOutsideTrip(city: CityDraft, tripStart: string, tripEnd: string): boolean {
  if (!city.start) return false;
  const end = city.end || city.start;
  return Boolean((tripStart && city.start < tripStart) || (tripEnd && end > tripEnd));
}

/** The cities worth saving, in order, as trip stops. Unnamed rows are dropped. */
export function citiesToStops(cities: CityDraft[]) {
  return cities
    .filter((c) => c.city.trim())
    .map((c) => ({
      city: c.city.trim(),
      country: c.country,
      ...(c.lat !== undefined && c.lon !== undefined ? { lat: c.lat, lon: c.lon } : {}),
      arrive_on: c.start,
      depart_on: c.end || c.start,
    }));
}
