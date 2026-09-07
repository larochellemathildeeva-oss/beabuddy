import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEEP_BODY_MAX, QUICK_BODY_MAX, wordCount } from "./tour-copy.ts";
import { DEEP_STEPS, QUICK_STEPS, routeNeedsAuth, tourSteps } from "./tour.ts";

test("quick tour is a short journey loop with a few taps", () => {
  assert.equal(QUICK_STEPS.length, 7);
  assert.equal(QUICK_STEPS[0]?.title, "Welcome");
  assert.equal(QUICK_STEPS.at(-1)?.title, "You're all set");
  assert.ok(QUICK_STEPS.some((s) => s.selector), "quick walk spotlights real controls");
  assert.equal(QUICK_STEPS.filter((s) => s.awaitClick).length, 3);
  const taps = QUICK_STEPS.filter((s) => s.awaitClick);
  for (const s of taps) {
    assert.ok(s.actionHint, `${s.title} needs an actionHint`);
    assert.match(s.actionHint!, /then Next/i, `${s.title} hint should mention Next`);
  }
  const blob = QUICK_STEPS.map((s) => `${s.title} ${s.body}`).join(" ").toLowerCase();
  for (const needle of ["paris", "lisbon", "save", "globe", "near"]) {
    assert.ok(blob.includes(needle), `journey should mention ${needle}`);
  }
  assert.ok(!blob.includes("every saved place"), "must not overclaim city-level recs as pins");
});

test("quick and deep bodies stay under the word caps", () => {
  for (const s of QUICK_STEPS) {
    assert.ok(
      wordCount(s.body) <= QUICK_BODY_MAX,
      `${s.title} is ${wordCount(s.body)} words (max ${QUICK_BODY_MAX})`,
    );
  }
  for (const s of DEEP_STEPS) {
    assert.ok(
      wordCount(s.body) <= DEEP_BODY_MAX,
      `${s.title} is ${wordCount(s.body)} words (max ${DEEP_BODY_MAX})`,
    );
  }
});

test("deep dive is longer and covers every feature area", () => {
  assert.ok(DEEP_STEPS.length > QUICK_STEPS.length);
  const blob = DEEP_STEPS.map((s) => `${s.title} ${s.body}`).join(" ").toLowerCase();
  for (const needle of [
    "day trip",
    "travel tags",
    "flying solo",
    "heatmap",
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
