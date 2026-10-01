import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEEP_BODY_MAX, QUICK_BODY_MAX, wordCount } from "./tour-copy.ts";
import { DEEP_STEPS, QUICK_STEPS, routeNeedsAuth, tourSteps } from "./tour.ts";

test("quick tour is a story walk around the block", () => {
  assert.equal(QUICK_STEPS.length, 7);
  assert.equal(QUICK_STEPS[0]?.title, "What is Béa?");
  assert.equal(QUICK_STEPS.at(-1)?.title, "Your travel story");
  // Planning is what a new traveller came for: it follows the welcome, not
  // four memory screens.
  assert.equal(QUICK_STEPS[1]?.selector, "[data-guide='plan-with-bea']");
  assert.ok(
    QUICK_STEPS.some((s) => s.selector),
    "quick walk spotlights real controls",
  );
  // No taps now. Each step that had one lost it because the control it
  // waited on was removed or moved: a demo-city button, a Home shortcut to
  // Story, and last the Paris trip on Home — which only a sample account has,
  // and which took the traveller off the walk into the trip. A step that
  // waits for a control that is not there leaves Next disabled.
  for (const s of QUICK_STEPS.filter((s) => s.awaitClick)) {
    assert.ok(s.actionHint, `${s.title} needs an actionHint`);
    assert.match(s.actionHint!, /then Next/i, `${s.title} hint should mention Next`);
  }
  const blob = QUICK_STEPS.map((s) => `${s.title} ${s.body}`)
    .join(" ")
    .toLowerCase();
  for (const needle of [
    "remembers",
    "future you",
    "globe",
    "recommendation",
    "help me choose",
    "plan with béa",
    "near",
    "story",
    "memory",
  ]) {
    assert.ok(blob.includes(needle), `story walk should mention ${needle}`);
  }
  assert.ok(!blob.includes("every cupboard"), "quick walk is not a feature TOC");
  // Sample data is opt-in, so the walk cannot count on the sample trips.
  assert.ok(!blob.includes("paris in spring"), "quick walk should not need the sample trip");
});

test("no step names the old planner label", () => {
  for (const s of [...QUICK_STEPS, ...DEEP_STEPS]) {
    assert.ok(!/let béa plan/i.test(`${s.title} ${s.body}`), `${s.title} says Let Béa plan`);
  }
});

/**
 * World opens on Map; its other controls live on other views. A step that
 * spotlights one without asking for its view points at nothing — which is how
 * Help me choose, Been and Stats dropped silently out of both walks.
 */
const WORLD_VIEW_OF: Record<string, string> = {
  globe: "map",
  "add-city": "map",
  "compare-pins": "bucket",
  "places-list": "been",
  "travel-stats": "stats",
};

test("World steps open the view their control lives on", () => {
  for (const s of [...QUICK_STEPS, ...DEEP_STEPS]) {
    if (s.to !== "/world") continue;
    const target = s.selector?.match(/data-guide='([a-z0-9-]+)'/)?.[1];
    if (!target || !(target in WORLD_VIEW_OF)) continue;
    assert.equal(s.search?.["tab"], WORLD_VIEW_OF[target], `${s.title} spotlights ${target}`);
  }
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

test("deep dive is six pillars of differentiation", () => {
  assert.ok(DEEP_STEPS.length > QUICK_STEPS.length);
  const blob = DEEP_STEPS.map((s) => `${s.title} ${s.body}`)
    .join(" ")
    .toLowerCase();
  for (const needle of [
    "pillar 1",
    "pillar 2",
    "pillar 3",
    "pillar 4",
    "pillar 5",
    "pillar 6",
    "future me",
    "help me choose",
    "assets",
    "optimize",
    "plan with béa",
    "day trip",
    "playback",
    "near",
  ]) {
    assert.ok(blob.includes(needle), `deep dive should mention ${needle}`);
  }
  // Supporting utilities stay out of the differentiation walk
  for (const avoid of ["receipt", "document vault", "packing list", "dark mode"]) {
    assert.ok(!blob.includes(avoid), `deep dive should not dwell on ${avoid}`);
  }
});

test("tourSteps returns stable array references", () => {
  assert.equal(tourSteps("quick"), tourSteps("quick"));
  assert.equal(tourSteps("deep"), tourSteps("deep"));
  assert.notEqual(tourSteps("quick"), tourSteps("deep"));
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
  assert.equal(routeNeedsAuth("/how-it-works"), false);
  assert.equal(routeNeedsAuth("/trips"), true);
  assert.equal(routeNeedsAuth("/calendar"), true);
  assert.equal(routeNeedsAuth("/story"), true);
});
