import { strict as assert } from "node:assert";
import { test } from "node:test";
import { continentOf, visitedContinents } from "./continents.ts";
import { countryKey } from "./country-names.ts";
import { WORLD_COUNTRIES } from "./world-countries.ts";

test("every country on the country list has a continent", () => {
  const missing = WORLD_COUNTRIES.filter((c) => !continentOf(countryKey(c.name))).map(
    (c) => c.name,
  );
  assert.deepEqual(missing, []);
});

test("a country is in its continent, whatever language it was saved in", () => {
  assert.equal(continentOf(countryKey("Canada")), "North America");
  assert.equal(continentOf(countryKey("États-Unis")), "North America");
  assert.equal(continentOf(countryKey("England")), "Europe");
  assert.equal(continentOf(countryKey("Japon")), "Asia");
  assert.equal(continentOf(countryKey("Brasil")), "South America");
  assert.equal(continentOf(countryKey("Australia")), "Oceania");
  assert.equal(continentOf(countryKey("Maroc")), "Africa");
  assert.equal(continentOf(countryKey("Costa Rica")), "North America");
  assert.equal(continentOf("atlantis"), null);
  assert.equal(continentOf(""), null);
});

test("the continents you have been to, each with its countries", () => {
  const visits = [
    { key: countryKey("Canada"), country: "Canada" },
    { key: countryKey("France"), country: "France" },
    { key: countryKey("USA"), country: "United States" },
    { key: "atlantis", country: "Atlantis" },
  ];
  assert.deepEqual(visitedContinents(visits), [
    { continent: "Europe", countries: ["France"] },
    { continent: "North America", countries: ["Canada", "United States"] },
  ]);
});
