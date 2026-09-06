import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isCityLevelPlace, recMatchesPlace, uniqueRecCities } from "./reco-place.ts";

test("isCityLevelPlace treats Nominatim cities and hand-added City rows as places", () => {
  assert.equal(isCityLevelPlace({ name: "Paris", city: "Paris", category: "city" }), true);
  assert.equal(isCityLevelPlace({ name: "Lisbon", city: "Lisbon", category: "City" }), true);
  assert.equal(isCityLevelPlace({ name: "Montreal", city: "Montreal, Quebec, Canada", category: "Place" }), true);
});

test("isCityLevelPlace keeps real venue recs", () => {
  assert.equal(
    isCityLevelPlace({ name: "Joe Beef", city: "Montreal", category: "restaurant" }),
    false,
  );
  assert.equal(
    isCityLevelPlace({ name: "Hôtel Costes", city: "Paris", category: "hotel" }),
    false,
  );
  assert.equal(
    isCityLevelPlace({ name: "Paris", city: "Paris", category: "restaurant" }),
    false,
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
