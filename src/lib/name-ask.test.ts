import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dismissNameAsk, shouldAskName } from "./name-ask.ts";

function store() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

const base = { userId: "u1", email: "jane.doe@example.com", profileLoaded: true };

test("asks while the name is the email's first half or empty", () => {
  assert.equal(shouldAskName(store(), { ...base, profileName: "jane.doe" }), true);
  assert.equal(shouldAskName(store(), { ...base, profileName: "  " }), true);
});

test("does not ask once a real name is set", () => {
  assert.equal(shouldAskName(store(), { ...base, profileName: "Jane" }), false);
});

test("does not ask before the profile has answered", () => {
  assert.equal(shouldAskName(store(), { ...base, profileLoaded: false, profileName: "" }), false);
});

test("does not ask again after Not now", () => {
  const s = store();
  dismissNameAsk(s, "u1");
  assert.equal(shouldAskName(s, { ...base, profileName: "jane.doe" }), false);
  assert.equal(shouldAskName(s, { ...base, userId: "u2", profileName: "jane.doe" }), true);
});
