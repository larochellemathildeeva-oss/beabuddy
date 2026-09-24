import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClock, pinIsSaved, stayMinutesFrom, stopArea } from "./import-stop.ts";

test("clock times in the ways plans write them", () => {
  const cases: [string, string | null][] = [
    ["09:00", "09:00"],
    ["9:00", "09:00"],
    ["9am", "09:00"],
    ["9.30 pm", "21:30"],
    ["12pm", "12:00"],
    ["12am", "00:00"],
    ["21h30", "21:30"],
    ["noon", "12:00"],
    ["7:05 a.m.", "07:05"],
  ];
  for (const [input, want] of cases) assert.equal(normalizeClock(input), want, input);
});

test("things that are not a time stay empty", () => {
  for (const input of ["", "9", "morning", "25:00", "10:75", "Day 2", null, undefined]) {
    assert.equal(normalizeClock(input as string | null | undefined), null, String(input));
  }
});

test("a stay comes from a stated length or an end time, never a guess", () => {
  assert.equal(stayMinutesFrom({ duration_minutes: 90 }), 90);
  assert.equal(stayMinutesFrom({ time_label: "10:00", end_time: "12:15" }), 135);
  assert.equal(stayMinutesFrom({ time_label: "10am", end_time: "noon" }), 120);
  assert.equal(stayMinutesFrom({ time_label: "10:00" }), null);
  assert.equal(
    stayMinutesFrom({ time_label: "22:00", end_time: "01:00" }),
    null,
    "past midnight is not read",
  );
  assert.equal(stayMinutesFrom({ duration_minutes: 0 }), null);
  assert.equal(stayMinutesFrom({ duration_minutes: 2000 }), null, "a misread length");
});

test("a stop is looked up in its own town, with the trip's country", () => {
  assert.equal(stopArea("Miyajima", "Hiroshima, Japan"), "Miyajima, Japan");
  assert.equal(stopArea("Kyoto", "Tokyo, Japan"), "Kyoto, Japan");
  assert.equal(stopArea("Hiroshima", "Hiroshima, Japan"), "Hiroshima, Japan");
  assert.equal(stopArea(null, "Hiroshima, Japan"), "Hiroshima, Japan");
  assert.equal(stopArea("Kyoto", ""), "Kyoto");
  assert.equal(stopArea("Kyoto", "Tokyo"), "Kyoto");
  assert.equal(stopArea("Nara, Japan", "Tokyo, Japan"), "Nara, Japan");
});

test("a doubtful pin is saved only when kept; any pin can be removed", () => {
  assert.equal(pinIsSaved("high", undefined), true);
  assert.equal(pinIsSaved("medium", undefined), true);
  assert.equal(pinIsSaved("low", undefined), false);
  assert.equal(pinIsSaved("low", "keep"), true);
  assert.equal(pinIsSaved("high", "drop"), false);
});
