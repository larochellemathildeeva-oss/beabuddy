import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  forgetOfflineTrip,
  readOfflineTrip,
  readOfflineTrips,
  saveOfflineTrip,
} from "./offline-trip.ts";

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
  };
}

const record = (uid: string, id: string) => ({
  uid,
  savedAt: "2026-09-29T10:00:00Z",
  trip: { id, title: id },
  members: [],
  items: [{ id: "a" }],
});

test("a kept trip reads back for its own account only", () => {
  const store = memoryStore();
  saveOfflineTrip(store, record("me", "t1"));
  saveOfflineTrip(store, record("someone-else", "t2"));
  store.setItem("bea.offline-trip.bad", "{not json");
  assert.equal(
    readOfflineTrip<{ id: string; title: string }, never, unknown>(store, "t1", "me")?.trip.title,
    "t1",
  );
  assert.equal(readOfflineTrip(store, "t2", "me"), null);
  assert.deepEqual(
    readOfflineTrips<{ id: string }, never, unknown>(store, "me").map((r) => r.trip.id),
    ["t1"],
  );
  forgetOfflineTrip(store, "t1");
  assert.equal(readOfflineTrip(store, "t1", "me"), null);
});

test("a full store does not throw", () => {
  const store = memoryStore();
  store.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.doesNotThrow(() => saveOfflineTrip(store, record("me", "t1")));
});
