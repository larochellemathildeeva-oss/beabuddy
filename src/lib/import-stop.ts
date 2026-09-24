/**
 * Turning one parsed row of an imported plan into a timeline stop: its time,
 * how long it lasts, which place to look it up in, and whether its pin is
 * trusted enough to save.
 *
 * Pure, so each rule is tested on its own rather than through the sheet.
 */
import type { Confidence } from "./match-confidence.ts";

/**
 * A clock time as the timeline stores it, "HH:MM" in 24 hours, or null.
 *
 * The model is asked for 24-hour times, and mostly gives them, but a pasted
 * plan says "9am", "9.30", "21h30" or "noon", and whatever comes through is
 * saved as the stop's time. A time the timeline cannot sort is worse than no
 * time: it lands the stop in the wrong place in the day.
 */
export function normalizeClock(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "noon" || raw === "midday") return "12:00";
  if (raw === "midnight") return "00:00";
  const m = raw.match(/^(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const half = m[3]?.replace(/\./g, "");
  // A bare "9" is not a time: it is as likely a day or a stop number.
  if (!m[2] && !half) return null;
  if (half === "pm" && hour < 12) hour += 12;
  if (half === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Longest stay taken from a source; anything more is a misread, not a plan. */
const MAX_STAY_MIN = 12 * 60;

/**
 * How long the stop lasts, in minutes, when the source says: a length ("2h",
 * given as duration_minutes) or an end time after the start. Becomes the
 * stop's planned stay, which is what Companion counts down and "Leave by"
 * works from. Null when the source did not say — never a guess.
 */
export function stayMinutesFrom(row: {
  time_label?: string | null | undefined;
  end_time?: string | null | undefined;
  duration_minutes?: number | null | undefined;
}): number | null {
  const given = row.duration_minutes;
  if (given != null && Number.isFinite(given) && given > 0 && given <= MAX_STAY_MIN) {
    return Math.round(given);
  }
  const start = normalizeClock(row.time_label);
  const end = normalizeClock(row.end_time);
  if (!start || !end) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const span = toMin(end) - toMin(start);
  return span > 0 && span <= MAX_STAY_MIN ? span : null;
}

/**
 * Where to look a stop up. The stop's own town when the plan names one — a
 * Miyajima lunch on a Hiroshima trip, a Kyoto day on a Tokyo one — carrying
 * the trip's country along so "Kyoto" is not asked for worldwide. The trip's
 * area otherwise.
 */
export function stopArea(
  city: string | null | undefined,
  tripArea: string | null | undefined,
): string {
  const trip = (tripArea ?? "").trim();
  const own = (city ?? "").trim();
  if (!own) return trip;
  if (!trip) return own;
  const tripParts = trip
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const lower = own.toLowerCase();
  // Already the trip's city ("Hiroshima" on a "Hiroshima, Japan" trip).
  if (tripParts.some((p) => p.toLowerCase() === lower)) return trip;
  const country = tripParts.length > 1 ? tripParts[tripParts.length - 1] : "";
  if (!country || own.toLowerCase().includes(country.toLowerCase())) return own;
  return `${own}, ${country}`;
}

export type PinChoice = "keep" | "drop";

/**
 * Whether a found pin is saved with the stop.
 *
 * A confident or plausible match is saved unless the person removed it. A
 * doubtful one — a café that came back as a neighbourhood — is not saved
 * unless they chose to keep it: the review says "Check this one", and a pin
 * nobody looked at should not reach the map just because it exists.
 */
export function pinIsSaved(confidence: Confidence, choice: PinChoice | undefined): boolean {
  if (choice) return choice === "keep";
  return confidence !== "low";
}
