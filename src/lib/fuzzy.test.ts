import { strict as assert } from "node:assert";
import { test } from "node:test";
import { foldAccents, fuzzyRank, fuzzyScore, levenshtein } from "./fuzzy.ts";

test("foldAccents strips diacritics and normalises spacing", () => {
  assert.equal(foldAccents("Café  Cõrrer"), "cafe correr");
  assert.equal(foldAccents("  ÎLE de Ré "), "ile de re");
  assert.equal(foldAccents("Tokyo"), "tokyo");
});

test("levenshtein counts edits and honours its bound", () => {
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("same", "same"), 0);
  assert.equal(levenshtein("", "abc"), 3);
  // Bounded: once it cannot come back under max it may stop early, and must
  // report something above max rather than the true distance.
  assert.ok(levenshtein("abcdefgh", "zzzzzzzz", 2) > 2);
});

test("fuzzyScore ranks exact over prefix over substring", () => {
  assert.equal(fuzzyScore("Tokyo", "tokyo"), 1);
  assert.ok(fuzzyScore("Tokyo Ramen", "tokyo") > fuzzyScore("Best Tokyo Ramen", "tokyo"));
});

test("fuzzyScore matches through accents the traveller will not type", () => {
  assert.ok(fuzzyScore("Café Correr", "cafe") > 0.5);
  assert.ok(fuzzyScore("Île de Ré", "ile de re") === 1);
});

test("fuzzyScore forgives a typo but not an unrelated word", () => {
  assert.ok(fuzzyScore("Guggenheim Museum", "gugenheim") > 0.3);
  assert.equal(fuzzyScore("Guggenheim Museum", "xyz"), 0);
});

test("fuzzyScore requires every query token to land somewhere", () => {
  // "cafe" alone matches, but the second token does not, so the whole query fails.
  assert.equal(fuzzyScore("Café Correr", "cafe xyzzy"), 0);
});

test("fuzzyRank filters non-matches and keeps stable order on ties", () => {
  const rows = [
    { name: "Tokyo Ramen", city: "Tokyo" },
    { name: "Café Correr", city: "Lisbon" },
    { name: "Ramen Bar", city: "Tokyo" },
  ];
  const ranked = fuzzyRank(rows, "tokyo", (r) => [r.name, r.city]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]?.name, "Tokyo Ramen");
  assert.equal(ranked[1]?.name, "Ramen Bar");
});

test("fuzzyRank returns everything for an empty query and tolerates null fields", () => {
  const rows = [{ name: "A", note: null }, { name: "B", note: undefined }];
  assert.equal(fuzzyRank(rows, "   ", (r) => [r.name, r.note]).length, 2);
  assert.equal(fuzzyRank(rows, "a", (r) => [r.name, r.note]).length, 1);
});
