import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldBuzz, TAP_MS, CONFIRM_MS } from "./haptics.ts";

describe("shouldBuzz", () => {
  const vibrate = () => true;

  it("buzzes where the platform supports it", () => {
    assert.equal(shouldBuzz({ vibrate, prefersReducedMotion: false }), true);
  });

  it("stays silent where there is no API at all", () => {
    // iOS Safari. This is why haptics can never be the only feedback.
    assert.equal(shouldBuzz({}), false);
    assert.equal(shouldBuzz({ vibrate: undefined }), false);
  });

  it("stays silent under reduced motion", () => {
    assert.equal(shouldBuzz({ vibrate, prefersReducedMotion: true }), false);
  });
});

describe("durations", () => {
  it("are short, and a confirm is the longer of the two", () => {
    assert.ok(TAP_MS > 0 && TAP_MS <= 12);
    assert.ok(CONFIRM_MS > TAP_MS && CONFIRM_MS <= 25);
  });
});
