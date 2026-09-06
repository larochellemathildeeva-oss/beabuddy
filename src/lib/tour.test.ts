import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEEP_STEPS, QUICK_STEPS, tourSteps } from "./tour.ts";

test("quick tour keeps the original walk", () => {
  assert.equal(QUICK_STEPS.length, 17);
  assert.equal(QUICK_STEPS[0]?.title, "Welcome to Béa");
  assert.equal(QUICK_STEPS.at(-1)?.title, "You're all set");
  assert.match(QUICK_STEPS[1]!.body, /current or next trip/);
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

test("tourSteps picks the walk", () => {
  assert.equal(tourSteps("quick"), QUICK_STEPS);
  assert.equal(tourSteps("deep"), DEEP_STEPS);
});
