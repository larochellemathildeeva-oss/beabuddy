import { strict as assert } from "node:assert";
import { test } from "node:test";
import { WORLD_COUNTRY_COUNT } from "./travel-stats.ts";
import { matchWorldCountry, placeFromWorldCountry, WORLD_COUNTRIES } from "./world-countries.ts";

test("WORLD_COUNTRIES covers the 195 used for the world-share counter", () => {
  const names = new Set(WORLD_COUNTRIES.map((row) => row.name));
  assert.ok(
    names.size >= WORLD_COUNTRY_COUNT,
    `expected at least ${WORLD_COUNTRY_COUNT} countries`,
  );
});

test("matchWorldCountry accepts official names and common aliases", () => {
  assert.equal(matchWorldCountry("France")?.name, "France");
  assert.equal(matchWorldCountry("USA")?.name, "United States");
  assert.equal(matchWorldCountry("United States of America")?.name, "United States");
  assert.equal(matchWorldCountry("UK")?.name, "United Kingdom");
  assert.equal(matchWorldCountry("Ivory Coast")?.name, "Côte d'Ivoire");
  assert.equal(matchWorldCountry("Côte d'Ivoire")?.name, "Côte d'Ivoire");
  assert.equal(matchWorldCountry("Korea")?.name, "South Korea");
});

test("matchWorldCountry does not treat a city line as a country", () => {
  assert.equal(matchWorldCountry("Paris, France"), null);
  assert.equal(matchWorldCountry("Lisbon"), null);
});

test("placeFromWorldCountry pins the country on the globe", () => {
  const france = matchWorldCountry("France");
  assert.ok(france);
  const place = placeFromWorldCountry(france);
  assert.equal(place.category, "country");
  assert.equal(place.country, "France");
  assert.ok(Number.isFinite(place.lat));
  assert.ok(Number.isFinite(place.lon));
});

test("a country with trailing punctuation or half typed is still the country", async () => {
  const { localPlaceHits, countriesStartingWith } = await import("./world-countries.ts");
  assert.equal(localPlaceHits("Japan,")[0]?.name, "Japan");
  assert.equal(localPlaceHits("Japan.")[0]?.name, "Japan");
  assert.deepEqual(
    countriesStartingWith("Jap").map((c) => c.name),
    ["Japan"],
  );
  assert.deepEqual(
    countriesStartingWith("Japa").map((c) => c.name),
    ["Japan"],
  );
  assert.deepEqual(countriesStartingWith("Ja"), []);
  assert.ok(countriesStartingWith("Ital").some((c) => c.name === "Italy"));
  // A city is not turned into a country.
  assert.equal(localPlaceHits("Paris, France").length, 0);
});
