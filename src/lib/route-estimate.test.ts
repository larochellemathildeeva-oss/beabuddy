import { strict as assert } from "node:assert";
import { test } from "node:test";
import { estimatedLegMeters, estimatedLegSeconds } from "./route-estimate.ts";

test("a 1 km straight line is about an 18 minute walk", () => {
  assert.equal(estimatedLegSeconds(1000, "walking"), 18 * 60);
  assert.equal(estimatedLegMeters(1000, "walking"), 1300);
});

test("a 10 km straight line is about a half-hour drive", () => {
  assert.equal(estimatedLegSeconds(10_000, "driving"), 28 * 60);
});

test("never under a minute, and nothing for no distance", () => {
  assert.equal(estimatedLegSeconds(20, "walking"), 60);
  assert.equal(estimatedLegSeconds(0, "walking"), 0);
  assert.equal(estimatedLegMeters(0, "driving"), 0);
});
