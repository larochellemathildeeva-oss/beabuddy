import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  dayOutsideTripNote,
  dayWithinTrip,
  defaultEntryDay,
  isClockTime,
  normalizeTimeLabel,
  suggestedTripTitle,
  tripDayOptions,
} from "./timeline-entry.ts";

test("normalizeTimeLabel reads 12-hour times", () => {
  assert.equal(normalizeTimeLabel("2pm"), "14:00");
  assert.equal(normalizeTimeLabel("2 PM"), "14:00");
  assert.equal(normalizeTimeLabel("2:30pm"), "14:30");
  assert.equal(normalizeTimeLabel("9am"), "09:00");
});

test("normalizeTimeLabel handles noon and midnight edges", () => {
  assert.equal(normalizeTimeLabel("12pm"), "12:00");
  assert.equal(normalizeTimeLabel("12am"), "00:00");
  assert.equal(normalizeTimeLabel("12:15am"), "00:15");
});

test("normalizeTimeLabel reads 24-hour and European forms", () => {
  assert.equal(normalizeTimeLabel("14:00"), "14:00");
  assert.equal(normalizeTimeLabel("14h"), "14:00");
  assert.equal(normalizeTimeLabel("14h30"), "14:30");
  assert.equal(normalizeTimeLabel("9:5"), "09:05");
});

test("normalizeTimeLabel reads parts of the day", () => {
  assert.equal(normalizeTimeLabel("Morning"), "09:00");
  assert.equal(normalizeTimeLabel("evening"), "19:00");
});

test("normalizeTimeLabel leaves a real label alone", () => {
  assert.equal(normalizeTimeLabel("after check-in"), "after check-in");
  assert.equal(normalizeTimeLabel("  whenever  "), "whenever");
  assert.equal(normalizeTimeLabel(""), "");
});

test("normalizeTimeLabel does not invent a time from a bare number", () => {
  assert.equal(normalizeTimeLabel("3"), "3");
});

test("normalizeTimeLabel refuses impossible clock times", () => {
  assert.equal(normalizeTimeLabel("25:00"), "25:00");
  assert.equal(normalizeTimeLabel("13pm"), "13pm");
});

test("isClockTime accepts only a real 24-hour time", () => {
  assert.equal(isClockTime("14:30"), true);
  assert.equal(isClockTime("00:00"), true);
  assert.equal(isClockTime("24:00"), false);
  assert.equal(isClockTime("after check-in"), false);
});

test("defaultEntryDay prefers the day being viewed", () => {
  assert.equal(
    defaultEntryDay({ openDay: "2026-04-03", tripStart: "2026-04-01", tripEnd: "2026-04-10" }),
    "2026-04-03",
  );
});

test("defaultEntryDay falls back to the trip start", () => {
  assert.equal(defaultEntryDay({ tripStart: "2026-04-01", tripEnd: "2026-04-10" }), "2026-04-01");
});

test("defaultEntryDay stays empty for a trip with no dates", () => {
  assert.equal(defaultEntryDay({}), "");
  assert.equal(defaultEntryDay({ openDay: "not-a-date" }), "");
});

test("dayWithinTrip bounds both ends and allows open-ended trips", () => {
  assert.equal(dayWithinTrip("2026-04-05", "2026-04-01", "2026-04-10"), true);
  assert.equal(dayWithinTrip("2026-03-30", "2026-04-01", "2026-04-10"), false);
  assert.equal(dayWithinTrip("2026-04-11", "2026-04-01", "2026-04-10"), false);
  assert.equal(dayWithinTrip("2019-01-01", null, null), true);
  assert.equal(dayWithinTrip("", "2026-04-01", "2026-04-10"), true);
});

test("dayOutsideTripNote warns without blocking", () => {
  assert.equal(dayOutsideTripNote("2026-04-05", "2026-04-01", "2026-04-10"), null);
  assert.match(
    dayOutsideTripNote("2026-03-01", "2026-04-01", "2026-04-10") ?? "",
    /before the trip starts/,
  );
  assert.match(
    dayOutsideTripNote("2026-05-01", "2026-04-01", "2026-04-10") ?? "",
    /after the trip ends/,
  );
});

test("tripDayOptions lists every day of the trip", () => {
  assert.deepEqual(tripDayOptions("2026-04-01", "2026-04-04"), [
    "2026-04-01",
    "2026-04-02",
    "2026-04-03",
    "2026-04-04",
  ]);
});

test("tripDayOptions caps a long trip and copes with missing dates", () => {
  assert.equal(tripDayOptions("2026-01-01", "2026-12-31").length, 21);
  assert.deepEqual(tripDayOptions("2026-04-01", null), ["2026-04-01"]);
  assert.deepEqual(tripDayOptions(null, "2026-04-04"), []);
});

test("tripDayOptions crosses a month boundary", () => {
  assert.deepEqual(tripDayOptions("2026-01-30", "2026-02-02"), [
    "2026-01-30",
    "2026-01-31",
    "2026-02-01",
    "2026-02-02",
  ]);
});

test("suggestedTripTitle pairs the city with the month", () => {
  assert.equal(suggestedTripTitle("Lisbon", "2026-03-14"), "Lisbon · March 2026");
  assert.equal(suggestedTripTitle("Lisbon, Portugal", "2026-03-14"), "Lisbon · March 2026");
});

test("suggestedTripTitle copes with half a form", () => {
  assert.equal(suggestedTripTitle("Lisbon", ""), "Lisbon");
  assert.equal(suggestedTripTitle("", "2026-03-14"), "");
  assert.equal(suggestedTripTitle("  ", ""), "");
});
