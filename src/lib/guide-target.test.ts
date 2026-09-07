import { strict as assert } from "node:assert";
import { test } from "node:test";
import { guideTargetLooksVisible } from "./guide-target.ts";

test("guideTargetLooksVisible rejects empty shells", () => {
  assert.equal(
    guideTargetLooksVisible({ width: 0, height: 0 }, { display: "block", visibility: "visible" }),
    false,
  );
  assert.equal(
    guideTargetLooksVisible({ width: 320, height: 0 }, { display: "block", visibility: "visible" }),
    false,
  );
});

test("guideTargetLooksVisible rejects display:none and visibility:hidden", () => {
  assert.equal(
    guideTargetLooksVisible({ width: 100, height: 40 }, { display: "none", visibility: "visible" }),
    false,
  );
  assert.equal(
    guideTargetLooksVisible({ width: 100, height: 40 }, { display: "block", visibility: "hidden" }),
    false,
  );
});

test("guideTargetLooksVisible rejects near-zero opacity", () => {
  assert.equal(
    guideTargetLooksVisible(
      { width: 100, height: 40 },
      { display: "block", visibility: "visible", opacity: "0" },
    ),
    false,
  );
  assert.equal(
    guideTargetLooksVisible(
      { width: 100, height: 40 },
      { display: "block", visibility: "visible", opacity: "0.02" },
    ),
    false,
  );
});

test("guideTargetLooksVisible accepts a real painted box", () => {
  assert.equal(
    guideTargetLooksVisible({ width: 100, height: 40 }, { display: "block", visibility: "visible" }),
    true,
  );
  assert.equal(
    guideTargetLooksVisible(
      { width: 100, height: 40 },
      { display: "block", visibility: "visible", opacity: "1" },
    ),
    true,
  );
});
