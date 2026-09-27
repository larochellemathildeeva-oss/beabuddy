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
  /** Out and back in a day from the city before it; the nights stay there. */
  dayTrip?: boolean | undefined;
};

export const EMPTY_CITY: CityDraft = { city: "", country: "", start: "", end: "" };

/** A day trip to add: a single day, filled in once its city is picked. */
export const EMPTY_DAY_TRIP: CityDraft = { ...EMPTY_CITY, dayTrip: true };

/**
 * The trip stop kind for a day trip: Hiroshima for a day from Kyoto. The
 * place is where the trip is on that day; the nights stay in the base.
 */
export const DAY_TRIP_KIND = "daytrip";

export function isDayTrip(stop: { kind?: string | null | undefined }): boolean {
  return stop.kind === DAY_TRIP_KIND;
}

/**
 * Where a day trip sleeps: the nearest city before it that is not a day trip
 * itself. Null for a day trip listed first, which has no base to go back to.
 */
export function dayTripBase<T extends { kind?: string | null | undefined }>(
  stops: readonly T[],
  index: number,
): T | null {
  for (let i = index - 1; i >= 0; i--) {
    if (!isDayTrip(stops[i]!)) return stops[i]!;
  }
  return null;
}

/** "Kyoto" out of "Kyoto, Kyoto Prefecture, Japan". */
export function shortCity(city: string): string {
  return (city.split(",")[0] ?? "").trim();
}

/**
 * One stop of the route as a line for a planning prompt: "Hiroshima, Japan
 * (2026-10-04) — day trip from Kyoto; nights stay in Kyoto". Without the
 * note a model reads a one-day stop as moving there, and books a hotel.
 */
export function routeStopLine<
  T extends {
    city: string;
    country?: string | null | undefined;
    kind?: string | null | undefined;
    arrive_on?: string | null | undefined;
    depart_on?: string | null | undefined;
  },
>(stops: readonly T[], index: number): string {
  const stop = stops[index]!;
  const dates = [...new Set([stop.arrive_on, stop.depart_on].filter(Boolean))].join(" – ");
  const line = `${[stop.city, stop.country].filter(Boolean).join(", ")}${dates ? ` (${dates})` : ""}`;
  if (!isDayTrip(stop)) return line;
  const base = dayTripBase(stops, index);
  return base
    ? `${line} — day trip from ${shortCity(base.city)}; nights stay in ${shortCity(base.city)}`
    : `${line} — day trip`;
}

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
      ...(c.dayTrip ? { kind: DAY_TRIP_KIND } : {}),
      city: c.city.trim(),
      country: c.country,
      ...(c.lat !== undefined && c.lon !== undefined ? { lat: c.lat, lon: c.lon } : {}),
      arrive_on: c.start,
      // A day trip is one day, whatever the calendar was left holding.
      depart_on: c.dayTrip ? c.start : c.end || c.start,
    }));
}

/**
 * The stops for a trip to one place with day trips out of it: the place for
 * the whole trip, then each day trip. No day trips, no stops — a trip to one
 * place is its city and dates, as it always was.
 */
export function onePlaceStops(
  place: { city: string; country: string; start: string; end: string },
  dayTrips: CityDraft[],
) {
  const trips = citiesToStops(dayTrips.map((d) => ({ ...d, dayTrip: true })));
  if (!trips.length || !place.city.trim()) return [];
  return [...citiesToStops([{ ...place }]), ...trips];
}

/**
 * Where a new day trip goes in the list: after its base and any day trips
 * already hanging off it, so the base is always the city above.
 */
export function dayTripInsertAt(cities: CityDraft[], base: number): number {
  let at = base + 1;
  while (cities[at]?.dayTrip) at++;
  return at;
}

/** A day trip's date outside its base's stay, when both are known. */
export function dayTripOutsideBase(cities: CityDraft[], index: number): boolean {
  const trip = cities[index];
  if (!trip?.dayTrip || !trip.start) return false;
  const base = dayTripBase(
    cities.map((c) => ({ kind: c.dayTrip ? DAY_TRIP_KIND : "destination", ...c })),
    index,
  );
  if (!base?.start) return false;
  return cityOutsideTrip({ ...trip, end: trip.start }, base.start, base.end || base.start);
}
