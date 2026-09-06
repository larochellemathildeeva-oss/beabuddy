import { strict as assert } from "node:assert";
import { test } from "node:test";
import { HELP_FAQ_GROUPS } from "./help-faq.ts";

test("FAQ covers the extra features the tour also walks", () => {
  const blob = HELP_FAQ_GROUPS.flatMap((g) => g.items)
    .map((item) => `${item.q} ${item.a}`)
    .join(" ")
    .toLowerCase();
  for (const needle of [
    "deep dive",
    "quick walk around the block",
    "customize home",
    "travel preferences",
    "flying solo",
    "join with a code",
    "tentative",
    "budget",
    "packing",
    "day trip",
    "travel tags",
    "heatmap",
    "add a city",
    "travel story",
    "future me",
    "offline directions",
    "copyright",
    "feedback",
    "does not book",
    "exact map spot",
  ]) {
    assert.ok(blob.includes(needle), `FAQ should mention ${needle}`);
  }
});
