import assert from "node:assert/strict";
import { test } from "node:test";
import { fitWithin } from "./strip-image-meta.ts";

test("a photo that already fits is left at its size", () => {
  assert.deepEqual(fitWithin(1200, 800, 1600), { width: 1200, height: 800 });
  assert.deepEqual(fitWithin(1600, 900, 1600), { width: 1600, height: 900 });
});

test("a large landscape photo is scaled to the longest side", () => {
  assert.deepEqual(fitWithin(4032, 3024, 1600), { width: 1600, height: 1200 });
});

test("a large portrait photo is scaled to the longest side", () => {
  assert.deepEqual(fitWithin(3024, 4032, 1600), { width: 1200, height: 1600 });
});

test("an extreme panorama keeps at least one pixel on its short side", () => {
  assert.deepEqual(fitWithin(40000, 10, 1600), { width: 1600, height: 1 });
});

test("a zero or invalid size is returned as it is", () => {
  assert.deepEqual(fitWithin(0, 0, 1600), { width: 0, height: 0 });
});
