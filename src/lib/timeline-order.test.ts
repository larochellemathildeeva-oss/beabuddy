import { strict as assert } from "node:assert";
import { test } from "node:test";
import { clockMinutes } from "./companion.ts";
import {
  canMove,
  chronologicalPositions,
  chronologicalSlot,
  insertAfter,
  neighbourInDay,
  nextPosition,
} from "./timeline-order.ts";

const row = (id: string, day_date: string | null, position: number) => ({ id, day_date, position });

// Ordered as the query returns them: by day, then by position.
const day1 = [row("a", "2026-09-26", 0), row("b", "2026-09-26", 1), row("c", "2026-09-26", 2)];
const twoDays = [...day1, row("d", "2026-09-27", 0), row("e", "2026-09-27", 1)];

test("a move swaps with the next entry on the same day", () => {
  assert.equal(neighbourInDay(day1, "b", -1)?.id, "a");
  assert.equal(neighbourInDay(day1, "b", 1)?.id, "c");
});

test("a day boundary is not a neighbour", () => {
  // Swapping positions across days would do nothing visible, because the day
  // sorts first. Moving between days is a different action.
  assert.equal(neighbourInDay(twoDays, "c", 1), null);
  assert.equal(neighbourInDay(twoDays, "d", -1), null);
});

test("the ends of the list do not move", () => {
  assert.equal(neighbourInDay(day1, "a", -1), null);
  assert.equal(neighbourInDay(day1, "c", 1), null);
});

test("undated entries are one group, not a run of non-matching nulls", () => {
  const undated = [row("x", null, 0), row("y", null, 1)];
  assert.equal(neighbourInDay(undated, "x", 1)?.id, "y");
  assert.equal(neighbourInDay(undated, "y", -1)?.id, "x");
});

test("an undated entry does not swap with a dated one", () => {
  const mixed = [row("a", "2026-09-26", 0), row("x", null, 0)];
  assert.equal(neighbourInDay(mixed, "a", 1), null);
  assert.equal(neighbourInDay(mixed, "x", -1), null);
});

test("an unknown id moves nowhere", () => {
  assert.equal(neighbourInDay(day1, "nope", 1), null);
  assert.equal(canMove(day1, "nope", -1), false);
});

test("canMove mirrors the neighbour", () => {
  assert.equal(canMove(day1, "a", -1), false);
  assert.equal(canMove(day1, "a", 1), true);
  assert.equal(canMove(twoDays, "e", 1), false);
});

test("nextPosition is one past the highest, not the row count", () => {
  // The bug this exists to stop: remove two of three rows and counting rows
  // hands out a position the survivor already holds.
  assert.equal(nextPosition([{ position: 0 }, { position: 1 }, { position: 2 }]), 3);
  assert.equal(nextPosition([{ position: 7 }]), 8);
  assert.equal(nextPosition([]), 0);
});

test("inserting after a row makes room behind it", () => {
  const rows = [row("a", "d", 0), row("b", "d", 1), row("c", "d", 2)];
  assert.deepEqual(insertAfter(rows, "a"), {
    position: 1,
    shifts: [
      { id: "b", position: 2 },
      { id: "c", position: 3 },
    ],
  });
  assert.deepEqual(insertAfter(rows, "c"), { position: 3, shifts: [] }, "after the last row");
  assert.deepEqual(
    insertAfter(rows, "zz"),
    { position: 3, shifts: [] },
    "unknown anchor goes last",
  );
});

const timed = (
  id: string,
  day_date: string | null,
  position: number,
  time_label: string | null,
) => ({
  id,
  day_date,
  position,
  time_label,
});
const day = [
  timed("a", "2026-10-01", 0, "09:00"),
  timed("b", "2026-10-01", 1, "12:30"),
  timed("c", "2026-10-01", 2, "16:00"),
  timed("d", "2026-10-02", 3, "10:00"),
];

test("a timed stop slots in by its time, not at the end", () => {
  const slot = chronologicalSlot(
    day,
    { day_date: "2026-10-01", time_label: "14:00" },
    clockMinutes,
  );
  assert.equal(slot.position, 2);
  assert.deepEqual(
    slot.shifts.map((s) => s.id),
    ["c", "d"],
  );
});

test("an earliest stop goes first on its day", () => {
  const slot = chronologicalSlot(
    day,
    { day_date: "2026-10-02", time_label: "08:00" },
    clockMinutes,
  );
  assert.equal(slot.position, 3);
  assert.deepEqual(
    slot.shifts.map((s) => s.id),
    ["d"],
  );
  const first = chronologicalSlot(
    day,
    { day_date: "2026-10-01", time_label: "07:00" },
    clockMinutes,
  );
  assert.equal(first.position, 0);
});

test("an untimed stop goes to the end of its day", () => {
  const slot = chronologicalSlot(day, { day_date: "2026-10-01" }, clockMinutes);
  assert.equal(slot.position, 3);
  assert.deepEqual(
    slot.shifts.map((s) => s.id),
    ["d"],
  );
});

test("moving a stop's own time ignores the stop itself", () => {
  const slot = chronologicalSlot(
    day,
    { day_date: "2026-10-01", time_label: "18:00" },
    clockMinutes,
    "a",
  );
  assert.equal(slot.position, 3);
});

test("other stops keep their times: only positions shift", () => {
  const slot = chronologicalSlot(
    day,
    { day_date: "2026-10-01", time_label: "10:00" },
    clockMinutes,
  );
  for (const shift of slot.shifts) assert.equal(Object.keys(shift).sort().join(), "id,position");
});

test("clearing a stop's time moves it to the end of its day", () => {
  const slot = chronologicalSlot(
    day,
    { day_date: "2026-10-01", time_label: null },
    clockMinutes,
    "a",
  );
  // After c, the day's last stop; before d on the next day.
  assert.equal(slot.position, 3);
  assert.deepEqual(
    slot.shifts.map((s) => s.id),
    ["d"],
  );
});

test("chronologicalPositions: a stop asked for on a day goes in by its time", () => {
  const minutes = (label: string | null | undefined) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(label ?? "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const items = [
    { id: "a", day_date: "2026-10-01", position: 0, time_label: "09:00" },
    { id: "b", day_date: "2026-10-01", position: 1, time_label: "12:30" },
    { id: "c", day_date: "2026-10-01", position: 2, time_label: "18:00" },
    { id: "d", day_date: "2026-10-02", position: 3, time_label: "10:00" },
  ];
  // "Add the hotel on day 1 at 15:00": between 12:30 and 18:00, not last.
  const hotel = chronologicalPositions(
    items,
    [{ day_date: "2026-10-01", time_label: "15:00" }],
    minutes,
  );
  assert.deepEqual(hotel.positions, [2]);
  assert.deepEqual(hotel.shifts, [
    { id: "c", position: 3 },
    { id: "d", position: 4 },
  ]);
  // Several at once: each by its time, an untimed one after the new one before it.
  const two = chronologicalPositions(
    items,
    [
      { day_date: "2026-10-01", time_label: "10:00" },
      { day_date: "2026-10-01", time_label: null },
      { day_date: "2026-10-02", time_label: "08:00" },
    ],
    minutes,
  );
  assert.deepEqual(two.positions, [1, 2, 5]);
  assert.deepEqual(two.shifts, [
    { id: "b", position: 3 },
    { id: "c", position: 4 },
    { id: "d", position: 6 },
  ]);
});
