import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AI_IMAGE_MAX_CHARS, isWithinAiImageBudget } from "./image.ts";

test("AI_IMAGE_MAX_CHARS stays under the Zod / proxy soft ceiling", () => {
  assert.ok(AI_IMAGE_MAX_CHARS <= 1_500_000);
  assert.ok(AI_IMAGE_MAX_CHARS < 3_000_000);
});

test("isWithinAiImageBudget rejects outputs over AI_IMAGE_MAX_CHARS", () => {
  const prefix = "data:image/jpeg;base64,";
  const ok = prefix + "a".repeat(100);
  assert.equal(isWithinAiImageBudget(ok), true);

  const tooBig = prefix + "a".repeat(AI_IMAGE_MAX_CHARS);
  assert.ok(tooBig.length > AI_IMAGE_MAX_CHARS);
  assert.equal(isWithinAiImageBudget(tooBig), false);

  // Former soft fallback (Zod's 3M) must still fail the AI budget.
  const underZodButOverBudget = prefix + "a".repeat(AI_IMAGE_MAX_CHARS + 10);
  assert.ok(underZodButOverBudget.length < 3_000_000);
  assert.equal(isWithinAiImageBudget(underZodButOverBudget), false);
});
