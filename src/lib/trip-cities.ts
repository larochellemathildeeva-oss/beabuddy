/**
 * The pure parts of picking dates and cities for a new trip.
 *
 * A trip to one place is a city and a date range. A trip to several is a list
 * of cities, each with its own dates inside the trip's, saved as the trip's
 * stops — the same list as Settings → Cities on this trip.
 */

import { routeStopOn } from "./import-stop.ts";
import type { TimelineDayGroup } from "./timeline-groups.ts";

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

/** A trip stop as far as these helpers care. */
export type TripCity = {
  id?: string;
  kind?: string;
  city: string;
  country?: string | null;
  arrive_on?: string | null;
  depart_on?: string | null;
};

/** "São Paulo" and "sao paulo" are the same city. */
function cityKey(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * The trip's own city, when the cities list does not have it.
 *
 * A one-city trip keeps its city on the trip itself and has no stops. Adding
 * a second city then made a list of one — the new city — and the place the
 * trip was made for vanished from "Cities on this trip". Null when the trip
 * has no city, or the list already names it.
 */
export function missingTripCity(
  trip: {
    city?: string | null;
    country?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  },
  stops: readonly TripCity[],
  /** The city about to be added, when there is one: the first city ends as it arrives. */
  next?: { arrive_on?: string | null | undefined },
): { city: string; country: string; arrive_on: string; depart_on: string } | null {
  const city = trip.city?.trim();
  if (!city) return null;
  if (stops.some((stop) => cityKey(stop.city) === cityKey(city))) return null;
  // A country-only trip ("Brazil") is not a city to add.
  if (trip.country && cityKey(city) === cityKey(trip.country)) return null;
  const arrive = trip.start_date ?? "";
  const leaveBy =
    next?.arrive_on ||
    stops
      .map((s) => s.arrive_on ?? "")
      .filter(Boolean)
      .sort()[0];
  const depart = leaveBy && (!arrive || leaveBy >= arrive) ? leaveBy : (trip.end_date ?? arrive);
  return { city, country: trip.country ?? "", arrive_on: arrive, depart_on: depart ?? "" };
}

/** The cities on a trip you can move between: destinations, not stopovers. */
export function destinationCities<T extends TripCity>(stops: readonly T[]): T[] {
  return stops.filter((stop) => stop.kind !== "layover" && stop.city.trim());
}

/**
 * The days spent in one city, out of the timeline's day groups.
 *
 * A day belongs to the city the trip is in on that date, by the same rule
 * placing uses (`routeStopOn`). Undated rows belong to no city.
 */
export function groupsInCity<T extends { day_date: string | null }, C extends TripCity>(
  groups: readonly TimelineDayGroup<T>[],
  cities: readonly C[],
  city: C,
): TimelineDayGroup<T>[] {
  return groups.filter((group) => group.key !== "" && routeStopOn(cities, group.key) === city);
}

/**
 * What an imported plan is told about where and when, scoped to one city.
 *
 * "Whole trip" (no city) keeps the trip's own. A city brings its own name and
 * dates, falling back to the trip's where it has none, so a Rio plan is read
 * in Rio and lands on Rio's days rather than on the trip's first city.
 */
export function planScope(
  trip: { city?: string | undefined; startDate?: string | undefined; endDate?: string | undefined },
  city: TripCity | null,
): { city?: string; startDate?: string; endDate?: string } {
  if (!city) {
    return {
      ...(trip.city ? { city: trip.city } : {}),
      ...(trip.startDate ? { startDate: trip.startDate } : {}),
      ...(trip.endDate ? { endDate: trip.endDate } : {}),
    };
  }
  const start = city.arrive_on || trip.startDate;
  const end = city.depart_on || (city.arrive_on ? city.arrive_on : trip.endDate);
  return {
    city: [city.city.trim(), city.country?.trim()].filter(Boolean).join(", "),
    ...(start ? { startDate: start } : {}),
    ...(end ? { endDate: end } : {}),
  };
}
