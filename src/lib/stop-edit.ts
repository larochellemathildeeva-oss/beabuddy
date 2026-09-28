/**
 * A change to the plan, typed in plain words.
 *
 * "Change the time of Louvre on day 2 to 6am", "move breakfast to 7:30",
 * "set Musée d'Orsay on day 3 at 14h". Read here without a model: one stop,
 * optionally one day, one new time. Anything else is not understood, and the
 * box says so with an example rather than guessing — a wrong stop moved
 * quietly is worse than a question.
 */
import { fuzzyScore } from "./fuzzy.ts";
import { normalizeClock } from "./import-stop.ts";

export type TimeChange = {
  /** The stop as typed: "Louvre", "stop 3". */
  stop: string;
  /** The day as typed, counting from 1; null when not said. */
  day: number | null;
  /** "06:00". */
  time: string;
};

const TIME = String.raw`(\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|\d{1,2}h|noon|midday|midnight)`;
const DAY = String.raw`(?:\s+(?:on|for)\s+day\s*(\d{1,2}))?`;

const PATTERNS = [
  // "change (the) time of X on day 2 to 6am"
  new RegExp(
    String.raw`^(?:change|move|set|make|put|update)\s+(?:the\s+)?(?:start\s+)?time\s+(?:of|for)\s+(.+?)${DAY}\s+(?:to|at)\s+${TIME}$`,
    "i",
  ),
  // "move X on day 2 to 6am", "set X at 6am", "X on day 2 at 6am"
  new RegExp(
    String.raw`^(?:(?:change|move|set|put|make|push|pull|shift)\s+)?(.+?)${DAY}\s+(?:to|at|for)\s+${TIME}$`,
    "i",
  ),
];

export function readTimeChange(text: string): TimeChange | null {
  const line = text
    .trim()
    .replace(/[.!]+$/, "")
    .replace(/\s+/g, " ");
  for (const pattern of PATTERNS) {
    const m = line.match(pattern);
    if (!m) continue;
    const stop = m[1]!
      .replace(/^(?:the\s+)?stop\s+(?=\D)/i, "")
      .replace(/^the\s+/i, "")
      .replace(/^["“'‘](.*)["”'’]$/, "$1")
      .trim();
    const time = normalizeClock(m[3]);
    if (!stop || !time) continue;
    return { stop, day: m[2] ? Number(m[2]) : null, time };
  }
  return null;
}

export type EditableStop = { id: string; title: string; day_date: string | null };

/**
 * The stop a change means, or why it cannot be told: none match, or several
 * match as well as each other. `days` is the trip's dated days in order, so
 * "day 2" is the second of them.
 */
export function findStopForChange<T extends EditableStop>(
  change: TimeChange,
  stops: readonly T[],
  days: readonly string[],
): { stop: T } | { problem: "no-day" | "no-stop" | "ambiguous"; options?: T[] } {
  let pool = stops;
  if (change.day != null) {
    const date = days[change.day - 1];
    if (!date) return { problem: "no-day" };
    pool = stops.filter((s) => s.day_date === date);
  }
  // "stop 3": the third stop of that day, as numbered on the timeline.
  const numbered = change.stop.match(/^(?:stop\s*|#)?(\d{1,2})$/i);
  if (numbered) {
    const hit = pool[Number(numbered[1]) - 1];
    return hit ? { stop: hit } : { problem: "no-stop" };
  }
  const scored = pool
    .map((stop) => ({ stop, score: fuzzyScore(stop.title, change.stop) }))
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { problem: "no-stop" };
  const best = scored[0]!;
  const tied = scored.filter((s) => s.score === best.score);
  if (tied.length > 1) return { problem: "ambiguous", options: tied.map((s) => s.stop) };
  return { stop: best.stop };
}
