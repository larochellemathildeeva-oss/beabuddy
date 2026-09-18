import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COMPRESS_AT, EXPAND_AT, nextCompressed, tabIdForPath } from "./page-header.ts";

describe("nextCompressed", () => {
  it("compresses once past the threshold", () => {
    assert.equal(nextCompressed(0, false), false);
    assert.equal(nextCompressed(COMPRESS_AT - 1, false), false);
    assert.equal(nextCompressed(COMPRESS_AT, false), true);
  });

  it("stays compressed until well back up, so it cannot flap", () => {
    assert.equal(nextCompressed(COMPRESS_AT - 1, true), true);
    assert.equal(nextCompressed(EXPAND_AT + 1, true), true);
    assert.equal(nextCompressed(EXPAND_AT, true), false);
  });

  it("has a gap between the two thresholds", () => {
    assert.ok(EXPAND_AT < COMPRESS_AT);
  });

  it("never oscillates at a resting scroll position", () => {
    // Whatever it settles on, feeding that back in must be a fixed point.
    for (let top = 0; top <= 80; top++) {
      const once = nextCompressed(top, false);
      assert.equal(nextCompressed(top, once), once, `oscillates at ${top}`);
    }
  });
});

describe("tabIdForPath", () => {
  it("names each tab", () => {
    assert.equal(tabIdForPath("/"), "home");
    assert.equal(tabIdForPath("/world"), "world");
    assert.equal(tabIdForPath("/trips"), "trips");
    assert.equal(tabIdForPath("/recommendations"), "recs");
    assert.equal(tabIdForPath("/profile"), "you");
  });

  it("keeps a nested route inside its tab", () => {
    assert.equal(tabIdForPath("/trips/abc-123"), "trips");
  });

  it("returns null where no tab owns the route", () => {
    // /opportunities is among them now: Near folded into Recs as a filter, and
    // the route only exists to redirect into it.
    for (const p of ["/help", "/preferences", "/story", "/privacy", "/opportunities"]) {
      assert.equal(tabIdForPath(p), null, p);
    }
  });

  it("does not claim a sibling with the same prefix", () => {
    assert.equal(tabIdForPath("/worlds"), null);
  });
});
