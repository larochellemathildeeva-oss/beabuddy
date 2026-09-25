import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Pin } from "@/data/atlas";
import {
  cityPins,
  isVisitedPin,
  visitedCities,
  visitedProvinces,
  visitsByCountry,
  type ProvinceFeature,
} from "./world-visits.ts";

const pin = (over: Partial<Pin>): Pin => ({
  id: over.id ?? Math.random().toString(36),
  type: "visited",
  name: "Somewhere",
  city: "Hiroshima",
  country: "Japan",
  lat: 34.39,
  lon: 132.45,
  ...over,
});

test("only places you have been count: not wishlist, next time or plain recs", () => {
  assert.equal(isVisitedPin({ type: "visited" }), true);
  assert.equal(isVisitedPin({ type: "reco", visited: true }), true);
  assert.equal(isVisitedPin({ type: "reco" }), false);
  assert.equal(isVisitedPin({ type: "wishlist" }), false);
  assert.equal(isVisitedPin({ type: "nexttime" }), false);
});

test("visited pins in one city are one city, placed at their middle", () => {
  const cities = visitedCities([
    pin({ name: "Museum", lat: 34.39, lon: 132.45 }),
    pin({ name: "Okonomimura", city: "hiroshima ", lat: 34.41, lon: 132.47 }),
    pin({ name: "Kyoto", city: "Kyōto", lat: 35.01, lon: 135.77 }),
    pin({ type: "wishlist", city: "Osaka", lat: 34.69, lon: 135.5 }),
    pin({ city: "", country: "Japan" }),
    pin({ city: "Null Island", lat: 0, lon: 0 }),
  ]);
  assert.deepEqual(
    cities.map((c) => [c.city, c.places]),
    [
      ["Hiroshima", 2],
      ["Kyōto", 1],
    ],
  );
  assert.ok(Math.abs(cities[0]!.lat - 34.4) < 1e-9);
  assert.equal(cityPins(cities)[0]!.type, "visited");
  assert.equal(cityPins(cities)[0]!.name, "Hiroshima");
});

// A square "province" around Hiroshima city, and another far away.
const square = (id: string, name: string, west: number, south: number, size: number) =>
  ({
    type: "Feature",
    id,
    properties: { name, country: "Japan", kind: "Prefecture" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [west, south + size],
          [west + size, south + size],
          [west + size, south],
          [west, south],
        ],
      ],
    },
  }) as ProvinceFeature;

test("a city's province is the outline it falls in", () => {
  const cities = visitedCities([
    pin({ name: "Museum" }),
    pin({ city: "Miyajima", lat: 34.3, lon: 132.32 }),
    pin({ city: "Kyoto", lat: 35.01, lon: 135.77 }),
  ]);
  const provinces = visitedProvinces(cities, [
    square("JPN-1", "Hiroshima", 132, 34, 1),
    square("JPN-2", "Kyoto", 135.5, 34.8, 0.5),
    square("JPN-3", "Hokkaido", 140, 42, 3),
  ]);
  assert.deepEqual(
    provinces.map((p) => [p.name, p.cityKeys.length]),
    [
      ["Hiroshima", 2],
      ["Kyoto", 1],
    ],
  );
  assert.deepEqual(visitedProvinces([], [square("x", "x", 0, 0, 1)]), []);
});

test("a coastal city just outside its simplified outline still gets its province", () => {
  // 0.1° (about 9 km) east of the square's edge: the sea, on a simplified map.
  const [coast] = visitedCities([pin({ city: "Port", lat: 34.5, lon: 133.1 })]);
  assert.deepEqual(
    visitedProvinces([coast!], [square("JPN-1", "Hiroshima", 132, 34, 1)]).map((p) => p.name),
    ["Hiroshima"],
  );
  // Far out at sea it belongs to none.
  const [ship] = visitedCities([pin({ city: "Ship", lat: 34.5, lon: 134 })]);
  assert.deepEqual(visitedProvinces([ship!], [square("JPN-1", "Hiroshima", 132, 34, 1)]), []);
});

test("an outline wound inside out never claims every city", () => {
  const inverted = square("CHE-1", "Schaffhausen", 8.5, 47.6, 0.2);
  const ring = (inverted.geometry as { coordinates: number[][][] }).coordinates[0]!;
  ring.reverse();
  const cities = visitedCities([pin({ name: "Museum" })]);
  assert.deepEqual(
    visitedProvinces(cities, [inverted, square("JPN-1", "Hiroshima", 132, 34, 1)]).map(
      (p) => p.name,
    ),
    ["Hiroshima"],
  );
});

test("the list groups by country, with countries named only by a visited pin", () => {
  const pins = [
    pin({ name: "Museum" }),
    pin({ city: "Kyoto", lat: 35.01, lon: 135.77 }),
    pin({ city: "", country: "France" }),
    pin({ type: "wishlist", city: "Lima", country: "Peru" }),
  ];
  const cities = visitedCities(pins);
  const provinces = visitedProvinces(cities, [square("JPN-1", "Hiroshima", 132, 34, 1)]);
  const list = visitsByCountry(pins, cities, provinces);
  assert.deepEqual(
    list.map((c) => [c.country, c.cities.map((x) => x.city), c.provinces.map((p) => p.name)]),
    [
      ["France", [], []],
      ["Japan", ["Hiroshima", "Kyoto"], ["Hiroshima"]],
    ],
  );
});

test("one city and one country, whatever language they were saved in", () => {
  const pins = [
    pin({ name: "Temple", city: "Kyoto", country: "Japan", lat: 35.0116, lon: 135.7681 }),
    pin({ name: "Shrine", city: "京都", country: "日本", lat: 34.9671, lon: 135.7727 }),
    pin({ name: "Café", city: "Kioto", country: "Japón", lat: 35.0, lon: 135.76 }),
    pin({ name: "Museum", city: "Hiroshima", country: "Japon", lat: 34.39, lon: 132.45 }),
    pin({ name: "Old port", city: "Montréal", country: "Canada", lat: 45.5, lon: -73.55 }),
    pin({ name: "Plateau", city: "Montreal", country: "Canadá", lat: 45.52, lon: -73.58 }),
  ];
  const cities = visitedCities(pins);
  assert.deepEqual(
    cities.map((c) => [c.city, c.country, c.places]),
    [
      ["Kyoto", "Japan", 3],
      ["Hiroshima", "Japan", 1],
      ["Montréal", "Canada", 2],
    ],
  );
  const list = visitsByCountry(pins, cities, []);
  assert.deepEqual(
    list.map((c) => [c.key, c.country, c.cities.length]),
    [
      ["CA", "Canada", 1],
      ["JP", "Japan", 2],
    ],
  );
});

test("two towns with the same name in different countries stay apart", () => {
  const cities = visitedCities([
    pin({ city: "Paris", country: "France", lat: 48.8566, lon: 2.3522 }),
    pin({ city: "Paris", country: "United States", lat: 33.66, lon: -95.555 }),
  ]);
  assert.equal(cities.length, 2);
  assert.notEqual(cities[0]!.key, cities[1]!.key);
});

test("a city saved without a country is listed under its province's", async () => {
  const { visitedCountryKeys } = await import("./world-visits.ts");
  const pins = [pin({ city: "Hiroshima", country: "" })];
  const cities = visitedCities(pins);
  const provinces = visitedProvinces(cities, [square("JPN-1", "Hiroshima", 132, 34, 1)]);
  assert.deepEqual(
    visitsByCountry(pins, cities, provinces).map((c) => [c.country, c.cities.length]),
    [["Japan", 1]],
  );
  assert.deepEqual([...visitedCountryKeys(pins, provinces)], ["JP"]);
});

test("a coastal city just outside its simplified outline still gets its province", () => {
  // 0.1° (about 9 km) east of the square's edge: the sea, on a simplified map.
  const [coast] = visitedCities([pin({ city: "Port", lat: 34.5, lon: 133.1 })]);
  assert.deepEqual(
    visitedProvinces([coast!], [square("JPN-1", "Hiroshima", 132, 34, 1)]).map((p) => p.name),
    ["Hiroshima"],
  );
  // Far out at sea it belongs to none.
  const [ship] = visitedCities([pin({ city: "Ship", lat: 34.5, lon: 134 })]);
  assert.deepEqual(visitedProvinces([ship!], [square("JPN-1", "Hiroshima", 132, 34, 1)]), []);
});

test("an outline wound inside out never claims every city", () => {
  const inverted = square("CHE-1", "Schaffhausen", 8.5, 47.6, 0.2);
  const ring = (inverted.geometry as { coordinates: number[][][] }).coordinates[0]!;
  ring.reverse();
  const cities = visitedCities([pin({ name: "Museum" })]);
  assert.deepEqual(
    visitedProvinces(cities, [inverted, square("JPN-1", "Hiroshima", 132, 34, 1)]).map(
      (p) => p.name,
    ),
    ["Hiroshima"],
  );
});

test("the list groups by country, with countries named only by a visited pin", () => {
  const pins = [
    pin({ name: "Museum" }),
    pin({ city: "Kyoto", lat: 35.01, lon: 135.77 }),
    pin({ city: "", country: "France" }),
    pin({ type: "wishlist", city: "Lima", country: "Peru" }),
  ];
  const cities = visitedCities(pins);
  const provinces = visitedProvinces(cities, [square("JPN-1", "Hiroshima", 132, 34, 1)]);
  const list = visitsByCountry(pins, cities, provinces);
  assert.deepEqual(
    list.map((c) => [c.country, c.cities.map((x) => x.city), c.provinces.map((p) => p.name)]),
    [
      ["France", [], []],
      ["Japan", ["Hiroshima", "Kyoto"], ["Hiroshima"]],
    ],
  );
});

test("only the countries holding your cities are fetched", async () => {
  const { provinceFilesFor } = await import("./world-visits.ts");
  const index = [
    {
      a3: "JPN",
      country: "Japan",
      bbox: [122.9, 24.0, 153.9, 45.5] as [number, number, number, number],
    },
    {
      a3: "FRA",
      country: "France",
      bbox: [-5.1, 41.3, 9.6, 51.1] as [number, number, number, number],
    },
    // Fiji straddles the antimeridian: west is greater than east.
    {
      a3: "FJI",
      country: "Fiji",
      bbox: [177.3, -20.7, -178.2, -12.5] as [number, number, number, number],
    },
  ];
  assert.deepEqual(provinceFilesFor(index, [{ lat: 34.39, lon: 132.45 }]), ["JPN"]);
  assert.deepEqual(provinceFilesFor(index, [{ lat: -18.14, lon: 178.44 }]), ["FJI"]);
  assert.deepEqual(provinceFilesFor(index, [{ lat: -17.0, lon: -179.9 }]), ["FJI"]);
  assert.deepEqual(provinceFilesFor(index, []), []);
});

test("a country added by hand shades its country and is not a city", async () => {
  const { isCountryOnly, visitedCountryKeys } = await import("./world-visits.ts");
  const pins = [
    // Added with + before countries had a category: "city" is the country.
    pin({ name: "Japan", city: "Japan", country: "Japan", category: "City", lat: 36, lon: 138 }),
    // Added from a pasted list: category Country.
    pin({
      name: "Portugal",
      city: "Portugal",
      country: "Portugal",
      category: "Country",
      lat: 39.5,
      lon: -8,
    }),
    // In another language, with no country field.
    pin({ name: "Allemagne", city: "Allemagne", country: "", lat: 51, lon: 10 }),
    pin({ name: "Museum", city: "Hiroshima", country: "Japan" }),
  ];
  assert.equal(isCountryOnly(pins[0]!), true);
  assert.equal(isCountryOnly(pins[3]!), false);
  // A city-state is its country: one entry, not a city and a country.
  assert.equal(isCountryOnly(pin({ city: "Singapore", country: "Singapore" })), true);
  const cities = visitedCities(pins);
  assert.deepEqual(
    cities.map((c) => c.city),
    ["Hiroshima"],
  );
  assert.deepEqual(
    visitsByCountry(pins, cities, []).map((c) => [c.country, c.cities.length]),
    [
      ["Germany", 0],
      ["Japan", 1],
      ["Portugal", 0],
    ],
  );
  assert.deepEqual([...visitedCountryKeys(pins, [])].sort(), ["DE", "JP", "PT"]);
});

test("a country with no city of its own is named on the globe", async () => {
  const { countryMarks } = await import("./world-visits.ts");
  const pins = [
    pin({
      name: "Iceland",
      city: "Iceland",
      country: "Iceland",
      category: "City",
      lat: 64.9,
      lon: -18.6,
    }),
    pin({ name: "Japon", city: "Japon", country: "", lat: 36, lon: 138 }),
    pin({ name: "Museum", city: "Hiroshima", country: "Japan" }),
    pin({
      name: "Ireland",
      city: "Ireland",
      country: "Ireland",
      category: "Country",
      lat: 0,
      lon: 0,
    }),
  ];
  const cities = visitedCities(pins);
  const marks = countryMarks(pins, visitsByCountry(pins, cities, []));
  // Japan has a city dot already; Ireland was saved with no real point.
  assert.deepEqual(
    marks.map((m) => [m.name, m.lat]),
    [["Iceland", 64.9]],
  );
});
