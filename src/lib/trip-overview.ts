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
