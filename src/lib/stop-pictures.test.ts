import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyStopPictures, asStopPictures } from "./stop-pictures.ts";

test("stop pictures default to illustrations and read safely", () => {
  assert.equal(asStopPictures(null), "illustrations");
  assert.equal(asStopPictures("photos"), "illustrations");
  assert.equal(asStopPictures("none"), "none");
});

test("the setting lands on <html> only when pictures are off", () => {
  const root = { dataset: {} as DOMStringMap };
  applyStopPictures("none", root);
  assert.equal(root.dataset["pictures"], "none");
  applyStopPictures("illustrations", root);
  assert.equal(root.dataset["pictures"], undefined);
});
