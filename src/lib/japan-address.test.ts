import { strict as assert } from "node:assert";
import { test } from "node:test";
import { japaneseAddressQueries, namesJapan } from "./japan-address.ts";

test("a chōme-block-building address is rewritten the way the map reads it", () => {
  assert.deepEqual(japaneseAddressQueries("2-3-23 Shinsaibashisuji"), [
    "Shinsaibashisuji 2-chome 3-23",
    "Shinsaibashisuji 2-chome",
  ]);
});

test("the town after the comma is kept", () => {
  assert.deepEqual(japaneseAddressQueries("2-3-23 Shinsaibashisuji, Chuo Ward, Osaka"), [
    "Shinsaibashisuji 2-chome 3-23, Chuo Ward, Osaka",
    "Shinsaibashisuji 2-chome, Chuo Ward, Osaka",
  ]);
});

test("Google's and the name-first spellings are read too", () => {
  assert.equal(
    japaneseAddressQueries("2-chōme-3-23 Shinsaibashisuji")[0],
    "Shinsaibashisuji 2-chome 3-23",
  );
  assert.equal(
    japaneseAddressQueries("Shinsaibashisuji 2-3-23")[0],
    "Shinsaibashisuji 2-chome 3-23",
  );
  assert.equal(
    japaneseAddressQueries("Higashi-Shinsaibashi 1-chome 5-3")[0],
    "Higashi-Shinsaibashi 1-chome 5-3",
  );
});

test("a two-number address counts only in Japan", () => {
  assert.deepEqual(japaneseAddressQueries("12-34 Main Street"), []);
  assert.equal(japaneseAddressQueries("1-5 Namba", true)[0], "Namba 1-chome 5");
});

test("ordinary addresses and names are left alone", () => {
  assert.deepEqual(japaneseAddressQueries("172 Boulevard Saint-Germain"), []);
  assert.deepEqual(japaneseAddressQueries("Excelsior Caffé Shinsaibashi"), []);
  assert.deepEqual(japaneseAddressQueries("7-Eleven Namba"), []);
});

test("namesJapan reads the trip's area", () => {
  assert.equal(namesJapan("Osaka, Osaka Prefecture, Japan"), true);
  assert.equal(namesJapan("大阪, 日本"), true);
  assert.equal(namesJapan("Paris, France"), false);
  assert.equal(namesJapan(null), false);
});
