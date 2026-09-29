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
 * The same place: same city, and same country when both say. Paris, Texas
 * is not Paris, France; a stop with no country is given the benefit of it.
 */
function samePlace(
  a: { city?: string | null | undefined; country?: string | null | undefined },
  b: { city?: string | null | undefined; country?: string | null | undefined },
): boolean {
  if (cityKey(a.city) !== cityKey(b.city)) return false;
  const [ca, cb] = [cityKey(a.country), cityKey(b.country)];
  return !ca || !cb || ca === cb;
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
  next?: { kind?: string | null | undefined; arrive_on?: string | null | undefined },
): { city: string; country: string; arrive_on: string; depart_on: string } | null {
  const city = trip.city?.trim();
  if (!city) return null;
  // A stopover through the same town is not a stay there.
  const stays = stops.filter((stop) => stop.kind !== "layover");
  if (stays.some((stop) => samePlace(stop, { city, country: trip.country }))) return null;
  // A country-only trip ("Brazil") is not a city to add.
  if (trip.country && cityKey(city) === cityKey(trip.country)) return null;
  const arrive = trip.start_date ?? "";
  // A day trip comes back the same evening: the trip is still there after it.
  const leaveBy =
    (next && !isDayTrip(next) ? next.arrive_on : "") ||
    stays
      .filter((s) => !isDayTrip(s))
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
 * dates, so a Rio plan is read in Rio and lands on Rio's days rather than on
 * the trip's first city. A city with no dates has none: the trip's would be
 * another city's days, so the plan asks for its first day instead.
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
  const start = city.arrive_on || undefined;
  const end = city.arrive_on ? city.depart_on || city.arrive_on : undefined;
  return {
    city: [city.city.trim(), city.country?.trim()].filter(Boolean).join(", "),
    ...(start ? { startDate: start } : {}),
    ...(end ? { endDate: end } : {}),
  };
}

/**
 * The route a plan for one city is placed on: that city alone, so every stop
 * is looked up there whatever date the plan gives it — not in whichever city
 * the trip is in that day. Built from the city itself when the route lacks it.
 */
export function scopedRoute<
  T extends {
    city: string;
    country?: string | null | undefined;
    arrive_on?: string | null | undefined;
  },
>(
  route: readonly T[],
  city: TripCity,
): Array<
  | T
  | {
      city: string;
      country: string | null;
      arrive_on: string | null;
      depart_on: string | null;
      lat: null;
      lon: null;
    }
> {
  const here = route.filter(
    (stop) => samePlace(stop, city) && (stop.arrive_on || "") === (city.arrive_on || ""),
  );
  if (here.length > 0) return here.slice(0, 1);
  return [
    {
      city: city.city,
      country: city.country || null,
      arrive_on: city.arrive_on || null,
      depart_on: city.depart_on || null,
      lat: null,
      lon: null,
    },
  ];
}

type HomeStopPatch = {
  city?: string;
  country?: string | null;
  lat?: null;
  lon?: null;
  arrive_on?: string | null;
  depart_on?: string | null;
};

type TripPlace = {
  city?: string | null | undefined;
  country?: string | null | undefined;
  start_date?: string | null | undefined;
  end_date?: string | null | undefined;
};

/**
 * What the trip's first stop should become when the trip's city or dates are
 * edited. A multi-city trip keeps a copy of the trip's own city as its first
 * stop; left alone, renaming the trip moved nothing on the route, and the old
 * city stayed first while the new one was offered as another.
 *
 * Only a first stop that still is that copy follows: same place as the trip
 * was, and each date followed only while it still matches the trip's old one,
 * so a stop the traveller changed themselves is left as they made it.
 */
export function homeStopFollow(
  before: TripPlace,
  patch: TripPlace,
  stops: readonly (TripCity & { id: string; position?: number | null })[],
): { id: string; patch: HomeStopPatch } | null {
  const first = [...stops].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
  if (!first || (first.kind ?? "destination") !== "destination") return null;
  if (!before.city?.trim() || !samePlace(first, before)) return null;
  const out: HomeStopPatch = {};
  if (patch.city !== undefined || patch.country !== undefined) {
    // A cleared city leaves the stop where it is: the trip went placeless.
    const city = patch.city?.trim() || before.city.trim();
    const country =
      patch.country !== undefined ? patch.country?.trim() || null : (before.country ?? null);
    if (cityKey(city) !== cityKey(first.city) || cityKey(country) !== cityKey(first.country)) {
      out.city = city;
      out.country = country;
      // The pin was the old city's.
      out.lat = null;
      out.lon = null;
    }
  }
  if (
    patch.start_date !== undefined &&
    (first.arrive_on || null) === (before.start_date || null) &&
    (patch.start_date || null) !== (first.arrive_on || null)
  )
    out.arrive_on = patch.start_date || null;
  if (
    patch.end_date !== undefined &&
    (first.depart_on || null) === (before.end_date || null) &&
    (patch.end_date || null) !== (first.depart_on || null)
  )
    out.depart_on = patch.end_date || null;
  return Object.keys(out).length ? { id: first.id, patch: out } : null;
}
