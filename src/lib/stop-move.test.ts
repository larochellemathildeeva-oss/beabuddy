import { strict as assert } from "node:assert";
import { test } from "node:test";
import { clockMinutes } from "./companion.ts";
import {
  placeOf,
  rearrange,
  stepMove,
  stopsOfDay,
  timeFit,
  tripDays,
  type MovableStop,
} from "./stop-move.ts";

const stop = (
  id: string,
  day_date: string | null,
  position: number,
  time_label: string | null = null,
): MovableStop => ({ id, day_date, position, time_label });

const D1 = "2026-10-01";
const D2 = "2026-10-02";
const D3 = "2026-10-03";

const plan = [
  stop("a", D1, 0, "09:00"),
  stop("b", D1, 1, "11:00"),
  stop("c", D1, 2, "14:00"),
  stop("d", D2, 3, "10:00"),
  stop("e", D2, 4),
];

/** The plan after the updates, as each day's ids in order. */
function after(stops: readonly MovableStop[], updates: ReturnType<typeof rearrange>) {
  const next = stops.map((s) => ({ ...s, ...updates.find((u) => u.id === s.id) }));
  const days = [...new Set(next.map((s) => s.day_date ?? ""))].sort();
  return Object.fromEntries(
    days.map((d) => [d, stopsOfDay(next, d || null).map((s) => s.id)]),
  ) as Record<string, string[]>;
}

test("a swap inside a day writes two rows", () => {
  const updates = rearrange(plan, [{ id: "b", day_date: D1, at: { index: 0 } }]);
  assert.equal(updates.length, 2);
  assert.deepEqual(after(plan, updates)[D1], ["b", "a", "c"]);
});

test("moving to another day leaves the day it left alone", () => {
  const updates = rearrange(plan, [{ id: "a", day_date: D2, at: "start" }]);
  const days = after(plan, updates);
  assert.deepEqual(days[D1], ["b", "c"]);
  assert.deepEqual(days[D2], ["a", "d", "e"]);
  assert.ok(updates.every((u) => u.day_date === D2));
});

test("after a named stop, and to the end", () => {
  const days = after(
    plan,
    rearrange(plan, [
      { id: "c", day_date: D2, at: { after: "d" } },
      { id: "a", day_date: D1, at: "end" },
    ]),
  );
  assert.deepEqual(days[D1], ["b", "a"]);
  assert.deepEqual(days[D2], ["d", "c", "e"]);
});

test("an empty day takes the stop", () => {
  const days = after(plan, rearrange(plan, [{ id: "e", day_date: D3, at: "start" }]));
  assert.deepEqual(days[D3], ["e"]);
  assert.deepEqual(days[D2], ["d"]);
});

test("a new time rides with the move, and a no-op writes nothing", () => {
  const updates = rearrange(plan, [{ id: "c", day_date: D1, at: "end", time_label: "16:00" }]);
  assert.deepEqual(updates, [{ id: "c", day_date: D1, time_label: "16:00", position: 2 }]);
  assert.deepEqual(rearrange(plan, [{ id: "c", day_date: D1, at: "end" }]), []);
});

test("a day whose rows share a position is numbered afresh", () => {
  const shared = [stop("x", D1, 5), stop("y", D1, 5), stop("z", D1, 6)];
  const days = after(shared, rearrange(shared, [{ id: "z", day_date: D1, at: "start" }]));
  assert.deepEqual(days[D1], ["z", "x", "y"]);
});

test("placeOf puts a stop back where it was", () => {
  const back = placeOf(plan, "b")!;
  const moved = rearrange(plan, [{ id: "b", day_date: D2, at: "end" }]);
  const next = plan.map((s) => ({ ...s, ...moved.find((u) => u.id === s.id) }));
  assert.deepEqual(after(next, rearrange(next, [back]))[D1], ["a", "b", "c"]);
});

test("Up and Down step inside a day, then over its edge", () => {
  const days = [D1, D2, D3];
  assert.deepEqual(stepMove(plan, "b", -1, days), { id: "b", day_date: D1, at: { index: 0 } });
  assert.deepEqual(stepMove(plan, "c", 1, days), { id: "c", day_date: D2, at: "start" });
  assert.deepEqual(stepMove(plan, "d", -1, days), { id: "d", day_date: D1, at: "end" });
  assert.equal(stepMove(plan, "a", -1, days), null);
  // An empty day after the last is still a day to step onto.
  assert.deepEqual(stepMove(plan, "e", 1, days), { id: "e", day_date: D3, at: "start" });
});

test("undated stops only step among themselves", () => {
  const loose = [stop("u", null, 0), stop("v", null, 1)];
  assert.deepEqual(stepMove(loose, "u", 1, [D1]), { id: "u", day_date: null, at: { index: 1 } });
  assert.equal(stepMove(loose, "v", 1, [D1]), null);
});

test("tripDays covers the dates and any stray stop day", () => {
  assert.deepEqual(tripDays(D1, D3, [{ day_date: "2026-10-09" }, { day_date: null }]), [
    D1,
    D2,
    D3,
    "2026-10-09",
  ]);
  assert.deepEqual(tripDays(null, null, [{ day_date: D2 }]), [D2]);
});

test("a time that no longer fits gets a suggestion between its neighbours", () => {
  // c (14:00) moved before b (11:00): halfway between 9:00 and 11:00.
  assert.deepEqual(timeFit(plan, { id: "c", day_date: D1, at: { index: 1 } }, clockMinutes), {
    time: "14:00",
    suggestion: "10:00",
  });
  // a (9:00) to the end of day 2: an hour after 10:00.
  assert.deepEqual(timeFit(plan, { id: "a", day_date: D2, at: "end" }, clockMinutes), {
    time: "09:00",
    suggestion: "11:00",
  });
  // Still in order, or no time at all: nothing to say.
  assert.equal(timeFit(plan, { id: "a", day_date: D2, at: "start" }, clockMinutes), null);
  assert.equal(timeFit(plan, { id: "e", day_date: D1, at: "start" }, clockMinutes), null);
});

test("no suggestion when nothing after the stop before still fits the day", () => {
  const late = [stop("x", D1, 0, "23:50"), stop("y", D1, 1, "08:00")];
  assert.deepEqual(timeFit(late, { id: "y", day_date: D1, at: "end" }, clockMinutes), {
    time: "08:00",
    suggestion: null,
  });
});
