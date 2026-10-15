/**
 * Words for the trip page's head card (Figma "Trip overview", "Trip map",
 * "Trip timeline"): the dates as "Apr 5 – Apr 16, 2026" and how many days that
 * is. Pure; the card only lays them out.
 */

function parse(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function part(date: Date, withYear: boolean): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** "Apr 5 – Apr 16, 2026"; one date when only one is known; "" when neither. */
export function frameDateRange(start: string | null | undefined, end: string | null | undefined) {
  const a = parse(start);
  const b = parse(end);
  if (a && b) {
    return a.getTime() === b.getTime() ? part(a, true) : `${part(a, false)} – ${part(b, true)}`;
  }
  const one = a ?? b;
  return one ? part(one, true) : "";
}

/** Whole days from the first to the last, both counted; null without both. */
export function frameDayCount(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const a = parse(start);
  const b = parse(end);
  if (!a || !b || b < a) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/** "12 days", "1 day". */
export function frameDaysLabel(days: number | null): string {
  return days === null ? "" : `${days} ${days === 1 ? "day" : "days"}`;
}

/** "2h", "1h 30m", "45m": the stay as the timeline frame writes it. */
export function frameStay(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "09:00–11:00" from a clock start and a stay; the start alone without a stay. */
export function stopTimeSpan(start: string, minutes: number | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(start.trim());
  if (!m) return start.trim();
  const from = Number(m[1]) * 60 + Number(m[2]);
  const pad = (n: number) => String(n).padStart(2, "0");
  const at = (t: number) => `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
  return minutes && minutes > 0 ? `${at(from)}–${at(from + minutes)}` : at(from);
}
