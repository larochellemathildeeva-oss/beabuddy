import { strict as assert } from "node:assert";
import { test } from "node:test";
import { findStopForChange, readTimeChange } from "./stop-edit.ts";

test("reads a time change in plain words", () => {
  assert.deepEqual(readTimeChange("change time of Louvre on day 2 to 6am"), {
    stop: "Louvre",
    day: 2,
    time: "06:00",
  });
  assert.deepEqual(readTimeChange("Change the time of stop Café de Flore to 7:30."), {
    stop: "Café de Flore",
    day: null,
    time: "07:30",
  });
  assert.deepEqual(readTimeChange("move breakfast on day 3 to 14h"), {
    stop: "breakfast",
    day: 3,
    time: "14:00",
  });
  assert.deepEqual(readTimeChange("set stop 2 on day 1 at 6:15 pm"), {
    stop: "stop 2",
    day: 1,
    time: "18:15",
  });
});

test("leaves anything else alone", () => {
  assert.equal(readTimeChange("add a museum"), null);
  assert.equal(readTimeChange("move Louvre to day 3"), null);
  assert.equal(readTimeChange("change time of Louvre to later"), null);
});

const stops = [
  { id: "a", title: "Breakfast at Café de Flore", day_date: "2026-10-12" },
  { id: "b", title: "Louvre", day_date: "2026-10-12" },
  { id: "c", title: "Louvre", day_date: "2026-10-13" },
  { id: "d", title: "Lunch at Chartier", day_date: "2026-10-13" },
];
const days = ["2026-10-12", "2026-10-13"];

test("finds the stop on the day named", () => {
  const found = findStopForChange({ stop: "louvre", day: 2, time: "06:00" }, stops, days);
  assert.ok("stop" in found && found.stop.id === "c");
  const second = findStopForChange({ stop: "2", day: 2, time: "06:00" }, stops, days);
  assert.ok("stop" in second && second.stop.id === "d");
});

test("asks rather than guesses", () => {
  assert.deepEqual(findStopForChange({ stop: "louvre", day: null, time: "06:00" }, stops, days), {
    problem: "ambiguous",
    options: [stops[1], stops[2]],
  });
  assert.deepEqual(findStopForChange({ stop: "Orsay", day: 1, time: "06:00" }, stops, days), {
    problem: "no-stop",
  });
  assert.deepEqual(findStopForChange({ stop: "Louvre", day: 5, time: "06:00" }, stops, days), {
    problem: "no-day",
  });
});
