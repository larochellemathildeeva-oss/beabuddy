import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { guideKeyForPath } from "./guide-key.ts";

const KEYS = ["/", "/trips", "/trips/$tripId", "/recommendations", "/world"] as const;

describe("guideKeyForPath", () => {
  it("prefers an exact key", () => {
    assert.equal(guideKeyForPath("/trips", KEYS), "/trips");
    assert.equal(guideKeyForPath("/", KEYS), "/");
  });

  it("matches a dynamic segment", () => {
    assert.equal(guideKeyForPath("/trips/abc-123", KEYS), "/trips/$tripId");
  });

  it("does not match across a different depth", () => {
    assert.equal(guideKeyForPath("/trips/abc/day/2", KEYS), null);
  });

  it("returns null when nothing is registered", () => {
    assert.equal(guideKeyForPath("/preferences", KEYS), null);
  });

  it("prefers the more specific pattern when two could fit", () => {
    const keys = ["/trips/$tripId", "/trips/$tripId/day/$day"];
    assert.equal(guideKeyForPath("/trips/a/day/3", keys), "/trips/$tripId/day/$day");
    assert.equal(guideKeyForPath("/trips/a", keys), "/trips/$tripId");
  });

  it("is not fooled by a trailing slash", () => {
    assert.equal(guideKeyForPath("/trips/abc-123/", KEYS), "/trips/$tripId");
  });
});
