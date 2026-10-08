import { test } from "node:test";
import assert from "node:assert/strict";
import { interestLine } from "./interest-line.ts";

test("joins interests into one sentence, as the You page shows them", () => {
  assert.equal(
    interestLine(["Food", "Architecture", "Quieter streets"]),
    "Food, architecture and quieter streets.",
  );
  assert.equal(interestLine(["Food"]), "Food.");
  assert.equal(interestLine([]), "");
});

test("keeps the line short: four interests at most", () => {
  assert.equal(interestLine(["A", "B", "C", "D", "E"]), "A, b, c and d.");
});
