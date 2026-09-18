import { strict as assert } from "node:assert";
import { test } from "node:test";
import { itemsOnDay, tripTodayView, untilLabel } from "./trip-today.ts";

const item = (id: string, day_date: string | null, position = 0, title = id) => ({
  id,
  day_date,
  time_label: null,
  kind: "activity",
  title,
  position,
});

test("tripTodayView shows today when today falls inside the trip", () => {
  const view = tripTodayView(
    {
      startDate: "2026-09-14",
      endDate: "2026-09-20",
      items: [item("a", "2026-09-18"), item("b", "2026-09-19")],
    },
    "2026-09-18",
  );
  assert.equal(view.state, "today");
  assert.equal(view.state === "today" && view.date, "2026-09-18");
  assert.deepEqual(view.state === "today" && view.items.map((i) => i.id), ["a"]);
});

test("tripTodayView treats the first and last day as inside the trip", () => {
  const range = { startDate: "2026-09-14", endDate: "2026-09-20", items: [] };
  assert.equal(tripTodayView(range, "2026-09-14").state, "today");
  assert.equal(tripTodayView(range, "2026-09-20").state, "today");
});

test("tripTodayView counts down to a trip that has not started", () => {
  const view = tripTodayView(
    {
      startDate: "2026-09-24",
      endDate: "2026-09-28",
      items: [item("a", "2026-09-24"), item("b", "2026-09-26")],
    },
    "2026-09-18",
  );
  assert.equal(view.state, "upcoming");
  assert.equal(view.state === "upcoming" && view.daysUntil, 6);
  assert.equal(view.state === "upcoming" && view.date, "2026-09-24");
  // Day one, not the whole trip.
  assert.deepEqual(view.state === "upcoming" && view.items.map((i) => i.id), ["a"]);
});

test("tripTodayView reports a finished trip", () => {
  const view = tripTodayView(
    { startDate: "2026-09-01", endDate: "2026-09-05", items: [] },
    "2026-09-18",
  );
  assert.equal(view.state, "past");
  assert.equal(view.state === "past" && view.date, "2026-09-05");
});

test("tripTodayView treats a trip with no end date as one day", () => {
  const one = { startDate: "2026-09-18", endDate: null, items: [] };
  assert.equal(tripTodayView(one, "2026-09-18").state, "today");
  assert.equal(tripTodayView(one, "2026-09-19").state, "past");
});

test("tripTodayView gives up on a trip with no usable start", () => {
  assert.equal(
    tripTodayView({ startDate: null, endDate: null, items: [] }, "2026-09-18").state,
    "undated",
  );
  assert.equal(
    tripTodayView({ startDate: "not a date", endDate: null, items: [] }, "2026-09-18").state,
    "undated",
  );
  // A real-looking date that is not a real day.
  assert.equal(
    tripTodayView({ startDate: "2026-02-30", endDate: null, items: [] }, "2026-09-18").state,
    "undated",
  );
});

test("itemsOnDay keeps the timeline's own order", () => {
  const items = [
    item("c", "2026-09-18", 2),
    item("a", "2026-09-18", 0),
    item("b", "2026-09-18", 1),
  ];
  assert.deepEqual(
    itemsOnDay(items, "2026-09-18").map((i) => i.id),
    ["a", "b", "c"],
  );
});

test("itemsOnDay ignores entries with no day and other days", () => {
  const items = [item("a", null), item("b", "2026-09-17"), item("c", "2026-09-18")];
  assert.deepEqual(
    itemsOnDay(items, "2026-09-18").map((i) => i.id),
    ["c"],
  );
});

test("untilLabel says the short thing", () => {
  assert.equal(untilLabel(0), "Today");
  assert.equal(untilLabel(1), "Tomorrow");
  assert.equal(untilLabel(6), "In 6 days");
  assert.equal(untilLabel(10), "Next week");
  assert.equal(untilLabel(21), "In 3 weeks");
  assert.equal(untilLabel(90), "In 3 months");
});
