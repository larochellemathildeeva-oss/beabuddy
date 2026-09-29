import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isTravelChoice, legModeFor, modeFromWord, modeWord } from "./travel-mode.ts";

test("walk what's close: walks under 3 km, drives the rest, as before", () => {
  assert.equal(legModeFor("auto", 2_000), "walking");
  assert.equal(legModeFor("auto", 5_000), "driving");
});

test("transit walks the short hops and rides the rest", () => {
  assert.equal(legModeFor("transit", 600), "walking");
  assert.equal(legModeFor("transit", 1_500), "transit");
  assert.equal(legModeFor("transit", 20_000), "transit");
});

test("walk and car are used for every stretch, bar walking to another town", () => {
  assert.equal(legModeFor("walk", 12_000), "walking");
  assert.equal(legModeFor("walk", 300_000), "driving");
  assert.equal(legModeFor("drive", 400), "driving");
});

test("the word on a saved row round-trips to its mode", () => {
  for (const mode of ["walking", "driving", "transit"] as const) {
    assert.equal(modeFromWord(modeWord(mode)), mode);
  }
  assert.equal(modeFromWord("Fly"), null);
});

test("only the four choices are accepted from storage", () => {
  assert.ok(isTravelChoice("transit"));
  assert.ok(!isTravelChoice("bus"));
  assert.ok(!isTravelChoice(null));
});
