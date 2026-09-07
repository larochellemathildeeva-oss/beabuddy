import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AI_IMAGE_MAX_CHARS } from "./image.ts";

test("AI_IMAGE_MAX_CHARS stays under the Zod / proxy soft ceiling", () => {
  assert.ok(AI_IMAGE_MAX_CHARS <= 1_500_000);
  assert.ok(AI_IMAGE_MAX_CHARS < 3_000_000);
});
