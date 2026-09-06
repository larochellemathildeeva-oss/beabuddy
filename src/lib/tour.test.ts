import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEEP_STEPS, QUICK_STEPS, routeNeedsAuth, tourSteps } from "./tour.ts";

test("quick tour is a short spotlight walk with a few taps", () => {
  assert.equal(QUICK_STEPS.length, 10);
  assert.equal(QUICK_STEPS[0]?.title, "Welcome to Béa");
  assert.equal(QUICK_STEPS.at(-1)?.title, "You're all set");
  assert.ok(QUICK_STEPS.some((s) => s.selector), "quick walk spotlights real controls");
  assert.equal(QUICK_STEPS.filter((s) => s.awaitClick).length, 3);
});

test("deep dive is longer and covers every feature area", () => {
  assert.ok(DEEP_STEPS.length > QUICK_STEPS.length);
  const blob = DEEP_STEPS.map((s) => `${s.title} ${s.body}`).join(" ").toLowerCase();
  for (const needle of [
    "day trip",
    "travel tags",
    "flying solo",
    "heatmap",
    "choose stats",
    "add a city",
    "offline",
    "packing",
    "ask béa",
    "feedback",
    "copyright",
    "preferences",
    "does not book",
    "customize home",
    "layover",
    "snooze",
    "locations only",
    "join with a code",
    "tentative",
  ]) {
    assert.ok(blob.includes(needle), `deep dive should mention ${needle}`);
  }
});

test("tourSteps picks the walk and tags gated routes", () => {
  assert.equal(tourSteps("quick").length, QUICK_STEPS.length);
  assert.equal(tourSteps("deep").length, DEEP_STEPS.length);
  const world = tourSteps("quick").find((s) => s.to === "/world");
  assert.equal(world?.needsAuth, true);
  const home = tourSteps("quick").find((s) => s.to === "/" && s.selector);
  assert.equal(home?.needsAuth, false);
  assert.equal(routeNeedsAuth("/"), false);
  assert.equal(routeNeedsAuth("/help"), false);
  assert.equal(routeNeedsAuth("/trips"), true);
  assert.equal(routeNeedsAuth("/calendar"), true);
});
