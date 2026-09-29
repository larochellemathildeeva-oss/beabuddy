import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forgetScreens,
  lastLoaded,
  rememberLoaded,
  screenGeneration,
  screensBelongTo,
} from "./screen-cache.ts";

test("a screen gets back what it last loaded", () => {
  rememberLoaded("trips", { uid: "u1", trips: [1, 2] }, screenGeneration());
  assert.deepEqual(lastLoaded("trips"), { uid: "u1", trips: [1, 2] });
  assert.equal(lastLoaded("stops:none"), undefined);
});

test("signing out forgets everything", () => {
  rememberLoaded("trips", { uid: "u1" }, screenGeneration());
  rememberLoaded("stops:t1", [], screenGeneration());
  forgetScreens();
  assert.equal(lastLoaded("trips"), undefined);
  assert.equal(lastLoaded("stops:t1"), undefined);
});

test("a load still in flight at sign-out is not kept", () => {
  const started = screenGeneration();
  forgetScreens();
  rememberLoaded("trips", { uid: "u1" }, started);
  assert.equal(lastLoaded("trips"), undefined);
});

test("another account starts afresh, the same one keeps its screens", () => {
  screensBelongTo("u1");
  rememberLoaded("trips", { uid: "u1" }, screenGeneration());
  screensBelongTo("u1");
  assert.deepEqual(lastLoaded("trips"), { uid: "u1" });
  const started = screenGeneration();
  screensBelongTo("u2");
  assert.equal(lastLoaded("trips"), undefined);
  rememberLoaded("trips", { uid: "u1" }, started);
  assert.equal(lastLoaded("trips"), undefined);
});
