import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  arrivalWrites,
  clockMinutes,
  companionState,
  companionStops,
  leaveBy,
  leavingWrite,
  legBetween,
  stayLine,
  undoArrivalWrite,
  type CompanionStop,
} from "./companion.ts";

const T = (hhmm: string) => `2026-09-24T${hhmm}:00.000Z`;
const stop = (id: string, extra: Partial<CompanionStop> = {}): CompanionStop => ({
  id,
  title: `Stop ${id}`,
  ...extra,
});

test("walk and drive rows are the journey, not stops", () => {
  const items = [
    stop("a"),
    { id: "w", title: "Walk to Musée" },
    stop("b"),
    { id: "x", title: "  " },
  ];
  assert.deepEqual(
    companionStops(items).map((s) => s.id),
    ["a", "b"],
  );
});

test("nothing marked: not started, and the first stop is next", () => {
  const s = companionState([stop("a"), stop("b")]);
  assert.equal(s.phase, "not-started");
  assert.equal(s.next?.id, "a");
  assert.equal(s.reached, 0);
  assert.equal(s.total, 2);
});

test("arrived and not left: you are there", () => {
  const s = companionState([stop("a", { arrived_at: T("09:00") }), stop("b")]);
  assert.equal(s.phase, "at");
  assert.equal(s.current?.id, "a");
  assert.equal(s.next?.id, "b");
});

test("left and not yet arrived: between, with where you came from", () => {
  const s = companionState([stop("a", { arrived_at: T("09:00"), left_at: T("10:00") }), stop("b")]);
  assert.equal(s.phase, "between");
  assert.equal(s.previous?.id, "a");
  assert.equal(s.next?.id, "b");
});

test("a skipped stop is behind you, not next", () => {
  const s = companionState([
    stop("a", { arrived_at: T("09:00"), left_at: T("10:00") }),
    stop("b"),
    stop("c", { arrived_at: T("10:30") }),
    stop("d"),
  ]);
  assert.equal(s.current?.id, "c");
  assert.equal(s.next?.id, "d");
});

test("two open arrivals: the latest is where you are", () => {
  const s = companionState([
    stop("a", { arrived_at: T("09:00") }),
    stop("b", { arrived_at: T("09:30") }),
  ]);
  assert.equal(s.current?.id, "b");
});

test("reached the last stop and left it: done", () => {
  const s = companionState([
    stop("a", { arrived_at: T("09:00"), left_at: T("10:00") }),
    stop("b", { arrived_at: T("10:20"), left_at: T("11:00") }),
  ]);
  assert.equal(s.phase, "done");
  assert.equal(s.next, null);
});

test("at the last stop is still 'at', with nothing next", () => {
  const s = companionState([
    stop("a", { arrived_at: T("09:00"), left_at: T("09:30") }),
    stop("b", { arrived_at: T("10:00") }),
  ]);
  assert.equal(s.phase, "at");
  assert.equal(s.next, null);
});

test("clock times parse; words do not", () => {
  assert.equal(clockMinutes("14:05"), 14 * 60 + 5);
  assert.equal(clockMinutes("2:30 pm"), 14 * 60 + 30);
  assert.equal(clockMinutes("9am"), 9 * 60);
  assert.equal(clockMinutes("Morning"), null);
  assert.equal(clockMinutes(""), null);
  assert.equal(clockMinutes(null), null);
});

const walk = { mode: "walking" as const, duration: 25 * 60 + 10 };

test("leave by is the next time minus the routed journey, rounded early", () => {
  // 25 min 10 s rounds up to 26 min of travel, so leave at 13:34 for 14:00.
  assert.deepEqual(leaveBy("14:00", walk), {
    kind: "time",
    at: "13:34",
    travelMinutes: 26,
    mode: "walking",
  });
});

test("leave by wraps past midnight", () => {
  assert.equal((leaveBy("00:10", walk) as { at: string }).at, "23:44");
});

test("no number over a guess", () => {
  assert.equal(leaveBy("14:00", { ...walk, capped: true }), null, "capped leg");
  assert.equal(leaveBy("14:00", { ...walk, unknownSpot: true }), null, "unplaced end");
  assert.equal(leaveBy("14:00", { ...walk, duration: 0 }), null, "no duration");
  assert.equal(leaveBy("Afternoon", walk), null, "no clock time");
  assert.equal(leaveBy("14:00", null), null, "no leg");
});

test("same spot says so instead of a time", () => {
  assert.deepEqual(leaveBy("14:00", { ...walk, sameSpot: true }), { kind: "same-spot" });
});

test("a leg exists only between consecutive stops", () => {
  const trip = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const legs = ["a→b", "b→c"];
  assert.equal(legBetween(trip, legs, "a", "b"), "a→b");
  assert.equal(legBetween(trip, legs, "b", "c"), "b→c");
  assert.equal(legBetween(trip, legs, "a", "c"), null, "skipped a stop");
  assert.equal(legBetween(trip, legs, "c", "a"), null, "backwards");
  assert.equal(legBetween(trip, null, "a", "b"), null, "nothing saved");
});

test("stay line counts time there, against the plan only when there is one", () => {
  const now = new Date(T("10:40"));
  assert.equal(stayLine({ arrived_at: null }, now), null);
  assert.equal(stayLine({ arrived_at: T("10:00") }, now), "Here 40 min");
  assert.equal(
    stayLine({ arrived_at: T("10:00"), planned_stay_minutes: 90 }, now),
    "Here 40 min · about 50 min of 90 left",
  );
  assert.equal(
    stayLine({ arrived_at: T("09:00"), planned_stay_minutes: 60 }, now),
    "Here 1 h 40 min · 40 min past the 60 planned",
  );
});

test("arriving closes wherever you were", () => {
  const now = new Date(T("11:00"));
  const writes = arrivalWrites([stop("a", { arrived_at: T("10:00") }), stop("b")], "b", now);
  assert.deepEqual(writes, [
    { id: "a", patch: { left_at: T("11:00") } },
    { id: "b", patch: { arrived_at: T("11:00"), left_at: null } },
  ]);
});

test("a departure is never before its arrival, whatever this clock says", () => {
  // Another phone marked the arrival slightly in this phone's future.
  const now = new Date(T("10:00"));
  assert.deepEqual(leavingWrite(stop("a", { arrived_at: T("10:02") }), now), {
    id: "a",
    patch: { left_at: T("10:02") },
  });
});

test("undoing an arrival clears the departure with it", () => {
  assert.deepEqual(undoArrivalWrite(stop("a")).patch, { arrived_at: null, left_at: null });
});
