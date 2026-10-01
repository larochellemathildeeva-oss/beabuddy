/**
 * "Change a day": the traveller picks one day, ticks the stops Béa may touch,
 * says what they want in their own words ("it's going to rain all
 * afternoon"), and sees the day as it is beside the day as Béa would have it
 * before anything is saved. Béa may reorder and retime the ticked stops, move
 * them to another day, set them aside, and suggest new places in their stead.
 *
 * The model sees the day's stops as s1, s2 … and the trip's days as d1, d2 …,
 * never the row ids, and answers with the day's new timeline in order. It is
 * checked here: a stop not on the day is dropped, a stop the traveller did not
 * tick keeps its day and its time (others may move around it), and a stop the
 * model forgot stays where it was. So a confused answer changes less, never
 * something the traveller did not offer up. A stop Béa replaces is set aside
 * under "No date", never deleted.
 */
import { normalizeClock } from "./import-stop.ts";
import { rearrange, stopsOfDay, type ScheduleUpdate } from "./stop-move.ts";
import { normaliseKind, type TimelineKind } from "./timeline-kind.ts";

/** One ask, as typed. */
export const DAY_EDIT_MAX_ASK = 400;
/** Every ask so far, joined, when the traveller refines Béa's version. */
export const DAY_EDIT_MAX_REQUEST = 1200;
export const DAY_EDIT_MAX_STOPS = 40;
export const DAY_EDIT_MAX_DAYS = 60;
/** New places Béa may suggest for one day. */
export const DAY_EDIT_MAX_NEW = 5;
/** Kinds a suggested place may be: a booking is never invented. */
const NEW_KINDS: readonly TimelineKind[] = ["meal", "sight", "activity", "walk"];

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
  /** "s3" for a stop on the day, "new" for a place Béa suggests. */
  stop: string;
  /** "same" to stay on the day, "d4" for another day, "none" to set it aside. */
  day: string;
  /** "keep", "clear", or "HH:MM". */
  time: string;
  /** A new place only: its name, kind and where it is. */
  title?: string | undefined;
  kind?: string | undefined;
  address?: string | undefined;
  /** Why this change: shown beside it. */
  why?: string | undefined;
};

/** A place Béa suggests, not yet on the trip. */
export type FreshStop = { title: string; kind: TimelineKind; address: string | null };

export type DayEditEntry = {
  /** The stop's row id, or "new:1", "new:2" … for a suggested place. */
  id: string;
  time_label: string | null;
  why?: string | undefined;
  fresh?: FreshStop | undefined;
};

/** Béa's version of the day, by row id, as the server sends it. */
export type DayEditPlan = {
  /** Every stop on the day in its new order, suggested places included. */
  order: DayEditEntry[];
  /** Stops that leave the day: to another day, or `null` to be set aside. */
  away: Array<{
    id: string;
    day_date: string | null;
    time_label: string | null;
    why?: string | undefined;
  }>;
  reply: string;
};

const stopRef = (index: number) => `s${index + 1}`;
const dayRef = (index: number) => `d${index + 1}`;
const clean = (text: string | undefined, max: number) =>
  (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The asks so far as one request: the first, then each refinement. */
export function joinAsks(asks: readonly string[]): string {
  const asked = asks.map((ask) => ask.trim().slice(0, DAY_EDIT_MAX_ASK)).filter(Boolean);
  return asked
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
  area?: string | null,
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
  const where = clean(area ?? "", 120);
  return [
    `You rework one day of a travel plan: ${dayIndex >= 0 ? `${dayRef(dayIndex)}, ` : ""}${day}${
      where ? `, in ${where}` : ""
    }.`,
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
    '- stop: the stop\'s ref (s1, s2 …), or "new" for a place you suggest adding.',
    '- day: "same" to stay on this day, another day\'s ref (d1, d2 …) to move it there,',
    '  or "none" to take it off the plan (for a stop you replace). A new place is always "same".',
    '- time: "keep" to leave its time, "clear" to remove it, or a new time as HH:MM (24h).',
    "  A new place always has a time.",
    "- title, kind, address: for a new place only. title: the real name of one specific place",
    `  that exists${where ? ` in or near ${where}` : ""} and is open then (never a type of place,`,
    `  never invented). kind: one of ${NEW_KINDS.join(", ")}. address: its street address or`,
    "  neighbourhood, if you know it. Leave all three empty for an existing stop.",
    "- why: a few words on why, for anything you changed or added; empty otherwise.",
    'Only stops marked "may change" can move, be retimed, be replaced or leave the day. Stops',
    'marked "keep as is" stay on this day with "keep", but may end up before or after others.',
    `Suggest new places (at most ${DAY_EDIT_MAX_NEW}) when the traveller asks for them, or when`,
    "the request needs them: rain coming means indoor places in place of outdoor ones; a",
    "stop to replace means something better suited, close to the stops around it.",
    "Keep the times in order through the day. Change only what the request needs, and use",
    "sensible times: meals at meal times, places open when visited.",
    "reply: one to three short, friendly lines of advice: what you changed and why, in",
    "plain words, or why you could not. If the request is not about this day's plan,",
    "change nothing and say so in reply.",
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
  const order: DayEditEntry[] = [];
  const away: DayEditPlan["away"] = [];
  let fresh = 0;
  for (const line of raw.slice(0, DAY_EDIT_MAX_STOPS * 2)) {
    const why = clean(line.why, 160) || undefined;
    const timeText = line.time.trim().toLowerCase();
    if (line.stop.trim().toLowerCase() === "new") {
      const title = clean(line.title, 120);
      const time = normalizeClock(timeText);
      if (!title || fresh >= DAY_EDIT_MAX_NEW) continue;
      if (order.some((row) => row.fresh?.title.toLowerCase() === title.toLowerCase())) continue;
      const kind = normaliseKind(line.kind);
      fresh += 1;
      order.push({
        id: `new:${fresh}`,
        time_label: time,
        ...(why ? { why } : {}),
        fresh: {
          title,
          kind: NEW_KINDS.includes(kind) ? kind : "activity",
          address: clean(line.address, 200) || null,
        },
      });
      continue;
    }
    const stop = stopFor(line.stop);
    if (!stop || seen.has(stop.id)) continue;
    seen.add(stop.id);
    const free = selected.has(stop.id);
    let time = stop.time_label;
    if (free) {
      if (timeText === "clear") time = null;
      else if (timeText && timeText !== "keep") time = normalizeClock(timeText) ?? stop.time_label;
    }
    const dayText = line.day.trim().toLowerCase();
    let target: string | null = day;
    if (free && ["none", "unplanned", "remove"].includes(dayText)) target = null;
    else if (free) {
      const m = /^d(\d+)$/.exec(dayText);
      target = (m && days[Number(m[1]) - 1]) || day;
    }
    const said = free ? why : undefined;
    if (target === day)
      order.push({ id: stop.id, time_label: time, ...(said ? { why: said } : {}) });
    else
      away.push({
        id: stop.id,
        day_date: target,
        time_label: time,
        ...(said ? { why: said } : {}),
      });
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
  return { order, away, reply: clean(reply, 500) };
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
  id: string;
  title: string;
  time_label: string | null;
  /** The stop as it is now; absent for a suggested place. */
  stop?: T | undefined;
  fresh?: FreshStop | undefined;
  why?: string | undefined;
  /** Somewhere else in the order than among the stops that stayed. */
  moved: boolean;
  retimed: boolean;
};

/**
 * The "after" column: each stop on the day, marked when its place or time
 * changed, and each suggested place. A stop is moved when it sits at another
 * place among the stops that stayed, so taking one stop off the day, or
 * adding a new one, does not mark every other.
 */
export function dayEditRows<T extends DayEditStop>(
  plan: DayEditPlan,
  dayStops: readonly T[],
): DayEditRow<T>[] {
  const byId = new Map(dayStops.map((stop) => [stop.id, stop]));
  const kept = plan.order.filter((row) => byId.has(row.id)).map((row) => row.id);
  const before = dayStops.filter((stop) => kept.includes(stop.id)).map((stop) => stop.id);
  return plan.order.flatMap((row): DayEditRow<T>[] => {
    if (row.fresh) {
      return [
        {
          id: row.id,
          title: row.fresh.title,
          time_label: row.time_label,
          fresh: row.fresh,
          why: row.why,
          moved: false,
          retimed: false,
        },
      ];
    }
    const stop = byId.get(row.id);
    if (!stop) return [];
    return [
      {
        id: row.id,
        title: stop.title,
        time_label: row.time_label,
        stop,
        why: row.why,
        moved: before[kept.indexOf(row.id)] !== row.id,
        retimed: (row.time_label ?? "") !== (stop.time_label ?? ""),
      },
    ];
  });
}

/**
 * What to write for Béa's version: the rows whose day, time or place in the
 * list change, and where each suggested place goes in.
 *
 * Stops leaving the day go to the end of their new day the way any move does
 * (`rearrange`). The day itself is numbered afresh from its lowest position,
 * suggested places included, so they land exactly where Béa put them rather
 * than wherever their time would sort.
 */
export function dayEditSchedule<T extends DayEditStop>(
  plan: DayEditPlan,
  stops: readonly T[],
  day: string,
): {
  updates: ScheduleUpdate[];
  added: Array<
    FreshStop & { key: string; time_label: string | null; why?: string; position: number }
  >;
} {
  const dayStops = stopsOfDay(stops, day);
  const byId = new Map(dayStops.map((stop) => [stop.id, stop]));
  const leaving = plan.away
    .filter((row) => byId.has(row.id))
    .map((row) => ({
      id: row.id,
      day_date: row.day_date,
      at: "end" as const,
      time_label: row.time_label,
    }));
  // The day they leave is renumbered below, so only the days they reach are kept.
  const updates = rearrange(stops, leaving).filter((u) => u.day_date !== day);
  const added: ReturnType<typeof dayEditSchedule>["added"] = [];
  const start = dayStops.length ? Math.min(...dayStops.map((stop) => stop.position)) : 0;
  let index = 0;
  for (const row of plan.order) {
    if (row.fresh) {
      added.push({
        ...row.fresh,
        key: row.id,
        time_label: row.time_label,
        ...(row.why ? { why: row.why } : {}),
        position: start + index++,
      });
      continue;
    }
    const stop = byId.get(row.id);
    if (!stop) continue;
    const position = start + index++;
    if (stop.position !== position || (stop.time_label ?? null) !== row.time_label) {
      updates.push({ id: stop.id, day_date: day, time_label: row.time_label, position });
    }
  }
  return { updates, added };
}
