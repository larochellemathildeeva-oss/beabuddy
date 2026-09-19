import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hasDenseScript, minimumNameLength, startsLikeAName, wordCount } from "./script.ts";

test("startsLikeAName accepts a proper noun in any script", () => {
  for (const name of [
    "Olive et Gourmando",
    "Ōsaka Station",
    "浅草の寺",
    "Эрмитажная площадь",
    "Ακρόπολη Αθηνών",
    "서울 강남구",
    "مسجد الشيخ زايد",
    "วัดพระแก้ว",
    "1038 Canada Place",
  ]) {
    assert.equal(startsLikeAName(name), true, `${name} should read as a name`);
  }
});

test("startsLikeAName still rejects a sentence about a place", () => {
  // The rule that made "browse the market" not a place is the one being kept.
  for (const phrase of ["browse the market", "explore the old town", "take the ferry"]) {
    assert.equal(startsLikeAName(phrase), false, `${phrase} should not read as a name`);
  }
});

test("startsLikeAName ignores leading punctuation and empty text", () => {
  assert.equal(startsLikeAName("  "), false);
  assert.equal(startsLikeAName("— somewhere"), false);
});

test("hasDenseScript spots the scripts that pack a word into a character", () => {
  assert.equal(hasDenseScript("京都"), true);
  assert.equal(hasDenseScript("あさくさ"), true);
  assert.equal(hasDenseScript("서울"), true);
  assert.equal(hasDenseScript("Kyoto"), false);
  assert.equal(hasDenseScript("Эрмитаж"), false);
});

test("minimumNameLength lets a two-character city through", () => {
  assert.equal(minimumNameLength("京都"), 2);
  assert.equal(minimumNameLength("Kyoto"), 4);
});

test("wordCount does not read a wall of kanji as a single tidy word", () => {
  assert.equal(wordCount("Olive et Gourmando"), 3);
  assert.equal(wordCount("浅草寺"), 1);
  assert.ok(wordCount("東京都台東区浅草二丁目三番一号浅草寺本堂前") > 6);
  assert.equal(wordCount(""), 0);
});
