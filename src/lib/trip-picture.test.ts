import { test } from "node:test";
import assert from "node:assert/strict";
import { asTripPicture } from "./trip-picture.ts";

test("asTripPicture reads Photo, and anything else as Stops", () => {
  assert.equal(asTripPicture("photo"), "photo");
  assert.equal(asTripPicture("stops"), "stops");
  assert.equal(asTripPicture(null), "stops");
  assert.equal(asTripPicture("map"), "stops");
});
