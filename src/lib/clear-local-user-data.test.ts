import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

describe("clearLocalUserData", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorage,
    });
  });

  afterEach(() => {
    mock.reset();
  });

  it("removes user-scoped layouts, vault keys, and offline directions", async () => {
    store.set("bea.vault.key.u1", "x");
    store.set("bea.vault.cred.u1", "y");
    store.set("bea-home-layout-u1", "{}");
    store.set("bea-stats-layout-u1", "{}");
    store.set("bea.directions.trip-a", "{}");
    store.set("bea.trips.open", "trip-a");
    store.set("bea-dark", "yes");
    store.set("bea-tour-seen", "1");

    const { clearLocalUserData } = await import("./clear-local-user-data.ts");
    clearLocalUserData("u1");

    assert.equal(store.has("bea.vault.key.u1"), false);
    assert.equal(store.has("bea.vault.cred.u1"), false);
    assert.equal(store.has("bea-home-layout-u1"), false);
    assert.equal(store.has("bea-stats-layout-u1"), false);
    assert.equal(store.has("bea.directions.trip-a"), false);
    assert.equal(store.has("bea.trips.open"), false);
    assert.equal(store.get("bea-dark"), "yes");
    assert.equal(store.get("bea-tour-seen"), "1");
  });
});
