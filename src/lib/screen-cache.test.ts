import assert from "node:assert/strict";
import { test } from "node:test";
import { forgetScreens, lastLoaded, rememberLoaded } from "./screen-cache.ts";

test("a screen gets back what it last loaded", () => {
  rememberLoaded("trips", { uid: "u1", trips: [1, 2] });
  assert.deepEqual(lastLoaded("trips"), { uid: "u1", trips: [1, 2] });
  assert.equal(lastLoaded("stops:none"), undefined);
});

test("signing out forgets everything", () => {
  rememberLoaded("trips", { uid: "u1" });
  rememberLoaded("stops:t1", []);
  forgetScreens();
  assert.equal(lastLoaded("trips"), undefined);
  assert.equal(lastLoaded("stops:t1"), undefined);
});
