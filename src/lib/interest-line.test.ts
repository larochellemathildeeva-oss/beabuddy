import { test } from "node:test";
import assert from "node:assert/strict";
import { interestLine } from "./interest-line.ts";

test("joins interests into one sentence, as the You page shows them", () => {
  assert.equal(
    interestLine(["Restaurants", "Architecture", "Markets"]),
    "Restaurants, architecture and markets.",
  );
  assert.equal(interestLine(["Museums"]), "Museums.");
  assert.equal(interestLine([]), "");
});

test("keeps the line short: four interests at most", () => {
  assert.equal(
    interestLine(["Hiking", "Beaches", "Nightlife", "Markets", "Shopping"]),
    "Hiking, beaches, nightlife and markets.",
  );
});

test("starts with a capital and keeps hand-typed names and acronyms as typed", () => {
  assert.equal(
    interestLine(["museums", "UNESCO sites", "Paris cafés"]),
    "Museums, UNESCO sites and Paris cafés.",
  );
});
