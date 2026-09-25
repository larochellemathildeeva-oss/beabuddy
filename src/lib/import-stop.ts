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

/**
 * Getting from one stop to the next, which is not a stop.
 *
 * "Travel to Peace Memorial Park", "Walk to the museum", "Take the ferry to
 * Miyajima": plans write the journey as a line of its own, and each became a
 * card on the timeline with "No place yet" — a stop that is really the gap
 * between two stops, which the paws between cards already are.
 *
 * Only movement *to* somewhere counts. "Arrive Hiroshima Station" is a place
 * with a time and stays; a booked flight or reservation is its own kind and
 * is never touched.
 */
const MOVEMENT =
  /^(?:travel|walk|stroll|head|go|drive|ride|cycle|bike|return|transfer|move|make your way|get|hop|catch|take|board|bus|train|tram|metro|subway|taxi|cab|uber|ferry|boat|shinkansen|jr|monorail|streetcar|start|set off|leave|depart|continue|proceed|cross)\b.*\b(?:to|toward|towards|back|for)\b/i;

export function isTravelLeg(row: { kind: string; title: string }): boolean {
  return row.kind === "transport" && MOVEMENT.test(row.title.trim());
}

type FoldableRow = {
  kind: string;
  title: string;
  detail: string | null;
  time_label: string | null;
  day_date: string | null;
  day_number: number | null;
};

/**
 * The plan with its travel legs folded into the stop they lead to: "Getting
 * there: Take the ferry to Miyajima, 10:30" is added to that stop's detail,
 * so the departure time is kept. A leg with no stop after it on the same day
 * goes onto the stop before it as "Afterwards: …"; a leg alone on its day stays.
 */
export function foldTravelLegs<T extends FoldableRow>(rows: readonly T[]): T[] {
  const out = rows.map((row) => ({ ...row }));
  const drop = new Set<number>();
  out.forEach((row, i) => {
    if (!isTravelLeg(row)) return;
    const target = legTarget(out, i, drop);
    if (!target) return;
    const into = out[target.index]!;
    into.detail = withLegNote(into.detail, row, target.after);
    drop.add(i);
  });
  return out.filter((_, i) => !drop.has(i));
}

type DayRow = { kind: string; title: string; day_date: string | null; day_number?: number | null };

const sameDay = (a: DayRow, b: DayRow) =>
  (a.day_date ?? "") === (b.day_date ?? "") && (a.day_number ?? 0) === (b.day_number ?? 0);

/**
 * The stop a travel leg belongs to: the next stop that day, or — when it is
 * the day's last movement — the stop before it. Null when it is alone.
 */
export function legTarget(
  rows: readonly DayRow[],
  i: number,
  skip: ReadonlySet<number> = new Set(),
): { index: number; after: boolean } | null {
  const row = rows[i]!;
  for (let j = i + 1; j < rows.length && sameDay(rows[j]!, row); j++) {
    if (!isTravelLeg(rows[j]!)) return { index: j, after: false };
  }
  for (let j = i - 1; j >= 0 && sameDay(rows[j]!, row); j--) {
    if (!isTravelLeg(rows[j]!) && !skip.has(j)) return { index: j, after: true };
  }
  return null;
}

/** A stop's note with the leg added: "Getting there: Take the ferry to Miyajima, 10:30". */
export function withLegNote(
  detail: string | null,
  leg: Pick<FoldableRow, "title" | "time_label" | "detail">,
  after: boolean,
): string {
  const what = [leg.title, leg.time_label, leg.detail].filter(Boolean).join(", ");
  const note = `${after ? "Afterwards" : "Getting there"}: ${what}`;
  return detail ? `${detail} · ${note}` : note;
}
