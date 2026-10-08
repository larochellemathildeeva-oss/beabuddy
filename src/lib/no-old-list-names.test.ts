import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Screens and help name three lists: Recommendation, Bucket list, Been there.
const COPY = [
  "components/HowItWorksFigures.tsx",
  "lib/how-it-works.ts",
  "lib/page-guides.ts",
  "lib/help-faq.ts",
];

test("help and guides use the list names the screens use", () => {
  for (const file of COPY) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    // `bg-wishlist` is a colour token, not words on screen.
    assert.ok(!/Wishlist|(?<!-)wishlist[ ,.?!]/.test(source), `${file} still says wishlist`);
    assert.ok(
      !/Next time,|, Next time|"Next time"|next time, /.test(source),
      `${file} still names the Next time list`,
    );
    assert.ok(!/"Visited"|Visited,/.test(source), `${file} still says Visited`);
  }
});
