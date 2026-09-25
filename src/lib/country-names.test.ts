import { strict as assert } from "node:assert";
import { test } from "node:test";
import { countryCode, countryDisplayName, countryKey } from "./country-names.ts";

test("one country, in any language", () => {
  for (const name of [
    "Japan",
    "japon",
    "Japón",
    "日本",
    "Japonia",
    "Япония",
    "일본",
    "اليابان",
    "Giappone",
  ]) {
    assert.equal(countryCode(name), "JP", name);
  }
  for (const name of [
    "USA",
    "U.S.A.",
    "United States",
    "United States of America",
    "États-Unis",
    "Estados Unidos",
    "アメリカ合衆国",
    "美国",
    "Vereinigte Staaten",
  ]) {
    assert.equal(countryCode(name), "US", name);
  }
  for (const name of ["Germany", "Deutschland", "Allemagne", "Alemania", "ドイツ"]) {
    assert.equal(countryCode(name), "DE", name);
  }
  for (const name of ["Côte d'Ivoire", "Cote d’Ivoire", "Ivory Coast"]) {
    assert.equal(countryCode(name), "CI", name);
  }
  assert.equal(countryCode("Canada"), "CA");
  assert.equal(countryCode("Québec"), null, "a province is not a country");
  assert.equal(countryCode("jp"), "JP");
  assert.equal(countryCode(""), null);
});

test("the globe's shortened outline names are countries too", () => {
  assert.equal(countryCode("Dem. Rep. Congo"), "CD");
  assert.equal(countryCode("Bosnia and Herz."), "BA");
  assert.equal(countryCode("United Kingdom"), "GB");
  assert.equal(countryCode("Czechia"), "CZ");
  assert.equal(countryCode("eSwatini"), "SZ");
});

test("an unknown spelling still has a key, and names display in one language", () => {
  assert.equal(countryKey("Japon"), countryKey("日本"));
  assert.equal(countryKey("Narnia"), "narnia");
  assert.equal(countryDisplayName("Japon"), "Japan");
  assert.equal(countryDisplayName("日本", "fr"), "Japon");
  assert.equal(countryDisplayName("Narnia"), "Narnia");
});
