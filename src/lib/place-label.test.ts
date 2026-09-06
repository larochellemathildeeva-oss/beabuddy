import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  formatPlaceLine,
  formatTripLocation,
  locationFromParsedPlace,
  placeFromNominatim,
  placeSuggestionLines,
  refineNominatimHits,
  type NominatimHitLike,
} from "./place-label.ts";

const montrealCanada: NominatimHitLike = {
  lat: "45.5031824",
  lon: "-73.5698065",
  name: "Montreal",
  display_name:
    "Montreal, Urban agglomeration of Montreal, Montreal (administrative region), Quebec, Canada",
  type: "administrative",
  addresstype: "city",
  importance: 0.7683399932257889,
  address: {
    city: "Montreal",
    county: "Urban agglomeration of Montreal",
    state_district: "Montreal (administrative region)",
    state: "Quebec",
    country: "Canada",
    country_code: "ca",
  },
};

const montrealFrance: NominatimHitLike = {
  lat: "43.1998",
  lon: "2.1411",
  name: "Montréal",
  display_name: "Montréal, Carcassonne, Aude, Occitania, Metropolitan France, 11290, France",
  type: "administrative",
  addresstype: "village",
  importance: 0.565822807959334,
  address: {
    village: "Montréal",
    municipality: "Carcassonne",
    county: "Aude",
    state: "Occitania",
    region: "Metropolitan France",
    postcode: "11290",
    country: "France",
    country_code: "fr",
  },
};

const montrealAdmin: NominatimHitLike = {
  lat: "45.55",
  lon: "-73.6",
  name: "Montreal (administrative region)",
  display_name: "Montreal (administrative region), Quebec, Canada",
  type: "administrative",
  addresstype: "state_district",
  importance: 0.5073376760078315,
  address: {
    state_district: "Montreal (administrative region)",
    state: "Quebec",
    country: "Canada",
    country_code: "ca",
  },
};

const cafeDeFlore: NominatimHitLike = {
  lat: "48.854",
  lon: "2.332",
  name: "Café de Flore",
  display_name: "Café de Flore, 172, Boulevard Saint-Germain, Saint-Germain-des-Prés, Paris, France",
  type: "cafe",
  addresstype: "amenity",
  importance: 0.4,
  address: {
    amenity: "Café de Flore",
    house_number: "172",
    road: "Boulevard Saint-Germain",
    suburb: "Saint-Germain-des-Prés",
    city: "Paris",
    state: "Île-de-France",
    country: "France",
  },
};

const springfieldIl: NominatimHitLike = {
  lat: "39.7817",
  lon: "-89.6501",
  name: "Springfield",
  type: "administrative",
  addresstype: "city",
  importance: 0.6,
  address: { city: "Springfield", state: "Illinois", country: "United States" },
};

const springfieldMo: NominatimHitLike = {
  lat: "37.209",
  lon: "-93.2923",
  name: "Springfield",
  type: "administrative",
  addresstype: "city",
  importance: 0.55,
  address: { city: "Springfield", state: "Missouri", country: "United States" },
};

test("formatPlaceLine uses city, admin and country only", () => {
  assert.equal(formatPlaceLine(montrealCanada), "Montreal, Quebec, Canada");
  assert.equal(formatPlaceLine(montrealFrance), "Montréal, Occitania, France");
  assert.equal(formatPlaceLine(cafeDeFlore), "Paris, Île-de-France, France");
});

test("placeFromNominatim keeps a short city name and a human address", () => {
  const place = placeFromNominatim(montrealCanada);
  assert.equal(place.name, "Montreal");
  assert.equal(place.city, "Montreal");
  assert.equal(place.country, "Canada");
  assert.equal(place.address, "Montreal, Quebec, Canada");
  assert.equal(place.category, "city");
});

test("placeSuggestionLines collapses a city to one clean line", () => {
  const place = placeFromNominatim(montrealCanada);
  const lines = placeSuggestionLines(place);
  assert.equal(lines.title, "Montreal, Quebec, Canada");
  assert.equal(lines.subtitle, undefined);
});

test("placeSuggestionLines keeps a landmark title and a short place subtitle", () => {
  const place = placeFromNominatim(cafeDeFlore);
  const lines = placeSuggestionLines(place);
  assert.equal(lines.title, "Café de Flore");
  assert.equal(lines.subtitle, "Paris, Île-de-France, France");
});

test("refineNominatimHits prefers the city and drops admin + France for Montreal", () => {
  const refined = refineNominatimHits([montrealCanada, montrealFrance, montrealAdmin], "Montreal");
  assert.equal(refined.length, 1);
  assert.equal(formatPlaceLine(refined[0]!), "Montreal, Quebec, Canada");
});

test("refineNominatimHits keeps the French village when the query asks for France", () => {
  const refined = refineNominatimHits([montrealCanada, montrealFrance, montrealAdmin], "Montreal France");
  assert.ok(refined.some((hit) => hit.address?.["country"] === "France"));
  assert.equal(formatPlaceLine(refined[0]!), "Montréal, Occitania, France");
});

test("refineNominatimHits keeps same-name cities in different states", () => {
  const refined = refineNominatimHits([springfieldIl, springfieldMo], "Springfield");
  assert.equal(refined.length, 2);
  assert.deepEqual(
    refined.map((hit) => formatPlaceLine(hit)),
    ["Springfield, Illinois, United States", "Springfield, Missouri, United States"],
  );
});

test("refineNominatimHits dedupes the city and its agglomeration twin", () => {
  const twin: NominatimHitLike = {
    ...montrealCanada,
    name: "Montréal",
    lat: "45.51",
    lon: "-73.56",
    importance: 0.7,
  };
  const refined = refineNominatimHits([montrealCanada, twin, montrealAdmin], "Montreal");
  assert.equal(refined.length, 1);
});

test("locationFromParsedPlace fills the city field with the full place line", () => {
  const loc = locationFromParsedPlace(placeFromNominatim(montrealCanada));
  assert.equal(loc.city, "Montreal, Quebec, Canada");
  assert.equal(loc.country, "Canada");
});

test("formatTripLocation does not repeat a country already in the city line", () => {
  assert.equal(formatTripLocation("Montreal, Quebec, Canada", "Canada"), "Montreal, Quebec, Canada");
  assert.equal(formatTripLocation("Montreal", "Canada"), "Montreal, Canada");
});
