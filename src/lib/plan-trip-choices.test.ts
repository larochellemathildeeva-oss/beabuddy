import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_CHOICES_AHEAD, planTripChoices, startsNewTrip } from "./plan-trip-choices.ts";

const trip = (id: string, start_date: string | null, end_date: string | null = start_date) => ({
  id,
  start_date,
  end_date,
});

const today = "2026-10-01";
const trips = [
  trip("past", "2026-08-01", "2026-08-05"),
  trip("later", "2027-03-10", "2027-03-20"),
  trip("draft", null, null),
  trip("now", "2026-09-30", "2026-10-03"),
  trip("long-ago", "2024-01-01", "2024-01-05"),
];

test("Build and Import never offer a trip that is over", () => {
  for (const tab of ["build", "import"] as const) {
    assert.deepEqual(
      planTripChoices(trips, today, tab).map((t) => t.id),
      ["now", "later", "draft"],
    );
  }
});

test("Optimize and Compare add recent past trips after the ones ahead", () => {
  for (const tab of ["optimize", "compare"] as const) {
    assert.deepEqual(
      planTripChoices(trips, today, tab).map((t) => t.id),
      ["now", "later", "draft", "past"],
    );
  }
});

test("only past trips: Build has nothing to ask about", () => {
  const onlyPast = [trip("past", "2026-08-01", "2026-08-05")];
  assert.deepEqual(planTripChoices(onlyPast, today, "build"), []);
  assert.deepEqual(
    planTripChoices(onlyPast, today, "optimize").map((t) => t.id),
    ["past"],
  );
});

test("the list stays short", () => {
  const many = Array.from({ length: 9 }, (_, i) => trip(`t${i}`, `2027-0${i + 1}-01`));
  assert.equal(planTripChoices(many, today, "build").length, PLAN_CHOICES_AHEAD);
});

test("only Build and Import start a new trip", () => {
  assert.equal(startsNewTrip("build"), true);
  assert.equal(startsNewTrip("import"), true);
  assert.equal(startsNewTrip("optimize"), false);
  assert.equal(startsNewTrip("compare"), false);
});
