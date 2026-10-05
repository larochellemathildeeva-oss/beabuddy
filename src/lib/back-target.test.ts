import assert from "node:assert/strict";
import { test } from "node:test";
import { backFallback } from "./back-target.ts";

test("a trip climbs to the trips list", () => {
  assert.equal(backFallback("/trips/abc-123"), "/trips");
  assert.equal(backFallback("/trips/plan"), "/trips");
  assert.equal(backFallback("/trips/next"), "/trips");
});

test("other sub-screens climb to their tab", () => {
  assert.equal(backFallback("/world/next"), "/world");
  assert.equal(backFallback("/profile/documents"), "/profile");
});

test("tabs and unknown screens fall back to Home", () => {
  assert.equal(backFallback("/trips"), "/");
  assert.equal(backFallback("/help"), "/");
});
