import assert from "node:assert/strict";
import { test } from "node:test";
import { backFallback, isLandingPage } from "./back-target.ts";

test("a trip climbs to the trips list", () => {
  assert.equal(backFallback("/trips/abc-123"), "/trips");
  assert.equal(backFallback("/trips/plan"), "/trips");
  assert.equal(backFallback("/trips/next"), "/trips");
});

test("other sub-screens climb to their tab", () => {
  assert.equal(backFallback("/world/next"), "/world");
  assert.equal(backFallback("/profile/documents"), "/profile");
});

test("pages opened from You climb back to You, or to the page above them", () => {
  for (const p of ["/preferences", "/photos", "/expenses"])
    assert.equal(backFallback(p), "/profile", p);
  assert.equal(backFallback("/memories"), "/photos");
  assert.equal(backFallback("/story"), "/memories");
  assert.equal(backFallback("/calendar"), "/trips");
  assert.equal(backFallback("/preferences-old"), "/");
});

test("tabs and unknown screens fall back to Home", () => {
  assert.equal(backFallback("/trips"), "/");
  assert.equal(backFallback("/help"), "/");
});

test("tab roots are landing pages with no back button", () => {
  for (const p of ["/", "/world", "/trips", "/recommendations", "/profile", "/trips/"]) {
    assert.equal(isLandingPage(p), true, p);
  }
  assert.equal(isLandingPage("/trips/abc"), false);
  assert.equal(isLandingPage("/profile/documents"), false);
});
