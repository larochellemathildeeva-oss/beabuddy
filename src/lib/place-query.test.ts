import { test } from "node:test";
import assert from "node:assert/strict";
import { placeQueryParts } from "./place-query.ts";

test("a list of names is tried one by one", () => {
  assert.deepEqual(placeQueryParts("Peace Park / Atomic Bomb Dome / Cenotaph"), [
    "Peace Park",
    "Atomic Bomb Dome",
    "Cenotaph",
  ]);
});

test("the name in brackets comes first: it is usually the local one", () => {
  assert.deepEqual(placeQueryParts("Itsukushima Shrine (厳島神社)"), [
    "厳島神社",
    "Itsukushima Shrine",
  ]);
  assert.deepEqual(placeQueryParts("Atomic Bomb Dome（原爆ドーム）"), [
    "原爆ドーム",
    "Atomic Bomb Dome",
  ]);
});

test("an unclosed bracket, as a cut-off title has, still yields its name", () => {
  assert.deepEqual(placeQueryParts("Peace Park / Atomic Bomb Dome / (原爆ドーム"), [
    "原爆ドーム",
    "Peace Park / Atomic Bomb Dome",
    "Peace Park",
    "Atomic Bomb Dome",
  ]);
});

test("Japanese separators and dashes between names", () => {
  assert.deepEqual(placeQueryParts("Fushimi Inari・伏見稲荷大社"), [
    "Fushimi Inari",
    "伏見稲荷大社",
  ]);
  assert.deepEqual(placeQueryParts("Nishiki Market – 錦市場"), ["Nishiki Market", "錦市場"]);
});

test("a plain name has nothing else to try", () => {
  assert.deepEqual(placeQueryParts("Peace Memorial Museum"), []);
  assert.deepEqual(placeQueryParts("清水寺"), []);
  assert.deepEqual(placeQueryParts("Saint-Germain-des-Prés"), []);
});

test("two-character names survive; single letters do not", () => {
  assert.deepEqual(placeQueryParts("京都 / 奈良"), ["京都", "奈良"]);
  assert.deepEqual(placeQueryParts("A / Louvre"), ["Louvre"]);
});

test("never more than asked for", () => {
  assert.equal(placeQueryParts("a1 / b2 / c3 / d4 / e5 / f6", 3).length, 3);
});

test("the directions and import lookups try each name as well", async () => {
  const { placeQueryCandidates } = await import("./direction-stops.ts");
  const { planStopQueries } = await import("./geocode-plan.ts");
  assert.deepEqual(placeQueryCandidates("Itsukushima Shrine (厳島神社)", null).slice(0, 2), [
    "Itsukushima Shrine",
    "厳島神社",
  ]);
  assert.deepEqual(
    planStopQueries({ title: "Peace Park / Atomic Bomb Dome / Cenotaph" }, "Hiroshima, Japan"),
    ["Peace Park / Atomic Bomb Dome / Cenotaph, Hiroshima, Japan", "Peace Park, Hiroshima, Japan"],
  );
});
