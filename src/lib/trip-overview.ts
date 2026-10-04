/**
 * What the trip Overview counts: which itinerary entries are bookings of
 * which kind (flights, stays, other transport, activities). Pure, so the
 * sorting rule is tested on its own.
 */
import { routeStopOn } from "./import-stop.ts";
import { parseLocalDate } from "./trip-dates.ts";
import { isDayTrip, shortCity } from "./trip-cities.ts";
import { timelineGlyph } from "./timeline-kind.ts";

export type BookingKind = "flight" | "stay" | "transport" | "activity";

const FLIGHT = /\b(flight|fly|flies|plane|airport|airline|air)\b/i;

/**
 * The kind a timeline entry counts as. A walk or a note is not a booking; a
 * meal or a sight counts as an activity (a table, a ticket).
 */
export function bookingKind(item: {
  kind?: string | null;
  title?: string | null;
}): BookingKind | null {
  const glyph = timelineGlyph(item);
  const text = `${item.kind ?? ""} ${item.title ?? ""}`;
  if (glyph === "transport") return FLIGHT.test(text) ? "flight" : "transport";
  if (glyph === "lodging") return "stay";
  if (glyph === "walk" || glyph === "note") return null;
  return "activity";
}

/** A Trip documents kind read as one of the trip's booking kinds. */
export function documentBookingKind(kind: string | null | undefined): BookingKind | null {
  switch ((kind ?? "").toLowerCase()) {
    case "flight":
      return "flight";
    case "accommodation":
      return "stay";
    case "train":
    case "car":
      return "transport";
    case "restaurant":
    case "activity":
    case "ticket":
      return "activity";
    default:
      return null;
  }
}

export type TripBooking =
  | { source: "stop"; id: string; kind: BookingKind; title: string; booked: boolean }
  | { source: "document"; id: string; kind: BookingKind; title: string; eventId: string | null };

/**
 * Everything the trip counts as a booking, by kind: its booked stops, and
 * the Trip documents filed to it. A document linked to a stop that is
 * already counted is the same booking, so it is not counted twice.
 */
export function tripBookings(
  stops: readonly {
    id: string;
    kind?: string | null;
    title?: string | null;
    booked?: boolean | null;
  }[],
  docs: readonly {
    id: string;
    kind: string;
    title: string;
    itinerary_item_id: string | null;
  }[],
): TripBooking[] {
  const out: TripBooking[] = [];
  const counted = new Set<string>();
  for (const stop of stops) {
    if (stop.booked !== true) continue;
    const kind = bookingKind(stop);
    if (!kind) continue;
    counted.add(stop.id);
    out.push({ source: "stop", id: stop.id, kind, title: stop.title ?? "", booked: true });
  }
  for (const doc of docs) {
    if (doc.itinerary_item_id && counted.has(doc.itinerary_item_id)) continue;
    const kind =
      documentBookingKind(doc.kind) ??
      (doc.itinerary_item_id
        ? bookingKind(stops.find((s) => s.id === doc.itinerary_item_id) ?? {})
        : null);
    if (!kind) continue;
    if (doc.itinerary_item_id) counted.add(doc.itinerary_item_id);
    out.push({
      source: "document",
      id: doc.id,
      kind,
      title: doc.title,
      eventId: doc.itinerary_item_id,
    });
  }
  return out;
}

export function countBookings(bookings: readonly TripBooking[]): Record<BookingKind, number> {
  const counts: Record<BookingKind, number> = { flight: 0, stay: 0, transport: 0, activity: 0 };
  for (const b of bookings) counts[b.kind] += 1;
  return counts;
}

/** One run of days in the same city: "Days 1–3 · Oct 1 – 3 · Berlin". */
export type CityStretch<C> = {
  /** Null for days the route does not place anywhere. */
  city: C | null;
  /** First and last day, YYYY-MM-DD. */
  start: string;
  end: string;
  /** Day numbers across the trip, from 1. */
  firstDay: number;
  lastDay: number;
  /** Timeline stops on these days. */
  stops: number;
};

/**
 * The trip as a recap of where it is when: consecutive days in the same city
 * folded into one stretch, by the same rule placing uses (`routeStopOn`). A
 * day trip is its own stretch between two of its base's.
 */
export function cityStretches<
  C extends { city: string; arrive_on?: string | null; depart_on?: string | null },
>(
  days: readonly string[],
  route: readonly C[],
  stops: readonly { day_date: string | null }[],
): CityStretch<C>[] {
  const perDay = new Map<string, number>();
  for (const stop of stops) {
    if (stop.day_date) perDay.set(stop.day_date, (perDay.get(stop.day_date) ?? 0) + 1);
  }
  const out: CityStretch<C>[] = [];
  days.forEach((day, i) => {
    const city = routeStopOn(route, day);
    const last = out[out.length - 1];
    if (last && last.city === city && last.lastDay === i) {
      last.end = day;
      last.lastDay = i + 1;
      last.stops += perDay.get(day) ?? 0;
      return;
    }
    out.push({
      city,
      start: day,
      end: day,
      firstDay: i + 1,
      lastDay: i + 1,
      stops: perDay.get(day) ?? 0,
    });
  });
  return out;
}

export type StayGap = {
  /** The city with a night and no stay. Null when the whole trip has none. */
  city: string | null;
  start: string | null;
  end: string | null;
};

/**
 * Nights the plan does not put a stay on.
 *
 * A stretch of more than one day in a city (not a day trip) needs a stay on
 * one of those days. A trip longer than a day with no stay anywhere — and no
 * overnight stretch to name — uses the same line as the trip checkup, so the
 * two screens agree. A stay filed as a document with no day counts as a stay
 * somewhere, and is not nagged about city by city.
 */
export function missingStays<C extends { city: string; kind?: string | null }>(
  days: readonly string[],
  stretches: readonly CityStretch<C>[],
  lodgingDays: readonly string[],
  hasStay: boolean,
): StayGap[] {
  if (days.length < 2) return [];
  if (hasStay && lodgingDays.length === 0) return [];
  const nights = new Set(lodgingDays);
  const gaps: StayGap[] = [];
  for (const stretch of stretches) {
    if (!stretch.city || isDayTrip(stretch.city)) continue;
    if (stretch.lastDay <= stretch.firstDay) continue;
    const covered = days.some(
      (day, index) =>
        index + 1 >= stretch.firstDay && index + 1 <= stretch.lastDay && nights.has(day),
    );
    if (!covered) gaps.push({ city: stretch.city.city, start: stretch.start, end: stretch.end });
  }
  if (gaps.length === 0 && !hasStay)
    return [{ city: null, start: days[0] ?? null, end: days.at(-1) ?? null }];
  return gaps;
}

/**
 * Saved places that belong to this trip: a place whose city is one of the
 * trip's, unvisited first. Nothing is invented when the trip has no cities.
 */
export function placesForTrip<T extends { city: string | null; visited?: boolean }>(
  places: readonly T[],
  cities: readonly string[],
): T[] {
  const needles = [
    ...new Set(
      cities.flatMap((city) => {
        const full = city.trim().toLowerCase();
        const short = shortCity(city).trim().toLowerCase();
        return [full, short].filter(Boolean);
      }),
    ),
  ];
  if (needles.length === 0) return [];
  const matched = places.filter((place) => {
    const city = (place.city ?? "").trim().toLowerCase();
    return city !== "" && needles.some((needle) => city.includes(needle) || needle.includes(city));
  });
  return [
    ...matched.filter((place) => !place.visited),
    ...matched.filter((place) => place.visited),
  ];
}

/** "Leaving in 4 days" / "Leaving tomorrow", or "" once the trip has started. */
export function leavingIn(start: string | null | undefined, today: string): string {
  if (!start || start <= today) return "";
  const from = parseLocalDate(today);
  const to = parseLocalDate(start);
  if (!from || !to) return "";
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (days <= 0) return "";
  if (days === 1) return "Leaving tomorrow";
  return `Leaving in ${days} days`;
}

/** "Oct 1", "Oct 1 – 3", "Sep 30 – Oct 2". */
export function stretchDates(start: string, end: string): string {
  const from = parseLocalDate(start);
  const to = parseLocalDate(end);
  if (!from) return "";
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  if (!to || start === end) return `${month(from)} ${from.getDate()}`;
  return month(from) === month(to) && from.getFullYear() === to.getFullYear()
    ? `${month(from)} ${from.getDate()} – ${to.getDate()}`
    : `${month(from)} ${from.getDate()} – ${month(to)} ${to.getDate()}`;
}
