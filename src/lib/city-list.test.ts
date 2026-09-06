import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  applyCityHits,
  CITY_LIST_MAX,
  correctCityDraft,
  draftsToCities,
  parseCityListText,
  startCityDrafts,
} from "./city-list.ts";

test("parseCityListText keeps one city per line, including City, Country", () => {
  assert.deepEqual(parseCityListText("Paris, France\nRome, Italy\n"), ["Paris, France", "Rome, Italy"]);
});

test("parseCityListText splits a single comma-separated notes line", () => {
  assert.deepEqual(parseCityListText("Paris, Lisbon, Tokyo"), ["Paris", "Lisbon", "Tokyo"]);
});

test("parseCityListText does not split a lone City, Country pair", () => {
  assert.deepEqual(parseCityListText("Paris, France"), ["Paris, France"]);
});

test("parseCityListText strips bullets and drops duplicates", () => {
  assert.deepEqual(parseCityListText("- Paris\n* paris\n1. Lisbon\n"), ["Paris", "Lisbon"]);
});

test("parseCityListText caps the batch", () => {
  const names = Array.from({ length: CITY_LIST_MAX + 8 }, (_, i) => `City ${i}`).join("\n");
  assert.equal(parseCityListText(names).length, CITY_LIST_MAX);
});

test("draftsToCities saves the chosen pin as a city and skips the rest", () => {
  const [one, two] = startCityDrafts(["Lisbon", "Skip me"]);
  assert.ok(one && two);
  const ready = applyCityHits(one, [
    {
      name: "Lisbon",
      city: "Lisbon",
      country: "Portugal",
      source: "Web search",
      url: "https://osm.example/lisbon",
      lat: 38.72,
      lon: -9.14,
    },
  ]);
  two.skip = true;
  const saved = draftsToCities([ready, two], "visited", "Pasted list");
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.name, "Lisbon");
  assert.equal(saved[0]?.city, "Lisbon");
  assert.equal(saved[0]?.country, "Portugal");
  assert.equal(saved[0]?.category, "City");
  assert.equal(saved[0]?.pin_type, "visited");
  assert.equal(saved[0]?.source, "Pasted list");
  assert.equal(saved[0]?.lat, 38.72);
});

test("startCityDrafts recognises a country without a map search", () => {
  const [france, lisbon] = startCityDrafts(["France", "Lisbon"]);
  assert.ok(france && lisbon);
  assert.equal(france.status, "ready");
  assert.equal(france.hits[0]?.country, "France");
  assert.equal(france.hits[0]?.category, "country");
  assert.equal(lisbon.status, "pending");
});

test("parseCityListText keeps more than 19 countries", () => {
  const names = [
    "France",
    "Spain",
    "Italy",
    "Germany",
    "Portugal",
    "Greece",
    "Netherlands",
    "Belgium",
    "Austria",
    "Switzerland",
    "Poland",
    "Sweden",
    "Norway",
    "Denmark",
    "Finland",
    "Ireland",
    "United Kingdom",
    "Czechia",
    "Hungary",
    "Croatia",
    "USA",
    "Canada",
    "Mexico",
    "Japan",
    "Australia",
  ];
  assert.ok(names.length > 19);
  const parsed = parseCityListText(names.join("\n"));
  assert.equal(parsed.length, names.length);
  const drafts = startCityDrafts(parsed);
  assert.equal(drafts.filter((row) => row.status === "ready").length, names.length);
  const saved = draftsToCities(drafts, "visited", "Uploaded list");
  assert.equal(saved.length, names.length);
  assert.equal(saved[0]?.category, "Country");
  assert.equal(saved[20]?.country, "United States");
});

test("correctCityDraft turns an unknown name into a recognised country", () => {
  const [draft] = startCityDrafts(["Narnia"]);
  assert.ok(draft);
  const empty = applyCityHits(draft, []);
  assert.equal(empty.status, "empty");
  const fixed = correctCityDraft(empty, "Namibia");
  assert.equal(fixed.status, "ready");
  assert.equal(fixed.originalName, "Namibia");
  assert.equal(fixed.hits[0]?.country, "Namibia");
  assert.equal(fixed.skip, false);
});

test("correctCityDraft leaves a city name pending for a map search", () => {
  const [draft] = startCityDrafts(["Narnia"]);
  assert.ok(draft);
  const fixed = correctCityDraft(applyCityHits(draft, []), "Lisbon");
  assert.equal(fixed.status, "pending");
  assert.equal(fixed.query, "Lisbon");
  assert.equal(fixed.hits.length, 0);
});

test("draftsToCities drops a row with no coordinates", () => {
  const [draft] = startCityDrafts(["Atlantis"]);
  assert.ok(draft);
  const empty = applyCityHits(draft, []);
  assert.equal(draftsToCities([empty], "wishlist", "Pasted list").length, 0);
});
