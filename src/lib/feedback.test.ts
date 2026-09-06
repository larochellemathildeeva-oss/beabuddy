import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FEEDBACK_CATEGORIES, feedbackCategoryLabel, formatFeedbackMessage } from "./feedback.ts";

test("feedback categories are funny and unique", () => {
  assert.ok(FEEDBACK_CATEGORIES.length >= 5);
  const ids = FEEDBACK_CATEGORIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("formatFeedbackMessage puts the category above the note", () => {
  assert.equal(
    formatFeedbackMessage("broke", "  the button vanished  "),
    "It broke and I laughed\n\nthe button vanished",
  );
  assert.equal(formatFeedbackMessage("nope", "just a note"), "just a note");
});

test("feedbackCategoryLabel ignores unknown ids", () => {
  assert.equal(feedbackCategoryLabel("wish"), "A wish, whispered into the void");
  assert.equal(feedbackCategoryLabel("mystery"), null);
});
