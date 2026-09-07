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
  it("never auto-seeds — sample data is opt-in from Home or You", () => {
    const s = fakeStorage();
    assert.equal(shouldAutoSeed(s, "user-1", EMPTY), false);
  });

  it("still treats accounts with any rows as non-empty", () => {
    for (const counts of [
      { recommendations: 1, trips: 0, notes: 0 },
      { recommendations: 0, trips: 1, notes: 0 },
      { recommendations: 0, trips: 0, notes: 1 },
    ]) {
      assert.equal(accountIsEmpty(counts), false);
    }
    assert.equal(accountIsEmpty(EMPTY), true);
  });

  it("keys the marker per account, so a shared device is not confused", () => {
    const s = fakeStorage();
    markAutoSeedAttempted(s, "user-1");
    assert.notEqual(autoSeedKey("user-1"), autoSeedKey("user-2"));
    assert.equal(shouldAutoSeed(s, "user-2", EMPTY), false);
  });

  it("does nothing without a signed-in account", () => {
    const s = fakeStorage();
    assert.equal(shouldAutoSeed(s, null, EMPTY), false);
    assert.equal(shouldAutoSeed(s, undefined, EMPTY), false);
    assert.equal(shouldAutoSeed(s, "", EMPTY), false);
  });
});
