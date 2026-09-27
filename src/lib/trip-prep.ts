/**
 * The top of the trip's To do and Packing sheet: where and when, and the
 * strip of trip facts over the to-dos. Pure, so the counting is tested.
 */
import { tripDateLine, tripLengthLabel } from "./trip-card.ts";
import { bookingKind } from "./trip-overview.ts";

/** "Lisbon, Portugal · Oct 1 – 7" — whichever parts the trip has. */
export function prepPlaceLine(
  trip: {
    city?: string | null;
    country?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  },
  now = new Date(),
): string {
  const place = [trip.city, trip.country]
    .map((s) => s?.trim() ?? "")
    .filter(Boolean)
    .filter((s, i, all) => all.indexOf(s) === i)
    .join(", ");
  const when =
    trip.start_date || trip.end_date ? tripDateLine(trip.start_date, trip.end_date, now) : "";
  return [place, when].filter(Boolean).join(" · ");
}

export type PrepFactId = "days" | "stops" | "flights" | "stay";

export type PrepFact = { id: PrepFactId; value: string; label: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The summary strip: "3 days / Oct 1 – 3", "6 stops / in itinerary",
 * "2 bookings / flights", "1 booking / hotel". A fact the trip cannot answer
 * yet (no dates, nothing planned, no flight) is left out rather than shown
 * as a zero.
 */
export function prepFacts(
  trip: { start_date?: string | null; end_date?: string | null },
  items: Array<{ kind?: string | null; title?: string | null }>,
  now = new Date(),
): PrepFact[] {
  const out: PrepFact[] = [];
  const length = tripLengthLabel(trip.start_date, trip.end_date);
  if (length) {
    // The strip is narrow: the year belongs to the header line, not here.
    const dates = tripDateLine(trip.start_date, trip.end_date, now).replace(/, \d{4}$/, "");
    out.push({ id: "days", value: length, label: dates });
  }
  if (items.length > 0) {
    out.push({ id: "stops", value: plural(items.length, "stop", "stops"), label: "in itinerary" });
  }
  const flights = items.filter((i) => bookingKind(i) === "flight").length;
  if (flights > 0) {
    out.push({ id: "flights", value: plural(flights, "booking", "bookings"), label: "flights" });
  }
  const stays = items.filter((i) => bookingKind(i) === "stay").length;
  if (stays > 0) {
    out.push({ id: "stay", value: plural(stays, "booking", "bookings"), label: "hotel" });
  }
  return out;
}
