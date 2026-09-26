import { test } from "node:test";
import assert from "node:assert/strict";
import { closeSuggestions, nameSimilarity, suggestionPrefixes } from "./place-suggest.ts";

test("a misspelt name is asked for again, cut short", () => {
  assert.deepEqual(suggestionPrefixes("Miyajma"), ["Miyaj", "Miya"]);
  assert.deepEqual(suggestionPrefixes("Peace Memoral"), ["Peace Memor", "Peace Memo"]);
  assert.deepEqual(suggestionPrefixes("Nara"), [], "too short to cut");
  assert.deepEqual(suggestionPrefixes("Kyoto"), [], "cutting leaves under four letters");
});

test("only names close to what was typed are offered", () => {
  const found = [
    { name: "Miyajima" },
    { name: "Miyajimaguchi" },
    { name: "Miyazaki" },
    { name: "Miyajima" },
    { name: "Hatsukaichi" },
  ];
  const offered = closeSuggestions(found, "Miyajma").map((p) => p.name);
  assert.equal(offered[0], "Miyajima", "the closest first");
  assert.ok(!offered.includes("Hatsukaichi"), "merely nearby is not offered");
  assert.equal(offered.filter((n) => n === "Miyajima").length, 1, "one per name");
});

test("the name typed is not offered back", () => {
  assert.deepEqual(closeSuggestions([{ name: "Miyajima" }], "miyajima"), []);
});

test("an extra word in the real name does not hide it", () => {
  assert.ok(nameSimilarity("peace memoral park", "Hiroshima Peace Memorial Park") >= 0.5);
  assert.ok(nameSimilarity("Fushmi Inari", "Fushimi Inari Taisha") >= 0.5);
});
