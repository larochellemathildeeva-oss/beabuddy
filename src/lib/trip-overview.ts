/**
 * What the trip Overview counts: which itinerary entries are bookings of
 * which kind (flights, stays, other transport, activities). Pure, so the
 * sorting rule is tested on its own.
 */
import { routeStopOn } from "./import-stop.ts";
import { countdownLabel, isUnderway } from "./trip-card.ts";
import { isDayTrip, shortCity } from "./trip-cities.ts";
import { parseLocalDate } from "./trip-dates.ts";
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

/** Local midnight, so a date-only start compares as a calendar day. */
function calendarDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * The start is still ahead of today. A countdown that stays quiet a year
 * out is not the same thing: that trip has not begun.
 */
function startStillAhead(start: string, now: Date): boolean {
  const from = parseLocalDate(start);
  if (!from) return false;
  return from.getTime() >= calendarDay(now).getTime();
}

/**
 * Which lead the Overview shows. On the trip: Right now. Still ahead, or
 * dates not chosen: Before you go. Already over: neither — the days and
 * the bookings are the recap. Pass the traveller's today as `now` so this
 * agrees with the day badges.
 */
export function overviewMoment(
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
): "now" | "before" | "after" {
  if (isUnderway(start, end, now)) return "now";
  if (!start || startStillAhead(start, now)) return "before";
  return "after";
}

/** The line beside "Before you go": "Leaving in 4 days", or that dates are open. */
export function beforeYouGoLine(start: string | null | undefined, now = new Date()): string {
  const soon = countdownLabel(start, now);
  if (soon === "today") return "Leaving today";
  if (soon === "tomorrow") return "Leaving tomorrow";
  if (soon) return `Leaving ${soon}`;
  const from = start ? parseLocalDate(start) : undefined;
  if (from && from.getTime() > calendarDay(now).getTime()) {
    return `Leaving ${from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return "Dates still open";
}

/**
 * The badge on a day card, and only while the trip is underway. Today is
 * today. A day already behind is Done only when every stop on it was
 * arrived at and left — the same record Companion keeps. Anything else
 * stays unbadged, so a day you have not finished is not called done.
 */
export function overviewDayStatus(
  day: string,
  today: string,
  underway: boolean,
  stops: readonly { arrived_at?: string | null; left_at?: string | null }[],
): "today" | "done" | null {
  if (!underway || !day) return null;
  if (day === today) return "today";
  if (day < today && stops.length > 0 && stops.every((stop) => stop.arrived_at && stop.left_at)) {
    return "done";
  }
  return null;
}

/**
 * A city the trip sleeps in with no stay on those days. `start` is that
 * stretch's first day, so a return to the same city is a second gap.
 */
export type StayGap = { city: string; nights: number; start: string };

/**
 * Where a night has no place to sleep. Nights inside a stretch are its
 * days minus one. A stretch that is not the last still has the night you
 * sleep there before going on, so a one-day city in the middle counts.
 * A day trip sleeps back at its base and is never a gap of its own. The
 * last day of the trip, on its own, is not a night. A stay anywhere on
 * the stretch — booked or only planned — covers it.
 */
export function missingStays<C extends { city: string; kind?: string | null }>(
  stretches: readonly CityStretch<C>[],
  items: readonly { day_date: string | null; kind?: string | null; title?: string | null }[],
): StayGap[] {
  const out: StayGap[] = [];
  stretches.forEach((stretch, index) => {
    const place = stretch.city;
    if (!place || isDayTrip(place)) return;
    const name = shortCity(place.city);
    if (!name) return;
    const nights = stretch.lastDay - stretch.firstDay + (index < stretches.length - 1 ? 1 : 0);
    if (nights < 1) return;
    const stayed = items.some(
      (item) =>
        item.day_date != null &&
        item.day_date >= stretch.start &&
        item.day_date <= stretch.end &&
        bookingKind(item) === "stay",
    );
    if (!stayed) out.push({ city: name, nights, start: stretch.start });
  });
  return out;
}

/**
 * Nights on a trip that has no city to name, and no stay planned. City
 * gaps are said on their own, so this stays quiet when one of those
 * already covers the reminder.
 */
export function unnamedStayNights(
  days: readonly string[],
  gaps: readonly StayGap[],
  items: readonly { kind?: string | null; title?: string | null }[],
): number {
  if (gaps.length > 0 || days.length < 2) return 0;
  if (items.some((item) => bookingKind(item) === "stay")) return 0;
  return days.length - 1;
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
