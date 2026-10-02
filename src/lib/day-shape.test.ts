import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  dayShapeLine,
  dayTightnessNote,
  minutesOfDay,
  minutesUntilLabel,
  nextUp,
  nowDivider,
} from "./day-shape.ts";

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

const KYOTO = { lat: 35.0116, lon: 135.7681 };
const ACROSS_TOWN = { lat: 35.0116, lon: 135.7911 };

const placed = (
  time: string | null,
  title: string,
  where: { lat: number; lon: number } | null = KYOTO,
  stay = 0,
) => ({
  kind: "activity",
  title,
  time_label: time,
  planned_stay_minutes: stay,
  ...(where ?? {}),
});

test("dayTightnessNote names the two stops and both numbers", () => {
  const day = [placed("09:00", "Breakfast"), placed("09:20", "Kiyomizu-dera", ACROSS_TOWN)];
  assert.equal(
    dayTightnessNote(day),
    "20 min between Breakfast and Kiyomizu-dera, and travel alone is about 37.",
  );
});

test("dayTightnessNote includes time spent at the first stop", () => {
  const day = [
    placed("09:00", "Museum", KYOTO, 60),
    placed("10:00", "Lunch", { lat: 35.0116, lon: 135.78 }),
  ];
  const note = dayTightnessNote(day);
  assert.ok(note?.includes("Museum is planned for 60 min"), `duration is visible, got: ${note}`);
});

test("dayTightnessNote stays quiet when the day has room", () => {
  const day = [placed("09:00", "Breakfast"), placed("11:00", "Kiyomizu-dera", ACROSS_TOWN)];
  assert.equal(dayTightnessNote(day), null);
});

test("dayTightnessNote stays quiet about travel it cannot measure", () => {
  const day = [placed("09:00", "Breakfast"), placed("09:20", "Somewhere", null)];
  assert.equal(dayTightnessNote(day), null);
});

test("dayTightnessNote no longer skips pairs more than 5 km apart", () => {
  const day = [
    { title: "Shukkeien", time_label: "14:45", lat: 34.4006, lon: 132.4679 },
    { title: "Kakiya", time_label: "15:00", lat: 34.2986, lon: 132.3212 },
  ];
  assert.ok(dayTightnessNote(day), "a long leg still gets checked rather than skipped");
});

test("dayTightnessNote times a long leg as a drive, not a walk", () => {
  // 17.6 km: a walk would be about four hours; a drive fits in 1 h 45.
  const roomy = [
    { title: "Shukkeien", time_label: "14:45", lat: 34.4006, lon: 132.4679 },
    { title: "Kakiya", time_label: "16:30", lat: 34.2986, lon: 132.3212 },
  ];
  assert.equal(dayTightnessNote(roomy), null);
  const tight = [roomy[0]!, { ...roomy[1]!, time_label: "15:00" }];
  const minutes = Number(/about (\d+)/.exec(dayTightnessNote(tight) ?? "")?.[1]);
  assert.ok(minutes > 15 && minutes < 90, `a drive-sized estimate, got ${minutes}`);
});

test("dayTightnessNote needs two clock times, not two labels", () => {
  const day = [placed("Morning", "Breakfast"), placed("09:20", "Kiyomizu-dera", ACROSS_TOWN)];
  assert.equal(dayTightnessNote(day), null);
});

test("dayTightnessNote ignores a rounding-sized squeeze", () => {
  const day = [
    placed("09:00", "Breakfast"),
    placed("09:25", "Nearby", { lat: 35.0116, lon: 135.7881 }),
  ];
  assert.equal(dayTightnessNote(day), null);
});

test("dayTightnessNote speaks once, about the tightest pair", () => {
  const day = [
    placed("09:00", "Breakfast"),
    placed("09:20", "Kiyomizu-dera", ACROSS_TOWN),
    placed("09:25", "Gion", KYOTO),
  ];
  const note = dayTightnessNote(day);
  assert.ok(note?.includes("Kiyomizu-dera and Gion"), `tightest pair, got: ${note}`);
  assert.equal(note?.split(".").filter(Boolean).length, 1, "one sentence, not a list");
});

test("dayTightnessNote ignores an overnight or out-of-order pair", () => {
  const day = [placed("22:00", "Dinner"), placed("08:00", "Breakfast", ACROSS_TOWN)];
  assert.equal(dayTightnessNote(day), null);
});
