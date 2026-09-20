import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  filledFromMapSummary,
  isLocalityCategory,
  prettyPlaceCategory,
  stopKindForPlace,
  timelineKindForPlace,
} from "./place-kind.ts";

test("a cafe is a meal even though its addresstype is amenity", () => {
  // The real shape Nominatim returns for Café de Flore.
  assert.equal(timelineKindForPlace({ placeType: "cafe", category: "amenity" }), "meal");
});

test("restaurants, bars and bakeries are meals", () => {
  for (const placeType of ["restaurant", "bar", "pub", "fast_food", "bakery", "ice_cream"]) {
    assert.equal(timelineKindForPlace({ placeType }), "meal", placeType);
  }
});

test("hotels and hostels are lodging", () => {
  for (const placeType of ["hotel", "hostel", "guest_house", "apartment", "camp_site"]) {
    assert.equal(timelineKindForPlace({ placeType }), "lodging", placeType);
  }
});

test("airports and stations are transport", () => {
  for (const placeType of ["aerodrome", "bus_station", "ferry_terminal", "train_station"]) {
    assert.equal(timelineKindForPlace({ placeType }), "transport", placeType);
  }
});

test("anything else is an activity", () => {
  for (const placeType of ["museum", "park", "attraction", "viewpoint", "beach", "shop"]) {
    assert.equal(timelineKindForPlace({ placeType }), "activity", placeType);
  }
});

test("lodging wins over the word bar inside a hotel type", () => {
  assert.equal(timelineKindForPlace({ placeType: "hotel", category: "bar" }), "lodging");
});

test("the name is read when no type came back from a link", () => {
  assert.equal(timelineKindForPlace({ name: "Hotel Lux" }), "lodging");
  assert.equal(timelineKindForPlace({ name: "Café de Flore" }), "meal");
  assert.equal(timelineKindForPlace({ name: "Lisbon Airport" }), "transport");
  assert.equal(timelineKindForPlace({ name: "Gare du Nord" }), "transport");
});

test("a type always beats a misleading name", () => {
  // "Hotel Restaurant" the restaurant, not the hotel.
  assert.equal(timelineKindForPlace({ placeType: "restaurant", name: "Hotel Lux" }), "meal");
});

test("an unknown place with a plain name is an activity", () => {
  assert.equal(timelineKindForPlace({ name: "Bar Raval" }), "meal");
  assert.equal(timelineKindForPlace({ name: "Parque Eduardo VII" }), "activity");
  assert.equal(timelineKindForPlace({}), "activity");
});

test("stopKindForPlace marks airports and stations as stopovers", () => {
  assert.equal(stopKindForPlace({ placeType: "aerodrome" }), "layover");
  assert.equal(stopKindForPlace({ placeType: "city" }), "destination");
  assert.equal(stopKindForPlace({ placeType: "hotel" }), "destination");
});

test("isLocalityCategory separates a city from a venue", () => {
  assert.equal(isLocalityCategory("city"), true);
  assert.equal(isLocalityCategory("village"), true);
  assert.equal(isLocalityCategory("amenity"), false);
  assert.equal(isLocalityCategory(undefined), false);
});

test("prettyPlaceCategory never shows the word amenity", () => {
  assert.equal(prettyPlaceCategory({ placeType: "cafe", category: "amenity" }), "Cafe");
  assert.equal(prettyPlaceCategory({ category: "amenity" }), "Place");
  assert.equal(prettyPlaceCategory({ placeType: "bus_station" }), "Bus station");
  assert.equal(prettyPlaceCategory({}), "Place");
});

test("prettyPlaceCategory shows Subway as a restaurant, not OSM's fast_food", () => {
  assert.equal(prettyPlaceCategory({ placeType: "fast_food", category: "amenity" }), "Restaurant");
  assert.equal(prettyPlaceCategory({ placeType: "food_court", category: "amenity" }), "Restaurant");
});

test("prettyPlaceCategory falls back to the coarse category", () => {
  assert.equal(prettyPlaceCategory({ category: "city" }), "City");
});

test("filledFromMapSummary lists what was actually filled", () => {
  assert.equal(
    filledFromMapSummary({ address: "1 Rua A", city: "Lisbon", lat: 38.7 }),
    "Filled in the address, city and map pin from the map.",
  );
  assert.equal(filledFromMapSummary({ lat: 38.7 }), "Filled in the map pin from the map.");
  assert.equal(filledFromMapSummary({}), "");
});
