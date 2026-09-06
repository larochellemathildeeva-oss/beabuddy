import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TourStorage } from "./tour-state.ts";
import {
  accountIsEmpty,
  autoSeedKey,
  markAutoSeedAttempted,
  shouldAutoSeed,
} from "./auto-seed.ts";

function fakeStorage(seed: Record<string, string> = {}): TourStorage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const EMPTY = { recommendations: 0, trips: 0, notes: 0 };

describe("auto-seed guards", () => {
  it("seeds a brand-new empty account once", () => {
    const s = fakeStorage();
    assert.equal(shouldAutoSeed(s, "user-1", EMPTY), true);
    markAutoSeedAttempted(s, "user-1");
    assert.equal(shouldAutoSeed(s, "user-1", EMPTY), false);
  });

  it("never buries data the traveller already has", () => {
    const s = fakeStorage();
    for (const counts of [
      { recommendations: 1, trips: 0, notes: 0 },
      { recommendations: 0, trips: 1, notes: 0 },
      { recommendations: 0, trips: 0, notes: 1 },
    ]) {
      assert.equal(shouldAutoSeed(s, "user-1", counts), false);
      assert.equal(accountIsEmpty(counts), false);
    }
  });

  it("does not undo Remove sample on the next page load", () => {
    // The loop to avoid: seed → user clears it → account is empty again →
    // reseed on the very next render.
    const s = fakeStorage();
    markAutoSeedAttempted(s, "user-1");
    assert.equal(shouldAutoSeed(s, "user-1", EMPTY), false);
  });

  it("marks the attempt even when seeding failed, so it cannot retry forever", () => {
    const s = fakeStorage();
    markAutoSeedAttempted(s, "user-1"); // caller marks in a finally block
    assert.equal(shouldAutoSeed(s, "user-1", EMPTY), false);
  });

  it("keys the marker per account, so a shared device is not confused", () => {
    const s = fakeStorage();
    markAutoSeedAttempted(s, "user-1");
    assert.notEqual(autoSeedKey("user-1"), autoSeedKey("user-2"));
    assert.equal(shouldAutoSeed(s, "user-2", EMPTY), true);
  });

  it("does nothing without a signed-in account", () => {
    const s = fakeStorage();
    assert.equal(shouldAutoSeed(s, null, EMPTY), false);
    assert.equal(shouldAutoSeed(s, undefined, EMPTY), false);
    assert.equal(shouldAutoSeed(s, "", EMPTY), false);
  });
});
