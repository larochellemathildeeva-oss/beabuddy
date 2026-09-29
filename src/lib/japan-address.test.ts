import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  japaneseAddressQueries,
  japaneseDistrict,
  namesJapan,
  outsideAddressDistrict,
} from "./japan-address.ts";

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

test("outsideAddressDistrict: a namesake in another district is caught", () => {
  assert.equal(japaneseDistrict("2-14-3 Yoyogi"), "Yoyogi");
  assert.equal(japaneseDistrict("1-1 Yoyogikamizonocho", true), "Yoyogikamizonocho");
  assert.equal(japaneseDistrict("97 Wythe Ave"), null);
  const kichijoji =
    "風雲児, Diamond Street - East Zone, Kichijoji-honcho 1-chome, Kichijoji Honcho, Musashino, Tokyo, 180-0000, Japan";
  assert.equal(outsideAddressDistrict("2-14-3 Yoyogi", kichijoji), "Yoyogi");
  // Macrons and hyphens are the same district.
  const umedaSky =
    "Umeda Sky Building, Osaka Itami Line, Ōyodo-Naka 1, Kita Ward, Osaka, Osaka Prefecture, 531-0076, Japan";
  assert.equal(outsideAddressDistrict("1-1-88 Oyodonaka", umedaSky), null);
  const omoide =
    "Omoide-yokochō, Nishi-Shinjuku 1, Nishi-Shinjuku, Shinjuku, Tokyo, 160-0023, Japan";
  assert.equal(outsideAddressDistrict("1-2 Nishishinjuku", omoide), null);
  // Outside Japan, or with no block address, it says nothing.
  assert.equal(outsideAddressDistrict("12-34 45th Ave", "Queens, New York, USA"), null);
  assert.equal(outsideAddressDistrict(null, kichijoji), null);
});
