import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  homeNextLayoutKey,
  homeState,
  isUntouched,
  STATE_DEFAULTS,
  STATE_MODULES,
  stateLayout,
} from "./home-next-layout.ts";
import { defaultModules, shownModules, toggleModule, writeModules } from "./module-layout.ts";

describe("homeState", () => {
  it("is none without a trip, ontrip while under way, else upcoming", () => {
    assert.equal(homeState(null, false), "none");
    assert.equal(homeState({}, true), "ontrip");
    assert.equal(homeState({}, false), "upcoming");
  });
});

describe("stateLayout", () => {
  it("starts from the state's defaults with no account layout", () => {
    assert.deepEqual(shownModules(stateLayout("ontrip", null, null)), [...STATE_DEFAULTS.ontrip]);
    assert.deepEqual(shownModules(stateLayout("none", null, null)), ["waiting", "trip", "future"]);
  });
  it("starts from the account's Home layout, narrowed to what the state can show", () => {
    const account = {
      order: ["notes", "trip", "saved", "weather", "future"] as const,
      on: new Set(["notes", "trip", "saved", "weather"] as const),
    };
    const acc = { order: [...account.order], on: account.on } as never;
    assert.deepEqual(shownModules(stateLayout("upcoming", null, acc)), [
      "notes",
      "trip",
      "saved",
      "weather",
    ]);
    // No trip: the trip modules are not offered.
    assert.deepEqual(shownModules(stateLayout("none", null, acc)), ["trip", "weather"]);
    // What the traveller switched off there stays off, the stop cards included.
    assert.ok(!stateLayout("ontrip", null, acc).on.has("stops"));
  });
  it("keeps an account layout with everything switched off", () => {
    const acc = { order: ["trip", "stops", "weather"], on: new Set() } as never;
    assert.deepEqual(shownModules(stateLayout("ontrip", null, acc)), []);
  });
  it("keeps each state's own list once saved, dropping what the state can't show", () => {
    const raw = writeModules({
      order: ["future", "saved", "trip"],
      on: new Set(["future", "saved"]),
    } as never);
    assert.deepEqual(shownModules(stateLayout("upcoming", raw, null)), [
      "future",
      "saved",
      "suggested",
    ]);
    assert.deepEqual(shownModules(stateLayout("none", raw, null)), ["future"]);
    for (const k of STATE_MODULES.upcoming)
      assert.ok(stateLayout("upcoming", raw, null).order.includes(k));
  });
});

describe("homeNextLayoutKey", () => {
  it("is one device key per state and account", () => {
    assert.equal(homeNextLayoutKey("ontrip", "u1"), "bea-home-next-layout-ontrip-u1");
    assert.equal(homeNextLayoutKey("none", undefined), "bea-home-next-layout-none-anon");
  });
});

describe("isUntouched", () => {
  const keys = ["trip", "stops", "now", "weather"] as const;
  const defaults = ["trip", "stops", "weather"] as const;
  it("is true for the app's default layout, false once anything changed", () => {
    const base = defaultModules(keys, defaults);
    assert.equal(isUntouched(base, keys, defaults), true);
    assert.equal(isUntouched(toggleModule(base, "now"), keys, defaults), false);
    assert.equal(
      isUntouched({ order: ["stops", "trip", "now", "weather"], on: base.on }, keys, defaults),
      false,
    );
  });
});
