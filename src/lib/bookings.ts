/**
 * Booking details on a stop: whether it is booked, and the reference and
 * notes to show at the door.
 *
 * The columns come from a migration applied by hand, so the app has to work
 * before it runs: a read that asks for them is retried without them, and a
 * stop without them reads as not booked.
 */

export const BOOKING_REF_MAX = 200;
export const BOOKING_DETAILS_MAX = 2000;

/** PostgREST's answer when a selected column does not exist yet. */
export function isMissingColumn(
  error: { message?: string; code?: string } | null | undefined,
  columns: readonly string[],
): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  const named = columns.some((c) => msg.includes(c.toLowerCase()));
  return (
    named &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      /does not exist|schema cache|could not find/.test(msg))
  );
}

export function isBooked(stop: { booked?: boolean | null }): boolean {
  return stop.booked === true;
}

/** Trimmed and length-capped, or null for empty — what the columns accept. */
export function cleanBookingText(value: string, max: number): string | null {
  const text = value.trim().slice(0, max);
  return text ? text : null;
}
