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
import { rearrange, stopsOfDay, type StopMove } from "./stop-move.ts";

export const PLAN_EDIT_MAX_REQUEST = 300;
export const PLAN_EDIT_MAX_STOPS = 150;
export const PLAN_EDIT_MAX_DAYS = 60;
/** As many as there are stops, so swapping two full days is never cut short. */
export const PLAN_EDIT_MAX_MOVES = PLAN_EDIT_MAX_STOPS;
/** Earlier requests in one unsaved round of changes that Béa is reminded of. */
export const PLAN_EDIT_MAX_EARLIER = 5;

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
  /** Requests already answered in this round, not saved yet but in `stops`. */
  earlier: readonly string[] = [],
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
    ...(earlier.length
      ? [
          "Earlier the traveller asked:",
          ...earlier
            .slice(-PLAN_EDIT_MAX_EARLIER)
            .map((text) => `- "${text.trim().slice(0, PLAN_EDIT_MAX_REQUEST)}"`),
          "Those changes are already in the plan above. Keep them unless the new request undoes them.",
          "",
          `The traveller now adds: "${request.trim().slice(0, PLAN_EDIT_MAX_REQUEST)}"`,
        ]
      : [`The traveller asks: "${request.trim().slice(0, PLAN_EDIT_MAX_REQUEST)}"`]),
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

type PlannedStop = PlanEditStop & { position: number };

/**
 * Moves sent back from the phone (the unsaved answer to an earlier request)
 * checked against the trip as the server read it: a move naming a stop, day
 * or anchor not on the trip, or a time that is not a clock, is dropped.
 */
export function readPendingMoves(
  moves: readonly (Omit<StopMove, "time_label"> & { time_label?: string | null | undefined })[],
  stops: readonly PlanEditStop[],
  days: readonly string[],
): StopMove[] {
  const ids = new Set(stops.map((stop) => stop.id));
  const known = new Set(days);
  // Each stop's day as the moves accepted so far leave it: an anchor must be
  // on the day its stop goes to, or the stop would quietly land at the end.
  const dayOf = new Map(stops.map((stop) => [stop.id, stop.day_date]));
  const out: StopMove[] = [];
  for (const move of moves.slice(0, PLAN_EDIT_MAX_MOVES)) {
    if (!ids.has(move.id)) continue;
    if (move.day_date !== null && !known.has(move.day_date)) continue;
    const at = move.at;
    if (
      typeof at === "object" &&
      "after" in at &&
      (!ids.has(at.after) || at.after === move.id || dayOf.get(at.after) !== move.day_date)
    ) {
      continue;
    }
    if (typeof at === "object" && "index" in at && !Number.isFinite(at.index)) continue;
    let time: string | null | undefined = move.time_label;
    if (typeof time === "string") {
      time = normalizeClock(time) ?? undefined;
      if (time === undefined) continue;
    }
    dayOf.set(move.id, move.day_date);
    out.push({
      id: move.id,
      day_date: move.day_date,
      at,
      ...(time !== undefined ? { time_label: time } : {}),
    });
  }
  return out;
}

/** The stops as they stand once `moves` are applied, in plan order. */
export function planAfter<T extends PlannedStop>(
  stops: readonly T[],
  moves: readonly StopMove[],
): T[] {
  const updates = new Map(rearrange(stops, moves).map((u) => [u.id, u]));
  return stops
    .map((stop, index) => ({ stop: { ...stop, ...updates.get(stop.id) }, index }))
    .sort((a, b) => {
      const da = a.stop.day_date;
      const db = b.stop.day_date;
      if (da !== db) {
        if (da === null) return 1;
        if (db === null) return -1;
        return da < db ? -1 : 1;
      }
      return a.stop.position - b.stop.position || a.index - b.index;
    })
    .map(({ stop }) => stop);
}

/**
 * Several rounds of moves as one list that lands every stop in the same
 * place: each stop moved at all, once, straight after the stop before it
 * where it ends up, in plan order. Saved with one Apply and one Undo.
 */
export function combineMoves<T extends PlannedStop>(
  stops: readonly T[],
  moves: readonly StopMove[],
): StopMove[] {
  const moved = new Set(moves.map((move) => move.id));
  if (moved.size === 0) return [];
  const savedTime = new Map(stops.map((stop) => [stop.id, stop.time_label]));
  const after = planAfter(stops, moves);
  const days = [...new Set(after.map((stop) => stop.day_date))];
  const out: StopMove[] = [];
  for (const day of days) {
    const list = stopsOfDay(after, day);
    list.forEach((stop, index) => {
      if (!moved.has(stop.id)) return;
      out.push({
        id: stop.id,
        day_date: day,
        at: index === 0 ? "start" : { after: list[index - 1]!.id },
        // Only a time Béa changed: a saved one (free text like "after
        // check-in" included) is left as it is.
        ...(stop.time_label !== savedTime.get(stop.id) ? { time_label: stop.time_label } : {}),
      });
    });
  }
  return out;
}

/** A day a set of moves changes: how many stops leave it and how many arrive. */
export type TouchedDay = { day: string; lost: number; gained: number };

/**
 * The days a set of moves changes, for "What about day 3?", in date order.
 * A day left empty is not one (nothing is left to re-plan), nor is a move
 * within one day, nor the undated list.
 */
export function daysTouched(
  stops: readonly PlanEditStop[],
  moves: readonly StopMove[],
): TouchedDay[] {
  const dayOf = new Map(stops.map((stop) => [stop.id, stop.day_date]));
  const finalDay = new Map(dayOf);
  for (const move of moves) if (dayOf.has(move.id)) finalDay.set(move.id, move.day_date);
  const touched = new Map<string, TouchedDay>();
  const entry = (day: string) => {
    let found = touched.get(day);
    if (!found) touched.set(day, (found = { day, lost: 0, gained: 0 }));
    return found;
  };
  for (const [id, from] of dayOf) {
    const to = finalDay.get(id) ?? null;
    if (from === to) continue;
    if (from) entry(from).lost++;
    if (to) entry(to).gained++;
  }
  const holds = new Set(finalDay.values());
  return [...touched.values()]
    .filter((t) => holds.has(t.day))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** Something to do about a changed day once the moves are applied. */
export type AfterMoveChoice = {
  id: string;
  day: string;
  label: string;
  /** What Rework asks Béa for that day, written but not sent. */
  ask: string;
};

const KEEP_BOOKED = "Keep every booked stop on its time.";

const listNames = (names: readonly string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * "What about day 3?": for each day the moves change, what Béa can do with
 * it next. A day stops left can have the gap filled with something new, or
 * the rest re-planned; a day stops arrived on can have them fitted in. Each
 * opens Rework for that day with the ask written, so nothing changes until
 * the traveller sees Béa's version and applies it.
 */
export function afterMoveChoices(
  stops: readonly PlanEditStop[],
  moves: readonly StopMove[],
  dayName: (day: string) => string,
): AfterMoveChoice[] {
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  const finalDay = new Map(stops.map((stop) => [stop.id, stop.day_date]));
  for (const move of moves) if (byId.has(move.id)) finalDay.set(move.id, move.day_date);
  const leaving = (day: string) =>
    stops.filter((s) => s.day_date === day && finalDay.get(s.id) !== day);
  const arriving = (day: string) =>
    stops.filter((s) => s.day_date !== day && finalDay.get(s.id) === day);
  const names = (list: readonly PlanEditStop[]) => listNames(list.map((s) => s.title.trim()));

  const choices: AfterMoveChoice[] = [];
  for (const { day, lost, gained } of daysTouched(stops, moves)) {
    const name = dayName(day);
    const out = leaving(day);
    const into = arriving(day);
    const moved =
      lost > 0
        ? `${names(out)} moved off this day${gained > 0 ? `, and ${names(into)} moved here` : ""}.`
        : `${names(into)} moved here from another day.`;
    if (lost > 0) {
      choices.push({
        id: `fill:${day}`,
        day,
        label: `Fill the gap on ${name}`,
        ask: `${moved} Suggest something nearby for the time they left, and keep the other stops. ${KEEP_BOOKED}`,
      });
    }
    choices.push({
      id: `replan:${day}`,
      day,
      label: lost > 0 && gained === 0 ? `Re-plan the rest of ${name}` : `Fit them into ${name}`,
      ask: `${moved} Re-order and re-time the day so it flows. ${KEEP_BOOKED}`,
    });
  }
  return choices;
}
