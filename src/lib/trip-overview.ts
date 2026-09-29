/**
 * What the trip Overview counts: which itinerary entries are bookings of
 * which kind (flights, stays, other transport, activities). Pure, so the
 * sorting rule is tested on its own.
 */
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
