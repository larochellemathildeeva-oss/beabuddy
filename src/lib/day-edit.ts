/**
 * "Change a day": the traveller picks one day, ticks the stops Béa may touch,
 * says what they want in their own words, and sees the day as it is beside
 * the day as Béa would have it before anything is saved.
 *
 * The model sees the day's stops as s1, s2 … and the trip's days as d1, d2 …,
 * never the row ids, and answers with the day's new timeline in order. It is
 * checked here: a stop not on the day is dropped, a stop the traveller did not
 * tick keeps its day and its time (others may move around it), and a stop the
 * model forgot stays where it was. So a confused answer changes less, never
 * something the traveller did not offer up.
 */
import { normalizeClock } from "./import-stop.ts";
import type { StopMove } from "./stop-move.ts";

/** One ask, as typed. */
export const DAY_EDIT_MAX_ASK = 400;
/** Every ask so far, joined, when the traveller refines Béa's version. */
export const DAY_EDIT_MAX_REQUEST = 1200;
export const DAY_EDIT_MAX_STOPS = 40;
export const DAY_EDIT_MAX_DAYS = 60;

export type DayEditStop = {
  id: string;
  title: string;
  day_date: string | null;
  time_label: string | null;
  position: number;
  kind?: string | null | undefined;
};

/** One line of the model's new timeline, every field a plain string. */
export type RawDayEditStop = {
  stop: string;
  /** "same" to stay on the day, "d4" for another day, "none" to set it aside. */
  day: string;
  /** "keep", "clear", or "HH:MM". */
  time: string;
};

/** Béa's version of the day, by row id, as the server sends it. */
export type DayEditPlan = {
  /** Every stop that stays on the day, in its new order, with its time. */
  order: Array<{ id: string; time_label: string | null }>;
  /** Stops that leave the day: to another day, or `null` to be set aside. */
  away: Array<{ id: string; day_date: string | null; time_label: string | null }>;
  reply: string;
};

const stopRef = (index: number) => `s${index + 1}`;
const dayRef = (index: number) => `d${index + 1}`;

/** The asks so far as one request: the first, then each refinement. */
export function joinAsks(asks: readonly string[]): string {
  const clean = asks.map((ask) => ask.trim().slice(0, DAY_EDIT_MAX_ASK)).filter(Boolean);
  return clean
    .map((ask, i) => (i === 0 ? ask : `Then: ${ask}`))
    .join("\n")
    .slice(0, DAY_EDIT_MAX_REQUEST);
}

/** The day as the model reads it, ticked stops marked as the ones it may change. */
export function dayEditPrompt(
  request: string,
  dayStops: readonly DayEditStop[],
  selected: ReadonlySet<string>,
  days: readonly string[],
  day: string,
): string {
  const dayIndex = days.indexOf(day);
  const stopLines = dayStops.map(
    (stop, index) =>
      `  ${stopRef(index)} ${stop.time_label ? `${stop.time_label} ` : ""}${stop.title}${
        stop.kind ? ` [${stop.kind}]` : ""
      }${selected.has(stop.id) ? " (may change)" : " (keep as is)"}`,
  );
  const dayLines = days.map(
    (d, index) => `  ${dayRef(index)} ${d}${index === dayIndex ? " (this day)" : ""}`,
  );
  return [
    `You rework one day of a travel plan: ${dayIndex >= 0 ? `${dayRef(dayIndex)}, ` : ""}${day}.`,
    "Its stops, in order:",
    stopLines.join("\n"),
    "",
    "The trip's days:",
    dayLines.join("\n"),
    "",
    "The traveller asks:",
    request.trim().slice(0, DAY_EDIT_MAX_REQUEST),
    "",
    "Answer with the day's new timeline in `stops`, in the new order, each stop once:",
    "- stop: the stop's ref (s1, s2 …).",
    '- day: "same" to stay on this day, another day\'s ref (d1, d2 …) to move it there,',
    '  or "none" to take it off the plan for now.',
    '- time: "keep" to leave its time, "clear" to remove it, or a new time as HH:MM (24h).',
    'Only stops marked "may change" can move, be retimed or leave the day. Stops marked',
    '"keep as is" stay on this day with "keep", but may end up before or after the others.',
    "Never invent stops. Keep the times in order through the day. Change only what the",
    "request needs, and use sensible times: meals at meal times, places open when visited.",
    "reply: one or two short, friendly lines saying what you changed and why, in plain",
    "words, or why you could not. If the request is not about this day's plan, change",
    "nothing and say so in reply.",
  ].join("\n");
}

/**
 * The model's timeline as Béa's version of the day. A stop named twice keeps
 * its first place; a stop it left out stays after the stop it followed before.
 */
export function readDayEdit(
  raw: readonly RawDayEditStop[],
  dayStops: readonly DayEditStop[],
  selected: ReadonlySet<string>,
  days: readonly string[],
  day: string,
  reply = "",
): DayEditPlan {
  const stopFor = (ref: string) => {
    const m = /^s(\d+)$/i.exec(ref.trim());
    return m ? dayStops[Number(m[1]) - 1] : undefined;
  };
  const seen = new Set<string>();
  const order: DayEditPlan["order"] = [];
  const away: DayEditPlan["away"] = [];
  for (const line of raw.slice(0, DAY_EDIT_MAX_STOPS * 2)) {
    const stop = stopFor(line.stop);
    if (!stop || seen.has(stop.id)) continue;
    seen.add(stop.id);
    const free = selected.has(stop.id);
    let time = stop.time_label;
    if (free) {
      const timeText = line.time.trim().toLowerCase();
      if (timeText === "clear") time = null;
      else if (timeText && timeText !== "keep") time = normalizeClock(timeText) ?? stop.time_label;
    }
    const dayText = line.day.trim().toLowerCase();
    let target: string | null = day;
    if (free && (dayText === "none" || dayText === "unplanned")) target = null;
    else if (free) {
      const m = /^d(\d+)$/.exec(dayText);
      target = (m && days[Number(m[1]) - 1]) || day;
    }
    if (target === day) order.push({ id: stop.id, time_label: time });
    else away.push({ id: stop.id, day_date: target, time_label: time });
  }
  // Anything left out stays on the day, straight after the stop it followed.
  dayStops.forEach((stop, index) => {
    if (seen.has(stop.id)) return;
    let at = 0;
    for (let i = index - 1; i >= 0; i--) {
      const found = order.findIndex((row) => row.id === dayStops[i]!.id);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    order.splice(at, 0, { id: stop.id, time_label: stop.time_label });
  });
  return { order, away, reply: reply.trim().slice(0, 400) };
}

/** Whether Béa's version differs from the day as it is. */
export function dayEditChanges(plan: DayEditPlan, dayStops: readonly DayEditStop[]): boolean {
  if (plan.away.length > 0 || plan.order.length !== dayStops.length) return true;
  return plan.order.some(
    (row, i) =>
      row.id !== dayStops[i]?.id || (row.time_label ?? "") !== (dayStops[i]?.time_label ?? ""),
  );
}

export type DayEditRow<T extends DayEditStop> = {
  stop: T;
  time_label: string | null;
  /** Somewhere else in the order than among the stops that stayed. */
  moved: boolean;
  retimed: boolean;
};

/**
 * The "after" column: each stop that stays, marked when its place or time
 * changed. A stop is moved when it sits at another place among the stops
 * that stayed, so taking one stop off the day does not mark every other.
 */
export function dayEditRows<T extends DayEditStop>(
  plan: DayEditPlan,
  dayStops: readonly T[],
): DayEditRow<T>[] {
  const byId = new Map(dayStops.map((stop) => [stop.id, stop]));
  const staying = new Set(plan.order.map((row) => row.id));
  const before = dayStops.filter((stop) => staying.has(stop.id)).map((stop) => stop.id);
  return plan.order.flatMap((row, i) => {
    const stop = byId.get(row.id);
    if (!stop) return [];
    return [
      {
        stop,
        time_label: row.time_label,
        moved: before[i] !== row.id,
        retimed: (row.time_label ?? "") !== (stop.time_label ?? ""),
      },
    ];
  });
}

/**
 * Béa's version as moves, applied in order the way every other move is
 * saved (`rearrange`): first the stops that leave, then each stop that stays
 * put at its index in turn.
 */
export function dayEditMoves(
  plan: DayEditPlan,
  dayStops: readonly DayEditStop[],
  day: string,
): StopMove[] {
  const byId = new Map(dayStops.map((stop) => [stop.id, stop]));
  const timeFor = (id: string, time: string | null) =>
    (byId.get(id)?.time_label ?? null) === time ? {} : { time_label: time };
  return [
    ...plan.away
      .filter((row) => byId.has(row.id))
      .map((row): StopMove => ({
        id: row.id,
        day_date: row.day_date,
        at: "end",
        ...timeFor(row.id, row.time_label),
      })),
    ...plan.order
      .filter((row) => byId.has(row.id))
      .map((row, index): StopMove => ({
        id: row.id,
        day_date: day,
        at: { index },
        ...timeFor(row.id, row.time_label),
      })),
  ];
}
