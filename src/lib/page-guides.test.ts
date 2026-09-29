import { strict as assert } from "node:assert";
import { test } from "node:test";
import { guides } from "./page-guides.ts";

test("every page's help says what the page is for and what you can do", () => {
  for (const [path, guide] of Object.entries(guides)) {
    assert.ok(guide.about.trim(), `${path} has no overview line`);
    assert.ok(guide.features.length >= 2, `${path} lists fewer than two things to do`);
    for (const feature of guide.features) {
      assert.ok(feature.split(/\s+/).length <= 20, `${path}: "${feature}" is too long for a list`);
    }
  }
});

test("page help never calls itself the sparkle", () => {
  // The sparkle is Béa's AI mark; help is the "?".
  const blob = JSON.stringify(guides).toLowerCase();
  assert.ok(!blob.includes("sparkle"), "page help mentions the sparkle");
});
