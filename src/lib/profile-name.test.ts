import assert from "node:assert/strict";
import { test } from "node:test";
import { rememberedProfileName, rememberProfileName, shownName } from "./profile-name.ts";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

test("no email while the profile is still loading", () => {
  assert.equal(shownName({ profileName: "", profileLoaded: false, email: "sam@x.com" }), "");
});

test("the email stands in once the profile has no name", () => {
  assert.equal(shownName({ profileName: "", profileLoaded: true, email: "sam@x.com" }), "sam");
});

test("the profile name wins", () => {
  assert.equal(
    shownName({ profileName: "Mathilde", profileLoaded: false, email: "m@x.com" }),
    "Mathilde",
  );
});

test("a remembered name comes back for the same user only", () => {
  const storage = fakeStorage();
  rememberProfileName(storage, "u1", " Mathilde ");
  assert.equal(rememberedProfileName(storage, "u1"), "Mathilde");
  assert.equal(rememberedProfileName(storage, "u2"), "");
  rememberProfileName(storage, "u1", "");
  assert.equal(storage.map.size, 0);
});
