import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  addressLine,
  capturedFromParsedPlace,
  capturedFromReco,
  comparableName,
  findDuplicate,
  isSamePlace,
  normalizePlaceName,
  partitionNew,
  previewKind,
  toNewReco,
  toNewStop,
  toTimelineItem,
} from "./captured-place.ts";

const flore = {
  name: "Café de Flore",
  address: "172 Boulevard Saint-Germain, Paris",
  city: "Paris",
  country: "France",
  placeType: "cafe",
  category: "amenity",
  lat: 48.854,
  lon: 2.332,
  source: "Web search",
  url: "https://example.org/flore",
};

test("normalizePlaceName folds accents, case and punctuation", () => {
  assert.equal(normalizePlaceName("Café de Flore"), "cafe de flore");
  // An apostrophe closes up rather than splitting, so "Joe's" matches "Joes".
  assert.equal(normalizePlaceName("Joe's Diner!"), "joes diner");
});

test("comparableName drops a leading article", () => {
  assert.equal(comparableName("The Eiffel Tower"), "eiffel tower");
  assert.equal(comparableName("La Sagrada Família"), "sagrada familia");
});

test("comparableName drops only one leading article", () => {
  assert.equal(comparableName("The The"), "the");
});

// ── duplicate detection ─────────────────────────────────────────────────────

test("the same venue saved twice is one place", () => {
  assert.equal(
    isSamePlace(
      { name: "Café de Flore", lat: 48.854, lon: 2.332 },
      { name: "Cafe de Flore", lat: 48.8541, lon: 2.3321 },
    ),
    true,
  );
});

test("two pins on the same spot match even when the names differ", () => {
  assert.equal(
    isSamePlace(
      { name: "Sagrada Familia", lat: 41.4036, lon: 2.1744 },
      { name: "Basílica de la Sagrada Família", lat: 41.4036, lon: 2.1744 },
    ),
    true,
  );
});

test("a chain with the same name in two cities is two places", () => {
  assert.equal(
    isSamePlace(
      { name: "Starbucks", city: "Paris", lat: 48.85, lon: 2.35 },
      { name: "Starbucks", city: "Lisbon", lat: 38.72, lon: -9.14 },
    ),
    false,
  );
});

test("the same name in the same city with no coordinates is one place", () => {
  assert.equal(
    isSamePlace({ name: "Bar Raval", city: "Toronto" }, { name: "bar raval", city: "Toronto" }),
    true,
  );
});

test("the same name in different cities with no coordinates is two places", () => {
  assert.equal(
    isSamePlace({ name: "Central Park", city: "New York" }, { name: "Central Park", city: "Kyiv" }),
    false,
  );
});

test("different names in the same city are different places", () => {
  assert.equal(
    isSamePlace({ name: "Bar Raval", city: "Toronto" }, { name: "Bar Isabel", city: "Toronto" }),
    false,
  );
});

test("isSamePlace reads a timeline row's title as its name", () => {
  assert.equal(
    isSamePlace({ title: "Bar Raval", city: "Toronto" }, { name: "Bar Raval", city: "Toronto" }),
    true,
  );
});

test("a nameless entry never matches", () => {
  assert.equal(isSamePlace({ name: "" }, { name: "" }), false);
});

test("findDuplicate returns the row that already covers it", () => {
  const existing = [
    { id: "1", name: "Bar Isabel", city: "Toronto" },
    { id: "2", name: "Bar Raval", city: "Toronto" },
  ];
  assert.equal(findDuplicate(existing, { name: "bar raval", city: "toronto" })?.id, "2");
  assert.equal(findDuplicate(existing, { name: "Pizzeria Libretto", city: "Toronto" }), undefined);
});

test("partitionNew splits a batch and catches repeats inside it", () => {
  const existing = [{ name: "Bar Raval", city: "Toronto" }];
  const { fresh, duplicates } = partitionNew(existing, [
    { name: "Bar Raval", city: "Toronto" },
    { name: "Bar Isabel", city: "Toronto" },
    { name: "Bar Isabel", city: "Toronto" },
  ]);
  assert.deepEqual(
    fresh.map((f) => f.name),
    ["Bar Isabel"],
  );
  assert.equal(duplicates.length, 2);
});

test("partitionNew keeps everything when nothing matches", () => {
  const { fresh, duplicates } = partitionNew(
    [],
    [
      { name: "A", city: "X" },
      { name: "B", city: "X" },
    ],
  );
  assert.equal(fresh.length, 2);
  assert.equal(duplicates.length, 0);
});

// ── converters ──────────────────────────────────────────────────────────────

test("a geocoder result becomes a captured place", () => {
  const captured = capturedFromParsedPlace(flore);
  assert.equal(captured.name, "Café de Flore");
  assert.equal(captured.placeType, "cafe");
  assert.equal(captured.lat, 48.854);
});

test("a captured cafe becomes a meal on the timeline", () => {
  const item = toTimelineItem(capturedFromParsedPlace(flore), { day_date: "2026-04-02" });
  assert.equal(item.kind, "meal");
  assert.equal(item.title, "Café de Flore");
  assert.equal(item.address, "172 Boulevard Saint-Germain, Paris");
  assert.equal(item.day_date, "2026-04-02");
  assert.equal(item.lat, 48.854);
});

test("an explicit kind beats the inferred one", () => {
  const item = toTimelineItem(capturedFromParsedPlace(flore), { kind: "note" });
  assert.equal(item.kind, "note");
});

test("a captured venue becomes a stop filed under its city", () => {
  const stop = toNewStop(capturedFromParsedPlace(flore), { arrive_on: "2026-04-01" });
  assert.equal(stop.city, "Paris");
  assert.equal(stop.place_name, "Café de Flore");
  assert.equal(stop.country, "France");
  assert.equal(stop.arrive_on, "2026-04-01");
});

test("a captured city becomes a stop with no separate venue name", () => {
  const stop = toNewStop({ name: "Lisbon", city: "Lisbon", country: "Portugal" });
  assert.equal(stop.city, "Lisbon");
  assert.equal(stop.place_name, "");
});

test("a place with no city at all still files as a stop", () => {
  const stop = toNewStop({ name: "Somewhere" });
  assert.equal(stop.city, "Somewhere");
  assert.equal(stop.place_name, "");
});

test("a captured place becomes a recommendation", () => {
  const reco = toNewReco(capturedFromParsedPlace(flore), {
    category: "Cafe",
    recommended_by: "Marta",
  });
  assert.equal(reco.name, "Café de Flore");
  assert.equal(reco.city, "Paris");
  assert.equal(reco.recommended_by, "Marta");
  assert.equal(reco.url, "https://example.org/flore");
  assert.equal(reco.lat, 48.854);
});

test("a saved rec becomes a captured place, so it can join a trip", () => {
  const captured = capturedFromReco({
    name: "Bar Raval",
    city: "Toronto",
    country: "Canada",
    address: "505 College St",
    notes: "Go early",
    lat: 43.6559,
    lon: -79.4114,
  });
  assert.equal(captured.source, "Your saved places");
  const item = toTimelineItem(captured);
  assert.equal(item.title, "Bar Raval");
  assert.equal(item.detail, "Go early");
  assert.equal(item.lat, 43.6559);
});

test("a rec round-trips through a timeline item without losing its pin", () => {
  const captured = capturedFromReco({ name: "X", city: "Y", lat: 1.5, lon: 2.5 });
  const item = toTimelineItem(captured);
  assert.equal(item.lat, 1.5);
  assert.equal(item.lon, 2.5);
});

test("addressLine falls back to the city line", () => {
  assert.equal(addressLine({ name: "X", city: "Lisbon", country: "Portugal" }), "Lisbon, Portugal");
  assert.equal(addressLine({ name: "X", address: "1 Rua A", city: "Lisbon" }), "1 Rua A");
  assert.equal(addressLine({ name: "X" }), "");
});

test("previewKind says what a place would become", () => {
  assert.equal(previewKind({ name: "Hotel Lux", placeType: "hotel" }), "lodging");
  assert.equal(previewKind({ name: "Museu do Azulejo", placeType: "museum" }), "activity");
});

test("capturedFromReco keeps the source a rec already had", () => {
  // Restoring a removed rec must not rewrite where it came from.
  const captured = capturedFromReco({ name: "X", source: "maps.google.com" });
  assert.equal(captured.source, "maps.google.com");
});

test("capturedFromReco labels a rec that has no source", () => {
  assert.equal(capturedFromReco({ name: "X" }).source, "Your saved places");
});

test("a rec removed and restored keeps its address and pin", () => {
  const row = {
    name: "Bar Raval",
    city: "Toronto",
    country: "Canada",
    address: "505 College St",
    source: "yelp.com",
    lat: 43.6559,
    lon: -79.4114,
  };
  const restored = toNewReco(capturedFromReco(row), { category: "Bar" });
  assert.equal(restored.address, "505 College St");
  assert.equal(restored.source, "yelp.com");
  assert.equal(restored.lat, 43.6559);
  assert.equal(restored.category, "Bar");
});
