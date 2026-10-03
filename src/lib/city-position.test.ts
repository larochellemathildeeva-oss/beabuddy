import { test } from "node:test";
import assert from "node:assert/strict";
import {
  citiesToLocate,
  cityKey,
  cityQuery,
  hasPosition,
  pickCityHit,
  stopsToPin,
  tripCityStop,
  withCityPositions,
  type CityHit,
  type CityStop,
} from "./city-position.ts";

const stop = (city: string, more: Partial<CityStop> = {}): CityStop => ({
  city,
  country: "Germany",
  lat: null,
  lon: null,
  ...more,
});

test("hasPosition keeps real positions and drops typos", () => {
  assert.equal(hasPosition({ lat: 52.52, lon: 13.4 }), true);
  assert.equal(hasPosition({ lat: 0, lon: 0 }), true);
  assert.equal(hasPosition({ lat: null, lon: 13.4 }), false);
  assert.equal(hasPosition({ lat: 95, lon: 13.4 }), false);
  assert.equal(hasPosition({ lat: Number.NaN, lon: 13.4 }), false);
});

test("cityKey ignores case, accents and spacing", () => {
  assert.equal(cityKey("Zürich", "Switzerland"), cityKey(" zurich ", "switzerland"));
  assert.notEqual(cityKey("Paris", "France"), cityKey("Paris", "United States"));
});

test("cityQuery adds the country unless the name already says it", () => {
  assert.equal(cityQuery("Berlin", "Germany"), "Berlin, Germany");
  assert.equal(cityQuery("Berlin", null), "Berlin");
  assert.equal(cityQuery("Berlin, Germany", "Germany"), "Berlin, Germany");
});

test("citiesToLocate asks each city without a position once, in order", () => {
  const found = citiesToLocate([
    stop("Berlin"),
    stop("Hamburg", { lat: 53.55, lon: 9.99 }),
    stop("berlin"),
    stop("Frankfurt"),
    stop(" "),
  ]);
  assert.deepEqual(
    found.map((c) => c.city),
    ["Berlin", "Frankfurt"],
  );
  assert.equal(citiesToLocate([stop("A1"), stop("B2"), stop("C3")], 2).length, 2);
});

test("pickCityHit takes the answer named like the city", () => {
  const hits: CityHit[] = [
    { name: "Germany", placeType: "country", lat: 51, lon: 10 },
    { name: "Frankfurt Airport", placeType: "aerodrome", lat: 50.03, lon: 8.56 },
    { name: "Frankfurter Allee", placeType: "residential", lat: 52.51, lon: 13.47 },
    { name: "Frankfurt am Main", placeType: "city", lat: 50.11, lon: 8.68 },
  ];
  assert.deepEqual(pickCityHit(hits, "Frankfurt"), { lat: 50.11, lon: 8.68 });
});

test("pickCityHit takes a town named in its own language, never a country or a venue", () => {
  assert.deepEqual(
    pickCityHit([{ name: "München", placeType: "city", lat: 48.14, lon: 11.58 }], "Munich"),
    { lat: 48.14, lon: 11.58 },
  );
  // As OpenStreetMap answers "Kyoto, Japan".
  assert.deepEqual(
    pickCityHit(
      [{ name: "京都市", country: "日本", placeType: "administrative", lat: 35.01, lon: 135.76 }],
      "Kyoto",
    ),
    { lat: 35.01, lon: 135.76 },
  );
  assert.equal(
    pickCityHit([{ name: "Germany", placeType: "country", lat: 51, lon: 10 }], "Germany"),
    null,
  );
  assert.equal(
    pickCityHit([{ name: "Café Munich", placeType: "cafe", lat: 40, lon: -74 }], "Lyon"),
    null,
  );
  assert.equal(
    pickCityHit([{ name: "Somewhere", placeType: "town", weak: true, lat: 1, lon: 1 }], "Lyon"),
    null,
  );
  assert.equal(pickCityHit([{ name: "Lyon" }], "Lyon"), null);
  // Geoapify answers a country as an administrative area named like itself.
  assert.equal(
    pickCityHit(
      [{ name: "Germany", country: "Germany", placeType: "administrative", lat: 51, lon: 10 }],
      "Germany",
    ),
    null,
  );
  // Berlin is a state as well as a city: named like it, it counts.
  assert.deepEqual(
    pickCityHit(
      [{ name: "Berlin", country: "Germany", placeType: "administrative", lat: 52.5, lon: 13.4 }],
      "Berlin",
    ),
    { lat: 52.5, lon: 13.4 },
  );
});

test("withCityPositions fills only the stops without one", () => {
  const positions = new Map([[cityKey("Berlin", "Germany"), { lat: 52.52, lon: 13.4 }]]);
  const [berlin, hamburg, bonn] = withCityPositions(
    [stop("Berlin"), stop("Hamburg", { lat: 53.55, lon: 9.99 }), stop("Bonn")],
    positions,
  );
  assert.deepEqual([berlin?.lat, berlin?.lon], [52.52, 13.4]);
  assert.deepEqual([hamburg?.lat, hamburg?.lon], [53.55, 9.99]);
  assert.equal(bonn?.lat, null);
});

test("stopsToPin saves a city's position on the city, never on a hotel or address", () => {
  const positions = new Map([[cityKey("Berlin", "Germany"), { lat: 52.52, lon: 13.4 }]]);
  const pins = stopsToPin(
    [
      stop("Berlin", { id: "a" }),
      stop("Berlin", { id: "b", place_name: "Hotel Adlon" }),
      stop("Berlin", { id: "c", address: "Unter den Linden 77" }),
      stop("Berlin", { id: "d", lat: 52.5, lon: 13.3 }),
      stop("Berlin"),
    ],
    positions,
  );
  assert.deepEqual(pins, [{ id: "a", lat: 52.52, lon: 13.4 }]);
});

test("tripCityStop draws a one-city trip's own city", () => {
  assert.deepEqual(
    tripCityStop({
      city: "Lisbon, Portugal",
      country: "Portugal",
      start_date: "2026-05-01",
      end_date: "2026-05-04",
    }),
    [
      {
        city: "Lisbon",
        country: "Portugal",
        lat: null,
        lon: null,
        arrive_on: "2026-05-01",
        depart_on: "2026-05-04",
      },
    ],
  );
  assert.deepEqual(tripCityStop({ city: null }), []);
});
