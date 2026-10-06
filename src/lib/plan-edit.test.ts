import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  afterMoveChoices,
  combineMoves,
  daysTouched,
  planAfter,
  planEditPrompt,
  readPendingMoves,
  readPlanEdit,
  type PlanEditStop,
} from "./plan-edit.ts";
import { rearrange, type StopMove } from "./stop-move.ts";

const days = ["2026-10-01", "2026-10-02"];
const stops: PlanEditStop[] = [
  { id: "id-a", title: "Louvre", day_date: days[0]!, time_label: "09:00", kind: "sight" },
  { id: "id-b", title: "Café Kitsuné", day_date: days[0]!, time_label: null },
  { id: "id-c", title: "Orsay", day_date: days[1]!, time_label: "14:00" },
];

test("the prompt lists stops by ref under their days, and never the row ids", () => {
  const text = planEditPrompt("Louvre on day 2", stops, days);
  assert.match(
    text,
    /d1 \(day 1, 2026-10-01\):\n {2}s1 09:00 Louvre \[sight\]\n {2}s2 Café Kitsuné/,
  );
  assert.match(text, /d2 \(day 2, 2026-10-02\):\n {2}s3 14:00 Orsay/);
  assert.doesNotMatch(text, /id-a/);
});

test("refs become ids, days and anchors", () => {
  const moves = readPlanEdit(
    [
      { stop: "s1", day: "d2", after: "s3", time: "16:00" },
      { stop: "s2", day: "same", after: "start", time: "keep" },
    ],
    stops,
    days,
  );
  assert.deepEqual(moves, [
    { id: "id-a", day_date: days[1], at: { after: "id-c" }, time_label: "16:00" },
    { id: "id-b", day_date: days[0], at: "start" },
  ]);
});

test("unknown stops, days, anchors and times are dropped", () => {
  const moves = readPlanEdit(
    [
      { stop: "s9", day: "d1", after: "end", time: "keep" },
      { stop: "s1", day: "d7", after: "end", time: "keep" },
      { stop: "s1", day: "d1", after: "s1", time: "keep" },
      { stop: "s3", day: "d1", after: "end", time: "teatime" },
    ],
    stops,
    days,
  );
  assert.deepEqual(moves, []);
});

test("clear removes a time, and a stop named twice keeps its last move", () => {
  const moves = readPlanEdit(
    [
      { stop: "s3", day: "d1", after: "end", time: "keep" },
      { stop: "s3", day: "d1", after: "start", time: "clear" },
    ],
    stops,
    days,
  );
  assert.deepEqual(moves, [{ id: "id-c", day_date: days[0], at: "start", time_label: null }]);
});

// Day 2 and day 5 of a trip, as in the bug report: two stops moved to day 5,
// then a third asked for before Apply.
const five = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
const planned = [
  { id: "a", title: "Market", day_date: five[1]!, time_label: null, position: 1 },
  { id: "b", title: "Temple", day_date: five[1]!, time_label: "11:00", position: 2 },
  { id: "c", title: "Museum", day_date: five[1]!, time_label: null, position: 3 },
  { id: "d", title: "Lunch", day_date: five[1]!, time_label: null, position: 4 },
  { id: "e", title: "Beach", day_date: five[4]!, time_label: null, position: 1 },
];
const finalPlaces = (moves: readonly StopMove[]) =>
  planAfter(planned, moves).map((s) => `${s.id}:${s.day_date}:${s.time_label ?? ""}`);

test("a follow-up keeps the moves asked for earlier", () => {
  const first: StopMove[] = [
    { id: "a", day_date: five[4]!, at: "end" },
    { id: "b", day_date: five[4]!, at: "end" },
  ];
  const pending = readPendingMoves(first, planned, five);
  const seen = planAfter(planned, pending);
  // Béa reads the plan with the first two already on day 5.
  const text = planEditPrompt("the museum too", seen, five, ["Market and Temple to day 5"]);
  assert.match(
    text,
    /d5 \(day 5, 2026-10-05\):\n {2}s\d Beach\n {2}s\d Market\n {2}s\d 11:00 Temple/,
  );
  assert.match(text, /Earlier the traveller asked:\n- "Market and Temple to day 5"/);
  assert.match(text, /The traveller now adds: "the museum too"/);
  const ref = `s${seen.findIndex((s) => s.id === "c") + 1}`;
  const next = readPlanEdit([{ stop: ref, day: "d5", after: "end", time: "keep" }], seen, five);
  const all = combineMoves(planned, [...pending, ...next]);
  assert.deepEqual(
    all.map((m) => m.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(finalPlaces(all), finalPlaces([...first, ...next]));
  assert.deepEqual(
    planAfter(planned, all)
      .filter((s) => s.day_date === five[4])
      .map((s) => s.id),
    ["e", "a", "b", "c"],
  );
});

test("combined moves land every stop where the rounds did, once each", () => {
  const rounds: StopMove[] = [
    { id: "a", day_date: five[4]!, at: "start" },
    { id: "d", day_date: five[1]!, at: "start", time_label: "08:00" },
    { id: "a", day_date: five[1]!, at: { after: "c" } },
    { id: "e", day_date: five[1]!, at: { index: 1 } },
  ];
  const all = combineMoves(planned, rounds);
  assert.equal(new Set(all.map((m) => m.id)).size, all.length);
  assert.deepEqual(rearrange(planned, all), rearrange(planned, rounds));
  assert.deepEqual(combineMoves(planned, []), []);
});

test("pending moves naming anything not on the trip are dropped", () => {
  const moves = readPendingMoves(
    [
      { id: "zz", day_date: five[0]!, at: "end" },
      { id: "a", day_date: "2027-01-01", at: "end" },
      { id: "a", day_date: five[0]!, at: { after: "zz" } },
      { id: "a", day_date: five[0]!, at: { after: "a" } },
      { id: "b", day_date: five[0]!, at: "end", time_label: "teatime" },
      { id: "c", day_date: null, at: "start", time_label: "9:30" },
    ],
    planned,
    five,
  );
  assert.deepEqual(moves, [{ id: "c", day_date: null, at: "start", time_label: "09:30" }]);
});

test("a saved time is never copied into the moves, free text included", () => {
  const withText = planned.map((s) =>
    s.id === "a"
      ? { ...s, time_label: "after check-in" }
      : s.id === "c"
        ? { ...s, time_label: "noon" }
        : s,
  );
  const all = combineMoves(withText, [
    { id: "a", day_date: five[4]!, at: "end" },
    { id: "c", day_date: five[4]!, at: "end" },
    { id: "b", day_date: five[4]!, at: "start", time_label: "09:00" },
  ]);
  assert.deepEqual(all, [
    { id: "b", day_date: five[4], at: "start", time_label: "09:00" },
    { id: "a", day_date: five[4], at: { after: "e" } },
    { id: "c", day_date: five[4], at: { after: "a" } },
  ]);
  // Sent back with a follow-up, all three are kept.
  assert.deepEqual(readPendingMoves(all, withText, five), all);
});

test("a pending anchor no longer on the day it is used for is dropped", () => {
  const moves = readPendingMoves(
    [
      // "d" is on day 2, not day 5.
      { id: "a", day_date: five[4]!, at: { after: "d" } },
      // "b" lands on day 5 first, so it can anchor "c" there.
      { id: "b", day_date: five[4]!, at: "end" },
      { id: "c", day_date: five[4]!, at: { after: "b" } },
    ],
    planned,
    five,
  );
  assert.deepEqual(
    moves.map((m) => m.id),
    ["b", "c"],
  );
});

test("the days a move leaves with a gap and the days it fills", () => {
  // Market and Temple from day 2 to day 5: day 2 keeps Museum and Lunch.
  assert.deepEqual(
    daysTouched(planned, [
      { id: "a", day_date: five[4]!, at: "end" },
      { id: "b", day_date: five[4]!, at: "end" },
    ]),
    [
      { day: five[1], lost: 2, gained: 0 },
      { day: five[4], lost: 0, gained: 2 },
    ],
  );
  // Beach leaves day 5 empty: nothing to re-plan there. A move inside a day is neither.
  assert.deepEqual(
    daysTouched(planned, [
      { id: "e", day_date: five[0]!, at: "end" },
      { id: "c", day_date: five[1]!, at: "start" },
    ]),
    [{ day: five[0], lost: 0, gained: 1 }],
  );
  // A swap changes both days both ways.
  assert.deepEqual(
    daysTouched(planned, [
      { id: "a", day_date: five[4]!, at: "end" },
      { id: "e", day_date: five[1]!, at: "end" },
    ]),
    [
      { day: five[1], lost: 1, gained: 1 },
      { day: five[4], lost: 1, gained: 1 },
    ],
  );
});

test("after a move, each changed day can be filled, re-planned or fitted", () => {
  const name = (day: string) => `Day ${five.indexOf(day) + 1}`;
  const choices = afterMoveChoices(
    planned,
    [
      { id: "a", day_date: five[4]!, at: "end" },
      { id: "b", day_date: five[4]!, at: "end" },
    ],
    name,
  );
  assert.deepEqual(
    choices.map((c) => [c.id, c.label]),
    [
      [`fill:${five[1]}`, "Fill the gap on Day 2"],
      [`replan:${five[1]}`, "Re-plan the rest of Day 2"],
      [`replan:${five[4]}`, "Fit them into Day 5"],
    ],
  );
  assert.match(choices[0]!.ask, /^Market and Temple moved off this day\. Suggest something nearby/);
  assert.match(choices[2]!.ask, /^Market and Temple moved here from another day\. Re-order/);
  for (const c of choices) assert.match(c.ask, /Keep every booked stop on its time\.$/);
});
