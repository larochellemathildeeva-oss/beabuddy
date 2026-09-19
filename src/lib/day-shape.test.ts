import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dayShapeLine, minutesOfDay, minutesUntilLabel, nextUp, nowDivider } from "./day-shape.ts";

const at = (time: string | null, kind = "activity", title = "Something") => ({
  kind,
  title,
  time_label: time,
});

test("dayShapeLine says what the day holds, biggest group first", () => {
  const day = [
    at("09:00", "sight"),
    at("10:00", "sight"),
    at("11:00", "museum"),
    at("13:00", "meal"),
    at("15:00", "walk"),
  ];
  assert.equal(dayShapeLine(day), "3 sights · 1 meal · 1 walk");
});

test("dayShapeLine is singular when it should be", () => {
  assert.equal(dayShapeLine([at("09:00", "meal")]), "1 meal");
});

test("dayShapeLine stops being a list after three groups", () => {
  const day = [at(null, "sight"), at(null, "meal"), at(null, "walk"), at(null, "transport")];
  // Ties break on the glyph name, so transport ("journey") sorts last.
  assert.equal(dayShapeLine(day), "1 meal · 1 sight · 1 journey · 1 more");
});

test("dayShapeLine handles an empty day", () => {
  assert.equal(dayShapeLine([]), "");
});

test("minutesOfDay reads the formats the app actually stores", () => {
  assert.equal(minutesOfDay("09:00"), 540);
  assert.equal(minutesOfDay("9:00 AM"), 540);
  assert.equal(minutesOfDay("7:30 PM"), 1170);
  assert.equal(minutesOfDay("Morning"), null);
  assert.equal(minutesOfDay(null), null);
});

test("nowDivider lands before the first thing still to come", () => {
  const day = [at("09:00"), at("13:00"), at("19:00")];
  assert.equal(nowDivider(day, 8 * 60), 0, "before the day starts");
  assert.equal(nowDivider(day, 11 * 60), 1, "mid-morning");
  assert.equal(nowDivider(day, 20 * 60), 3, "after the last thing");
});

test("nowDivider says nothing about a day with no times at all", () => {
  // A line through an untimed list would invent an order the plan never had.
  assert.equal(nowDivider([at(null), at(null)], 12 * 60), null);
});

test("nowDivider skips untimed rows rather than tripping on them", () => {
  const day = [at(null), at("09:00"), at(null), at("18:00")];
  assert.equal(nowDivider(day, 12 * 60), 3);
});

test("nextUp finds the next thing, and nothing once the day is done", () => {
  const day = [at("09:00", "meal", "Breakfast"), at("19:00", "meal", "Dinner")];
  assert.equal(nextUp(day, 12 * 60)?.title, "Dinner");
  assert.equal(nextUp(day, 23 * 60), null);
});

test("minutesUntilLabel is useful, or silent", () => {
  assert.equal(minutesUntilLabel(at("13:00"), 12 * 60 + 30), "in 30 min");
  assert.equal(minutesUntilLabel(at("13:00"), 11 * 60), "in 2 h");
  assert.equal(minutesUntilLabel(at("13:10"), 11 * 60), "in 2 h 10");
  assert.equal(minutesUntilLabel(at("13:00"), 14 * 60), null, "already passed");
  assert.equal(minutesUntilLabel(at("23:00"), 8 * 60), null, "too far off to matter");
  assert.equal(minutesUntilLabel(at("Morning"), 8 * 60), null);
  assert.equal(minutesUntilLabel(null, 8 * 60), null);
});
