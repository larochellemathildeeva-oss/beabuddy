/**
 * Opening hours as OpenStreetMap writes them, read well enough to answer
 * "will it be open when I get there?".
 *
 * `opening_hours` is a whole language — public holidays, months, week
 * numbers, "sunrise-sunset". Béa reads the part almost every café, museum
 * and shrine actually uses: days, day ranges and clock ranges, "off", and
 * "24/7". Anything else answers null — "can't tell" — and the hours are shown
 * as written, never guessed at. A wrong "open" is worse than no answer.
 */

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

type Rule = { days: Set<number>; ranges: [number, number][] | "off" };

/** "Mo-Fr" / "Sa,Su" / "Mo-We,Fr" → day numbers, Monday 0. Null if not days. */
function readDays(text: string): Set<number> | null {
  const out = new Set<number>();
  for (const part of text.split(",")) {
    const [a, b] = part.split("-");
    const from = DAYS.indexOf(a as (typeof DAYS)[number]);
    if (from < 0) return null;
    if (b === undefined) {
      out.add(from);
      continue;
    }
    const to = DAYS.indexOf(b as (typeof DAYS)[number]);
    if (to < 0) return null;
    for (let d = from; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === to) break;
    }
  }
  return out;
}

/** "09:00-17:00,19:00-22:30" → minute ranges. Past midnight runs on to 24:00+. */
function readRanges(text: string): [number, number][] | null {
  const out: [number, number][] = [];
  for (const part of text.split(",")) {
    const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\+?$/.exec(part.trim());
    if (!m) return null;
    const from = Number(m[1]) * 60 + Number(m[2]);
    let to = Number(m[3]) * 60 + Number(m[4]);
    if (from > 24 * 60 || to > 48 * 60) return null;
    if (to <= from) to += 24 * 60;
    out.push([from, to]);
  }
  return out;
}

/** The rules, or null when the text uses anything beyond the common subset. */
export function parseOpeningHours(text: string | null | undefined): Rule[] | null {
  const src = (text ?? "").trim();
  if (!src) return null;
  if (src === "24/7") return [{ days: new Set([0, 1, 2, 3, 4, 5, 6]), ranges: [[0, 24 * 60]] }];
  const rules: Rule[] = [];
  for (const raw of src.split(";")) {
    const part = raw.trim();
    if (!part) continue;
    // "Mo-Fr 09:00-17:00", "Su off", or just "10:00-18:00" (every day).
    const m = /^([A-Za-z,-]+)\s+(.+)$/.exec(part);
    const dayText = m && /^[A-Z][a-z]/.test(m[1]!) ? m[1]! : null;
    const rest = dayText ? m![2]!.trim() : part;
    const days = dayText ? readDays(dayText) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    if (rest === "off" || rest === "closed") {
      rules.push({ days, ranges: "off" });
      continue;
    }
    const ranges = readRanges(rest);
    if (!ranges) return null;
    rules.push({ days, ranges });
  }
  return rules.length ? rules : null;
}

/**
 * Open at this moment? True, false, or null when the hours can't be read.
 * Later rules override earlier ones for the days they name, as in OSM.
 * A range past midnight ("18:00-02:00") covers the small hours of the next day.
 */
export function isOpenAt(text: string | null | undefined, at: Date): boolean | null {
  const rules = parseOpeningHours(text);
  if (!rules) return null;
  const day = (at.getDay() + 6) % 7; // Monday 0
  const minute = at.getHours() * 60 + at.getMinutes();
  const rangesFor = (d: number): [number, number][] => {
    let found: [number, number][] = [];
    for (const rule of rules)
      if (rule.days.has(d)) found = rule.ranges === "off" ? [] : rule.ranges;
    return found;
  };
  if (rangesFor(day).some(([a, b]) => minute >= a && minute < b)) return true;
  const yesterday = (day + 6) % 7;
  return rangesFor(yesterday).some(([, b]) => b > 24 * 60 && minute < b - 24 * 60);
}

/**
 * When a stop's visit falls outside the hours: a short warning, or null.
 * `day` is "YYYY-MM-DD" and `time` "HH:MM", both as the timeline stores them.
 */
export function closedWarning(
  hours: string | null | undefined,
  day: string | null | undefined,
  time: string | null | undefined,
): string | null {
  if (!day || !time || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{1,2}:\d{2}$/.test(time)) {
    return null;
  }
  const [y, mo, d] = day.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const open = isOpenAt(hours, new Date(y, mo - 1, d, h, mi));
  return open === false ? `Likely closed at ${time} on that day — check the hours.` : null;
}

/**
 * The stretches of one day ("YYYY-MM-DD") the place is open, in minutes after
 * that day's midnight: [] when it is closed all day, null when the hours
 * can't be read or the day isn't a date. A range running past midnight
 * reaches past 1440; the small hours left over from the evening before are
 * included from 0, so a bar open until 02:00 is open at 01:00 too.
 */
export function openWindowsOn(
  hours: string | null | undefined,
  day: string | null | undefined,
): [number, number][] | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const rules = parseOpeningHours(hours);
  if (!rules) return null;
  const [y, mo, d] = day.split("-").map(Number) as [number, number, number];
  const date = new Date(y, mo - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = (date.getDay() + 6) % 7; // Monday 0
  const rangesFor = (n: number): [number, number][] => {
    let found: [number, number][] = [];
    for (const rule of rules)
      if (rule.days.has(n)) found = rule.ranges === "off" ? [] : rule.ranges;
    return found;
  };
  const carried = rangesFor((weekday + 6) % 7)
    .filter(([, b]) => b > 24 * 60)
    .map(([, b]) => [0, b - 24 * 60] as [number, number]);
  return [...carried, ...rangesFor(weekday).map(([a, b]) => [a, b] as [number, number])].sort(
    (a, b) => a[0] - b[0],
  );
}
