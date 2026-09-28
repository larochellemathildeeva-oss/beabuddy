/**
 * "Put the Louvre on Thursday morning", "swap day 2 and day 3": a change to
 * the plan in the traveller's words, read by the model as a short list of
 * moves and checked here before anything is shown.
 *
 * The model sees the stops as s1, s2 … and the days as d1, d2 …, never the
 * row ids, and answers in those. Anything it names that is not on the trip
 * is dropped, so a confused answer shows fewer moves, never a wrong one.
 * Nothing is saved from here: the traveller sees the moves and taps Apply.
 */
import { normalizeClock } from "./import-stop.ts";
import type { StopMove } from "./stop-move.ts";

export const PLAN_EDIT_MAX_REQUEST = 300;
export const PLAN_EDIT_MAX_STOPS = 150;
export const PLAN_EDIT_MAX_DAYS = 60;
export const PLAN_EDIT_MAX_MOVES = 30;

export type PlanEditStop = {
  id: string;
  title: string;
  day_date: string | null;
  time_label: string | null;
  kind?: string | null | undefined;
};

/** One move as the model writes it, every field a plain string. */
export type RawPlanMove = {
  stop: string;
  /** "d3", or "same" to stay on its day. */
  day: string;
  /** "start", "end", or the stop it goes straight after ("s4"). */
  after: string;
  /** "keep", "clear", or "HH:MM". */
  time: string;
};

const stopRef = (index: number) => `s${index + 1}`;
const dayRef = (index: number) => `d${index + 1}`;

/** The plan as the model reads it, one line a stop under its day. */
export function planEditPrompt(
  request: string,
  stops: readonly PlanEditStop[],
  days: readonly string[],
): string {
  const lines: string[] = [];
  const dayLabel = (day: string | null) => {
    if (!day) return "No date";
    const index = days.indexOf(day);
    return index < 0 ? day : `${dayRef(index)} (day ${index + 1}, ${day})`;
  };
  const keys = [...days, ...(stops.some((s) => !s.day_date) ? [null] : [])];
  for (const day of keys) {
    lines.push(`${dayLabel(day)}:`);
    stops.forEach((stop, index) => {
      if ((stop.day_date ?? null) !== day) return;
      lines.push(
        `  ${stopRef(index)} ${stop.time_label ? `${stop.time_label} ` : ""}${stop.title}${
          stop.kind ? ` [${stop.kind}]` : ""
        }`,
      );
    });
  }
  return [
    "You rearrange a travel plan. Here it is, day by day, stops in order:",
    lines.join("\n"),
    "",
    `The traveller asks: "${request.trim().slice(0, PLAN_EDIT_MAX_REQUEST)}"`,
    "",
    "Answer with only the moves that do what they ask, applied in order. For each move:",
    "- stop: the stop's ref (s1, s2 …).",
    '- day: the day ref it goes to (d1, d2 …), or "same" to stay on its day.',
    '- after: "start", "end", or the ref of the stop it goes straight after on that day.',
    '- time: "keep" to leave its time, "clear" to remove it, or a new time as HH:MM (24h).',
    "Move as few stops as the request needs. Never invent stops or days. Give a stop a new time",
    "only when asked, or when its old time would be out of order where it lands.",
    "reply: one short, friendly line saying what you did, or why you could not, in plain words.",
    "If the request is not about moving or retiming stops, return no moves and say so in reply.",
  ].join("\n");
}

/**
 * The model's moves as real moves, dropping any that name a stop or day not
 * on the trip. A stop named twice keeps its last move.
 */
export function readPlanEdit(
  raw: readonly RawPlanMove[],
  stops: readonly PlanEditStop[],
  days: readonly string[],
): StopMove[] {
  const stopFor = (ref: string) => {
    const m = /^s(\d+)$/i.exec(ref.trim());
    return m ? stops[Number(m[1]) - 1] : undefined;
  };
  const moves = new Map<string, StopMove>();
  for (const move of raw.slice(0, PLAN_EDIT_MAX_MOVES)) {
    const stop = stopFor(move.stop);
    if (!stop) continue;
    let day: string | null;
    const dayText = move.day.trim().toLowerCase();
    if (!dayText || dayText === "same") {
      day = stop.day_date;
    } else {
      const m = /^d(\d+)$/.exec(dayText);
      const found = m ? days[Number(m[1]) - 1] : undefined;
      if (!found) continue;
      day = found;
    }
    const afterText = move.after.trim().toLowerCase();
    let at: StopMove["at"];
    if (afterText === "start") at = "start";
    else if (!afterText || afterText === "end") at = "end";
    else {
      const anchor = stopFor(afterText);
      if (!anchor || anchor.id === stop.id) continue;
      at = { after: anchor.id };
    }
    const timeText = move.time.trim().toLowerCase();
    let time: string | null | undefined;
    if (!timeText || timeText === "keep") time = undefined;
    else if (timeText === "clear") time = null;
    else {
      const clock = normalizeClock(timeText);
      if (!clock) continue;
      time = clock;
    }
    moves.delete(stop.id);
    moves.set(stop.id, {
      id: stop.id,
      day_date: day,
      at,
      ...(time !== undefined ? { time_label: time } : {}),
    });
  }
  return [...moves.values()];
}
