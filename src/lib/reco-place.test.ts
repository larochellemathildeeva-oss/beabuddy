import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  hiddenFromRecs,
  isAreaPlace,
  isCityLevelPlace,
  isCountryLevelPlace,
  recMatchesPlace,
  uniqueRecCities,
} from "./reco-place.ts";

test("isCityLevelPlace treats Nominatim cities and hand-added City rows as places", () => {
  assert.equal(isCityLevelPlace({ name: "Paris", city: "Paris", category: "city" }), true);
  assert.equal(isCityLevelPlace({ name: "Lisbon", city: "Lisbon", category: "City" }), true);
  assert.equal(
    isCityLevelPlace({ name: "Montreal", city: "Montreal, Quebec, Canada", category: "Place" }),
    true,
  );
});

test("isCountryLevelPlace treats a country pin as a country, not a city", () => {
  const france = { name: "France", city: "France", country: "France", category: "Country" };
  assert.equal(isCountryLevelPlace(france), true);
  assert.equal(isCityLevelPlace(france), false);
});

test("isCityLevelPlace keeps real venue recs", () => {
  assert.equal(
    isCityLevelPlace({ name: "Joe Beef", city: "Montreal", category: "restaurant" }),
    false,
  );
  assert.equal(isCityLevelPlace({ name: "Hôtel Costes", city: "Paris", category: "hotel" }), false);
  assert.equal(isCityLevelPlace({ name: "Paris", city: "Paris", category: "restaurant" }), false);
});

test("uniqueRecCities skips country pins", () => {
  assert.deepEqual(
    uniqueRecCities([
      { name: "France", city: "France", country: "France", category: "Country" },
      { name: "Joe Beef", city: "Montreal", country: "Canada", category: "restaurant" },
    ]),
    ["Montreal"],
  );
});

test("uniqueRecCities is derived from the city field, not from city-as-pin rows only", () => {
  assert.deepEqual(
    uniqueRecCities([
      { name: "Joe Beef", city: "Montreal", country: "Canada", category: "restaurant" },
      { name: "Café de Flore", city: "Paris", country: "France", category: "cafe" },
      { name: "Paris", city: "Paris", country: "France", category: "city" },
      { name: "Le Comptoir", city: "Paris", country: "France", category: "restaurant" },
    ]),
    ["Montreal", "Paris"],
  );
});

test("uniqueRecCities disambiguates the same city name in two countries", () => {
  assert.deepEqual(
    uniqueRecCities([
      { name: "Springfield Inn", city: "Springfield", country: "United States" },
      { name: "The Mill", city: "Springfield", country: "United Kingdom" },
    ]),
    ["Springfield, United Kingdom", "Springfield, United States"],
  );
});

test("recMatchesPlace filters venues in that city and ignores name collisions", () => {
  const flore = { name: "Café de Flore", city: "Paris", country: "France", category: "cafe" };
  const joe = { name: "Joe Beef", city: "Montreal", country: "Canada", category: "restaurant" };
  assert.equal(recMatchesPlace(flore, "All places"), true);
  assert.equal(recMatchesPlace(flore, "Paris"), true);
  assert.equal(recMatchesPlace(joe, "Paris"), false);
  assert.equal(recMatchesPlace(flore, "Paris, France"), true);
});

test("isAreaPlace keeps countries and cities off the Recs list, venues on it", () => {
  assert.equal(
    isAreaPlace({ name: "Portugal", city: "Portugal", country: "Portugal", category: "Country" }),
    true,
  );
  assert.equal(isAreaPlace({ name: "Lisbon", city: "Lisbon", category: "City" }), true);
  assert.equal(
    isAreaPlace({ name: "Time Out Market", city: "Lisbon", country: "Portugal", category: "Food" }),
    false,
  );
});

test("hiddenFromRecs hides a visited country but keeps a wishlist one", () => {
  const japan = { name: "Japan", city: "Japan", country: "Japan", category: "Country" };
  assert.equal(hiddenFromRecs(japan, "visited"), true);
  assert.equal(hiddenFromRecs(japan, "wishlist"), false);
  assert.equal(hiddenFromRecs(japan, "nexttime"), false);
  assert.equal(
    hiddenFromRecs({ name: "Kyoto", city: "Kyoto", category: "City" }, "wishlist"),
    true,
  );
  assert.equal(
    hiddenFromRecs(
      { name: "Ichiran", city: "Kyoto", country: "Japan", category: "Food" },
      "visited",
    ),
    false,
  );
});
