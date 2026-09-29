/**
 * One tap to make a day easier, and what a rearrangement changed.
 *
 * Optimize already knows how to cluster stops, start later, move things
 * indoors and even out a day; it just asks for a goal to be picked, a note
 * written and a button pressed, which is a lot to ask of someone tired on
 * the evening before. Each preset here is that request made in one tap, for
 * one day, with bookings kept where they are (the optimiser never moves a
 * flight, hotel or reservation, and the note says so for booked tables and
 * tickets too).
 *
 * `optimizeDelta` is the other half: after Optimize, how much actually
 * moved, what stayed, whether anything was dropped, and the travel time
 * saved — so the change can be judged at a glance before it is used.
 *
 * Pure, so both are tested.
 */

import type { OptimizeGoalId } from "./itinerary.functions.ts";

export type EasePreset = {
  id: "walk-less" | "later" | "indoors" | "breathe";
  label: string;
  goals: OptimizeGoalId[];
  note: string;
};

const KEEP_BOOKED = "Keep every booked stop on its time.";

export const EASE_PRESETS: readonly EasePreset[] = [
  {
    id: "walk-less",
    label: "Less walking",
    goals: ["closest"],
    note: `Less walking: keep stops that are near each other together. ${KEEP_BOOKED}`,
  },
  {
    id: "later",
    label: "Later start",
    goals: ["easy-morning"],
    note: `A later, slower start to the day. ${KEEP_BOOKED}`,
  },
  {
    id: "indoors",
    label: "Move indoors",
    goals: ["rainy"],
    note: `Rain is likely: put the indoor stops when it rains and the outdoor ones when it is dry. ${KEEP_BOOKED}`,
  },
  {
    id: "breathe",
    label: "More free time",
    goals: ["even"],
    note: `More breathing room between stops, and a longer stay where it matters. ${KEEP_BOOKED}`,
  },
];

/** The rain preset, with the spell the forecast gives, so the plan can fit around it. */
export function rainPreset(from: string, until: string | null): EasePreset {
  const base = EASE_PRESETS.find((p) => p.id === "indoors")!;
  const when = until ? `from ${from} to ${until}` : `from ${from}`;
  return {
    ...base,
    note: `Rain is likely ${when}: put the indoor stops then and the outdoor ones while it is dry. ${KEEP_BOOKED}`,
  };
}

type Placed = { id: string; day_date: string | null; time_label: string | null };

export type OptimizeDelta = {
  moved: number;
  stayed: number;
  /** Stops the answer left out: they stay as they are, and the line says so. */
  untouched: number;
  /** Seconds less (or, negative, more) getting between stops. */
  travelSavedSec: number | null;
};

/** How much a rearrangement moved, against the stops as they are. */
export function optimizeDelta(
  original: readonly Placed[],
  proposed: readonly Placed[],
  travel?: { beforeSec: number; afterSec: number } | null,
): OptimizeDelta {
  const byId = new Map(original.map((o) => [o.id, o]));
  let moved = 0;
  let stayed = 0;
  const seen = new Set<string>();
  for (const row of proposed) {
    const was = byId.get(row.id);
    if (!was || seen.has(row.id)) continue;
    seen.add(row.id);
    if (
      (was.day_date ?? "") === (row.day_date ?? "") &&
      (was.time_label ?? "") === (row.time_label ?? "")
    )
      stayed++;
    else moved++;
  }
  return {
    moved,
    stayed,
    untouched: original.filter((o) => !seen.has(o.id)).length,
    travelSavedSec: travel ? travel.beforeSec - travel.afterSec : null,
  };
}

function minutes(sec: number): string {
  const m = Math.round(Math.abs(sec) / 60);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
}

/** "3 stops moved · 5 unchanged · nothing removed · about 38 min less getting around" */
export function deltaLine(delta: OptimizeDelta): string {
  const parts = [
    delta.moved === 0
      ? "Nothing moved"
      : `${delta.moved} ${delta.moved === 1 ? "stop" : "stops"} moved`,
  ];
  if (delta.stayed) parts.push(`${delta.stayed} unchanged`);
  parts.push(
    delta.untouched
      ? `${delta.untouched} left as ${delta.untouched === 1 ? "it was" : "they were"}`
      : "nothing removed",
  );
  const saved = delta.travelSavedSec;
  if (saved != null && Math.abs(saved) >= 60) {
    parts.push(`about ${minutes(saved)} ${saved > 0 ? "less" : "more"} getting around`);
  }
  return parts.join(" · ");
}
