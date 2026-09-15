import { strict as assert } from "node:assert";
import { test } from "node:test";
import { addedLine, removedLine, restoredLine, undoFailedLine } from "./undo.ts";

test("removedLine names the one thing that went", () => {
  assert.equal(removedLine("Bar Raval"), "Removed Bar Raval.");
});

test("removedLine counts and pluralises a batch", () => {
  assert.equal(removedLine("stop", 3), "Removed 3 stops.");
  assert.equal(removedLine("entry", 2), "Removed 2 entries.");
  assert.equal(removedLine("match", 2), "Removed 2 matches.");
});

test("a count of one keeps the singular", () => {
  assert.equal(removedLine("stop", 1), "Removed stop.");
});

test("addedLine reports a bulk save", () => {
  assert.equal(addedLine("stop", 14), "Added 14 stops.");
  assert.equal(addedLine("place", 1), "Added 1 place.");
});

test("restoredLine confirms the undo", () => {
  assert.equal(restoredLine("Bar Raval"), "Put Bar Raval back.");
  assert.equal(restoredLine("stop", 3), "Put 3 stops back.");
});

test("undoFailedLine admits it without blaming the user", () => {
  assert.equal(
    undoFailedLine("Bar Raval"),
    "Couldn't put Bar Raval back. It may need adding again by hand.",
  );
});

test("pluralising leaves an already-plural-looking word alone", () => {
  // "city" → "cities", not "citys"
  assert.equal(removedLine("city", 2), "Removed 2 cities.");
  // A vowel before the y keeps the s: "day" → "days"
  assert.equal(removedLine("day", 2), "Removed 2 days.");
});
