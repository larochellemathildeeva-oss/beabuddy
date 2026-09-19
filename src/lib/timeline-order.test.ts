import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canMove, neighbourInDay, nextPosition } from "./timeline-order.ts";

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
