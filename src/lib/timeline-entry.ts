/**
 * Helpers for the hand-typed timeline entry form.
 *
 * Times used to be free text, so "2pm", "14h" and "afternoon" all landed in the
 * same column — the one that drives ordering and everything Optimize reasons
 * about. These normalise what people actually type without rejecting it.
 */

import { parseLocalDate, toLocalISODate } from "./trip-dates.ts";

export type TimeChip = { id: string; label: string; value: string };

/** Rough parts of the day, for when someone knows "morning" but not "09:00". */
export const TIME_CHIPS: TimeChip[] = [
  { id: "morning", label: "Morning", value: "09:00" },
  { id: "afternoon", label: "Afternoon", value: "14:00" },
  { id: "evening", label: "Evening", value: "19:00" },
];

const WORD_TIMES: Record<string, string> = {
  morning: "09:00",
  noon: "12:00",
  midday: "12:00",
  afternoon: "14:00",
  evening: "19:00",
  night: "21:00",
  midnight: "00:00",
};

/**
 * Turn what someone typed into 24-hour "HH:MM".
 *
 * Returns the trimmed input unchanged when it is not a time at all — a label
 * like "after check-in" is still more useful to its owner than an empty field.
 */
export function normalizeTimeLabel(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  const word = WORD_TIMES[text.toLowerCase()];
  if (word) return word;

  // 2pm · 2 pm · 2:30pm · 02:30 PM
  const ampm = /^(\d{1,2})(?:[:.h](\d{2}))?\s*([ap])\.?m\.?$/i.exec(text);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59) return text;
    if (ampm[3]!.toLowerCase() === "p" && hour !== 12) hour += 12;
    if (ampm[3]!.toLowerCase() === "a" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  // 14:00 · 14.00 · 14h · 14h30 · 9:5
  const clock = /^(\d{1,2})(?:[:.h](\d{1,2}))?h?$/i.exec(text);
  if (clock) {
    const hour = Number(clock[1]);
    const minute = Number(clock[2] ?? 0);
    if (hour > 23 || minute > 59) return text;
    // A bare "3" is as likely to be a count as a time — leave it alone.
    if (clock[2] === undefined && !/[:.h]/i.test(text)) return text;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return text;
}

/** True when the normalised label is a real 24-hour clock time. */
export function isClockTime(label: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(label);
}

/**
 * The day a new entry should start on: the day the user is looking at, else
 * the trip start, else nothing. Never guesses a day outside the trip.
 */
export function defaultEntryDay(input: {
  openDay?: string | undefined;
  tripStart?: string | null | undefined;
  tripEnd?: string | null | undefined;
}): string {
  const { openDay, tripStart } = input;
  if (openDay && parseLocalDate(openDay)) return openDay;
  if (tripStart && parseLocalDate(tripStart)) return tripStart;
  return "";
}

/** Inclusive range check; an open-ended trip accepts anything. */
export function dayWithinTrip(
  day: string,
  tripStart: string | null | undefined,
  tripEnd: string | null | undefined,
): boolean {
  if (!day) return true;
  if (tripStart && day < tripStart) return false;
  if (tripEnd && day > tripEnd) return false;
  return true;
}

/**
 * A gentle note when a day sits outside the trip — a warning, never a block.
 * Dates move, and Béa does not lock the door behind you.
 */
export function dayOutsideTripNote(
  day: string,
  tripStart: string | null | undefined,
  tripEnd: string | null | undefined,
): string | null {
  if (dayWithinTrip(day, tripStart, tripEnd)) return null;
  if (tripStart && day < tripStart) return "That's before the trip starts — saving it anyway.";
  return "That's after the trip ends — saving it anyway.";
}

/** Every day of the trip, for the day picker chips. Capped so a long trip stays usable. */
export function tripDayOptions(
  tripStart: string | null | undefined,
  tripEnd: string | null | undefined,
  max = 21,
): string[] {
  const from = tripStart ? parseLocalDate(tripStart) : undefined;
  if (!from) return [];
  const to = tripEnd ? parseLocalDate(tripEnd) : undefined;
  const days: string[] = [];
  const cursor = new Date(from.getTime());
  for (let i = 0; i < max; i += 1) {
    if (to && cursor.getTime() > to.getTime()) break;
    days.push(toLocalISODate(cursor));
    if (!to) break;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * A trip name from whatever the create form has so far, so nobody has to
 * invent a title before Béa will keep anything.
 */
export function suggestedTripTitle(city: string, startDate: string): string {
  const place = city.trim().split(",")[0]?.trim() ?? "";
  const start = startDate ? parseLocalDate(startDate) : undefined;
  const when = start ? start.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";
  if (place && when) return `${place} · ${when}`;
  if (place) return place;
  return "";
}
