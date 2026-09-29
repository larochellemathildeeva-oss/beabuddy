import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyStopPictures, asStopPictures } from "./stop-pictures.ts";

test("stop pictures default to illustrations and read safely", () => {
  assert.equal(asStopPictures(null), "illustrations");
  assert.equal(asStopPictures("paintings"), "illustrations");
  assert.equal(asStopPictures("photos"), "photos");
  assert.equal(asStopPictures("none"), "none");
});

test("the setting lands on <html> unless it is the default", () => {
  const root = { dataset: {} as DOMStringMap };
  applyStopPictures("none", root);
  assert.equal(root.dataset["pictures"], "none");
  applyStopPictures("photos", root);
  assert.equal(root.dataset["pictures"], "photos");
  applyStopPictures("illustrations", root);
  assert.equal(root.dataset["pictures"], undefined);
});
