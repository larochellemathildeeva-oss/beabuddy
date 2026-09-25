import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  arrivalWrites,
  clockMinutes,
  isDone,
  midpointTime,
  toggleDoneWrite,
  companionState,
  companionStops,
  leaveBy,
  leavingWrite,
  legBetween,
  liveLegKey,
  needsLiveLeg,
  partOfDay,
  stopStatuses,
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

test("stay line counts time there, and never against a planned stay", () => {
  const now = new Date(T("10:40"));
  assert.equal(stayLine({ arrived_at: null }, now), null);
  assert.equal(stayLine({ arrived_at: T("10:00") }, now), "Here 40 min");
  assert.equal(stayLine({ arrived_at: T("09:00") }, now), "Here 1 h 40 min");
});

test("a journey written as its own row is not a Companion stop", () => {
  const rows = [
    { id: "a", title: "Travel to Peace Memorial Park", kind: "transport" },
    { id: "b", title: "Peace Memorial Museum", kind: "activity" },
    { id: "c", title: "Motoyasubashi Pier ferry", kind: "transport" },
  ];
  assert.deepEqual(
    companionStops(rows).map((r) => r.id),
    ["b", "c"],
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

test("Now routes a journey itself only between two placed stops with nothing saved", () => {
  const here = { lat: 45.5, lon: -73.6 };
  const there = { lat: 45.51, lon: -73.58 };
  assert.equal(needsLiveLeg(null, here, there), true);
  assert.equal(needsLiveLeg({ duration: 60 }, here, there), false, "a saved leg wins");
  assert.equal(needsLiveLeg(null, here, { lat: null, lon: null }), false, "unplaced end");
  assert.equal(needsLiveLeg(null, { lat: 0, lon: 0 }, there), false, "null island");
  assert.equal(needsLiveLeg(null, null, there), false, "nowhere to start from");
  assert.equal(
    needsLiveLeg(null, here, { lat: null, lon: null }, true),
    true,
    "unplaced, but the trip's area lets the router look it up",
  );
  assert.equal(needsLiveLeg(null, null, there, true), false);
});

test("a live leg is keyed by both stops and where they are", () => {
  const a = { id: "a", lat: 45.5, lon: -73.6 };
  const b = { id: "b", lat: 45.51, lon: -73.58 };
  assert.equal(liveLegKey(a, b), liveLegKey({ ...a }, { ...b }));
  assert.notEqual(
    liveLegKey(a, b),
    liveLegKey(a, { ...b, lat: 45.52 }),
    "a moved stop routes again",
  );
  assert.notEqual(liveLegKey(a, b), liveLegKey(b, a), "direction matters");
});

test("statuses follow the same progress as the Now card", () => {
  const stops = [
    stop("a", { arrived_at: T("09:00"), left_at: T("09:40") }),
    stop("b"),
    stop("c", { arrived_at: T("10:30") }),
    stop("d"),
    stop("e"),
  ];
  assert.deepEqual(stopStatuses(stops), ["done", "skipped", "here", "next", "upcoming"]);
  assert.deepEqual(stopStatuses([stop("a"), stop("b")]), ["next", "upcoming"]);
});

test("parts of the day come from clock times only", () => {
  assert.equal(partOfDay("08:30"), "morning");
  assert.equal(partOfDay("11:59"), "morning");
  assert.equal(partOfDay("12:00"), "afternoon");
  assert.equal(partOfDay("4:30 pm"), "afternoon");
  assert.equal(partOfDay("17:00"), "evening");
  assert.equal(partOfDay("Lunch"), null);
  assert.equal(partOfDay(null), null);
});

test("marking done records arrival and departure, and undo restores", () => {
  const now = new Date(T("12:00"));
  const fresh = toggleDoneWrite(stop("a"), now);
  assert.deepEqual(fresh.patch, { arrived_at: T("12:00"), left_at: T("12:00") });
  assert.deepEqual(fresh.undo, { arrived_at: null, left_at: null });

  const there = toggleDoneWrite(stop("a", { arrived_at: T("11:00") }), now);
  assert.deepEqual(
    there.patch,
    { arrived_at: T("11:00"), left_at: T("12:00") },
    "keeps the arrival",
  );

  const done = toggleDoneWrite(stop("a", { arrived_at: T("11:00"), left_at: T("11:30") }), now);
  assert.deepEqual(done.patch, { arrived_at: null, left_at: null }, "done again means not done");
  assert.deepEqual(done.undo, { arrived_at: T("11:00"), left_at: T("11:30") });
  assert.equal(isDone(stop("a", { arrived_at: T("11:00"), left_at: T("11:30") })), true);
});

test("halfway time needs two clock times, rounded to five minutes", () => {
  assert.equal(midpointTime("09:00", "11:00"), "10:00");
  assert.equal(midpointTime("09:00", "09:50"), "09:25");
  assert.equal(midpointTime("Lunch", "15:00"), "");
  assert.equal(midpointTime("15:00", "09:00"), "", "out of order");
  assert.equal(midpointTime(null, "09:00"), "");
});
