import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  PLAN_PRIORITIES,
  budgetFor,
  comparePriorities,
  paceFor,
  prioritiesLine,
  withPriorities,
} from "./plan-priorities.ts";

test("prioritiesLine lists the picks in the tiles' order", () => {
  assert.equal(
    prioritiesLine(["budget", "closest"]),
    "What matters most to me: places close together, little backtracking; easy on the budget.",
  );
  assert.equal(prioritiesLine([]), "");
  assert.equal(
    prioritiesLine(["rest"], "  vegetarian food "),
    "What matters most to me: one clearly quieter day; vegetarian food.",
  );
  assert.equal(prioritiesLine([], "kid-friendly"), "What matters most to me: kid-friendly.");
});

test("withPriorities puts the line after the traveller's words", () => {
  assert.equal(withPriorities("  A cooking class  ", []), "A cooking class");
  assert.equal(
    withPriorities("A cooking class", ["rest"]),
    "A cooking class\n\nWhat matters most to me: one clearly quieter day.",
  );
  assert.equal(withPriorities("", ["rest"]), "What matters most to me: one clearly quieter day.");
});

test("pace and budget follow the picks, and are left to preferences otherwise", () => {
  assert.equal(paceFor(["easy-morning"]), "relaxed");
  assert.equal(paceFor(["rest", "food"]), "relaxed");
  assert.equal(paceFor(["closest"]), null);
  assert.equal(budgetFor(["budget"]), "value");
  assert.equal(budgetFor([]), null);
});

test("comparePriorities joins picks and typed words, within the limit", () => {
  assert.equal(
    comparePriorities(["food"], " no early flights "),
    "days arranged around good meals; no early flights",
  );
  assert.equal(comparePriorities([], ""), "");
  assert.equal(comparePriorities(["food"], "x".repeat(500)).length, 400);
  // Every pick and a long note: the note arrives whole, picks give way.
  const all = PLAN_PRIORITIES.map((p) => p.id);
  const note = "y".repeat(300);
  const out = comparePriorities(all, note);
  assert.ok(out.length <= 400);
  assert.ok(out.endsWith(note));
});
