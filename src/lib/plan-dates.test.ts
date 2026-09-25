import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  daysBetween,
  movedTripRange,
  planOutsideTrip,
  planRange,
  shiftPlanDates,
} from "./plan-dates.ts";

const oct7 = [
  { day_date: "2026-10-07", title: "Museum" },
  { day_date: null, title: "Loose note" },
  { day_date: "2026-10-07", title: "Ferry" },
];

test("the plan's range is its first and last dated rows", () => {
  assert.deepEqual(planRange(oct7), { start: "2026-10-07", end: "2026-10-07" });
  assert.deepEqual(
    planRange([{ day_date: "2026-10-09" }, { day_date: "2026-10-07" }, { day_date: "junk" }]),
    { start: "2026-10-07", end: "2026-10-09" },
  );
  assert.equal(planRange([{ day_date: null }]), null);
});

test("an Oct 7 plan on a Sep 7 trip is outside it; inside or undated trips are not", () => {
  const plan = planRange(oct7);
  assert.equal(planOutsideTrip(plan, "2026-09-07", "2026-09-07"), true);
  assert.equal(planOutsideTrip(plan, "2026-10-05", "2026-10-10"), false);
  // A trip with only a start date is a one-day trip.
  assert.equal(planOutsideTrip(plan, "2026-10-07", null), false);
  // No trip dates, nothing to disagree with.
  assert.equal(planOutsideTrip(plan, null, null), false);
  assert.equal(planOutsideTrip(null, "2026-09-07", "2026-09-07"), false);
});

test("keeping the trip's dates moves every dated row by the same days", () => {
  const moved = shiftPlanDates(oct7, daysBetween("2026-10-07", "2026-09-07"));
  assert.deepEqual(
    moved.map((row) => row.day_date),
    ["2026-09-07", null, "2026-09-07"],
  );
  assert.equal(moved[0]!.title, "Museum");
});

test("days are counted across a clock change without drifting", () => {
  assert.equal(daysBetween("2026-10-07", "2026-09-07"), -30);
  assert.equal(daysBetween("2026-10-30", "2026-11-02"), 3);
});

test("moving the trip keeps its length unless the plan is longer", () => {
  const plan = { start: "2026-10-07", end: "2026-10-07" };
  assert.deepEqual(movedTripRange({ start: "2026-09-07", end: "2026-09-07" }, plan), plan);
  assert.deepEqual(movedTripRange({ start: "2026-09-07", end: "2026-09-12" }, plan), {
    start: "2026-10-07",
    end: "2026-10-12",
  });
  assert.deepEqual(
    movedTripRange(
      { start: "2026-09-07", end: "2026-09-07" },
      { start: "2026-10-07", end: "2026-10-09" },
    ),
    { start: "2026-10-07", end: "2026-10-09" },
  );
});
