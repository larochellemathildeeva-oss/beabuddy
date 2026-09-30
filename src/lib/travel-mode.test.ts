import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  DEFAULT_TRAVEL_RULES,
  isTravelChoice,
  legModeFor,
  modeFromWord,
  modeWord,
  parseTravelRules,
  travelPrompt,
  travelRulesKey,
  travelRulesSummary,
} from "./travel-mode.ts";

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

test("the traveller's own rules pick the mode by distance", () => {
  const key = travelRulesKey({ walkKm: 2, mid: "transit", farKm: 50, far: "driving" });
  assert.equal(key, "rules:2:transit:50:driving");
  assert.ok(isTravelChoice(key));
  assert.equal(legModeFor(key, 1_500), "walking");
  assert.equal(legModeFor(key, 2_000), "transit");
  assert.equal(legModeFor(key, 49_000), "transit");
  assert.equal(legModeFor(key, 80_000), "driving");
});

test("one edge is enough: over 5 km take the train, under it walk", () => {
  const key = travelRulesKey({ walkKm: 5, mid: "transit", farKm: 5, far: "transit" });
  assert.equal(legModeFor(key, 4_000), "walking");
  assert.equal(legModeFor(key, 300_000), "transit");
  assert.equal(travelRulesSummary(parseTravelRules(key)!), "Walk under 5 km, take transit beyond.");
});

test("rules are tidied: tenths, walking capped, far edge never before the walking one", () => {
  assert.equal(
    travelRulesKey({ walkKm: 40, mid: "walking", farKm: 3.14159, far: "transit" }),
    "rules:15:walking:15:transit",
  );
  assert.equal(
    travelRulesKey({ walkKm: -1, mid: "driving", farKm: Number.NaN, far: "driving" }),
    "rules:0:driving:0:driving",
  );
});

test("a walking band past a day's walk is driven, as with walk everywhere", () => {
  const key = travelRulesKey({ walkKm: 1, mid: "walking", farKm: 100, far: "transit" });
  assert.equal(legModeFor(key, 10_000), "walking");
  assert.equal(legModeFor(key, 20_000), "driving");
  assert.equal(legModeFor(key, 150_000), "transit");
});

test("malformed rules are refused from storage and the wire", () => {
  for (const bad of [
    "rules:",
    "rules:2:bus:50:driving",
    "rules:2:transit:50:walking",
    "rules:20:transit:50:driving",
    "rules:9:transit:3:driving",
    "rules:2:transit:5000:driving",
    "rules:2:transit:50:driving:x",
  ]) {
    assert.ok(!isTravelChoice(bad), bad);
  }
});

test("the summary reads as one sentence", () => {
  assert.equal(
    travelRulesSummary(DEFAULT_TRAVEL_RULES),
    "Walk under 2 km, take transit up to 50 km, drive beyond.",
  );
  assert.equal(
    travelRulesSummary({ walkKm: 0, mid: "driving", farKm: 0, far: "driving" }),
    "Drive everywhere.",
  );
  assert.equal(
    travelRulesSummary({ walkKm: 1, mid: "walking", farKm: 4, far: "transit" }),
    "Walk under 4 km, take transit beyond.",
  );
});

test("planning is told the choice, but not Béa's own default", () => {
  assert.equal(travelPrompt("auto"), "");
  assert.equal(travelPrompt(null), "");
  assert.match(travelPrompt("transit"), /public transit/);
  assert.match(travelPrompt(travelRulesKey(DEFAULT_TRAVEL_RULES)), /up to 50 km/);
});
