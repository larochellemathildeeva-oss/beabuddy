import { strict as assert } from "node:assert";
import { test } from "node:test";
import { lockAxis, swipeOutcome } from "./swipe.ts";

test("the axis locks only after a few pixels, to whichever moved more", () => {
  assert.equal(lockAxis(3, 2), null);
  assert.equal(lockAxis(10, 4), "x");
  assert.equal(lockAxis(-10, 4), "x");
  assert.equal(lockAxis(4, 12), "y");
});

test("drag distance decides the outcome", () => {
  assert.equal(swipeOutcome(80), "complete");
  assert.equal(swipeOutcome(60), "close");
  assert.equal(swipeOutcome(-30), "close");
  assert.equal(swipeOutcome(-100), "open");
  assert.equal(swipeOutcome(-200), "delete");
});
