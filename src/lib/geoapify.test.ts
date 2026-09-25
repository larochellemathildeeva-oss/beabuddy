import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  geoapifyRouteUrl,
  geoapifySearchUrl,
  geoapifyToNominatim,
  geoapifyToOsrm,
  rectFromViewbox,
} from "./geoapify.ts";

test("a viewbox becomes a rect filter, smallest corner first", () => {
  assert.equal(rectFromViewbox("132.4,34.5,132.5,34.3"), "rect:132.4,34.3,132.5,34.5");
  assert.equal(rectFromViewbox("nonsense"), null);
});

test("search: bounded to the box, leaning to its middle, English, keyed", () => {
  const url = new URL(
    geoapifySearchUrl("KEY", {
      query: "Peace Park",
      limit: 3,
      language: "en",
      viewbox: "132.4,34.5,132.5,34.3",
      bounded: true,
    }),
  );
  assert.equal(url.pathname, "/v1/geocode/search");
  assert.equal(url.searchParams.get("text"), "Peace Park");
  assert.equal(url.searchParams.get("format"), "json");
  assert.equal(url.searchParams.get("limit"), "3");
  assert.equal(url.searchParams.get("lang"), "en");
  assert.equal(url.searchParams.get("filter"), "rect:132.4,34.3,132.5,34.5");
  assert.equal(url.searchParams.get("bias"), "proximity:132.45,34.4");
  assert.equal(url.searchParams.get("apiKey"), "KEY");
});

test("search: an unbounded box only biases, and '*' asks for no language", () => {
  const url = new URL(
    geoapifySearchUrl("K", { query: "x", language: "*", viewbox: "1,2,3,4", bounded: false }),
  );
  assert.equal(url.searchParams.get("filter"), null);
  assert.equal(url.searchParams.get("bias"), "proximity:2,3");
  assert.equal(url.searchParams.get("lang"), null);
});

test("route: lat,lon waypoints and Geoapify's mode names", () => {
  const url = new URL(
    geoapifyRouteUrl("K", "walking", { lat: 34.39, lon: 132.45 }, { lat: 34.3, lon: 132.32 }),
  );
  assert.equal(url.pathname, "/v1/routing");
  assert.equal(url.searchParams.get("waypoints"), "34.39,132.45|34.3,132.32");
  assert.equal(url.searchParams.get("mode"), "walk");
  const drive = new URL(geoapifyRouteUrl("K", "driving", { lat: 1, lon: 2 }, { lat: 3, lon: 4 }));
  assert.equal(drive.searchParams.get("mode"), "drive");
});

test("a venue result reads like a Nominatim hit, with its OSM kind and every name", () => {
  const [hit] = geoapifyToNominatim({
    results: [
      {
        lat: 34.3955,
        lon: 132.4536,
        name: "Atomic Bomb Dome",
        formatted: "Atomic Bomb Dome, Otemachi, Naka Ward, Hiroshima, Japan",
        street: "Otemachi",
        city: "Hiroshima",
        country: "Japan",
        country_code: "jp",
        result_type: "amenity",
        category: "tourism.sights",
        place_id: "abc",
        rank: { importance: 0.6 },
        bbox: { lon1: 132.45, lat1: 34.39, lon2: 132.46, lat2: 34.4 },
        datasource: {
          raw: { name: "原爆ドーム", "name:en": "Atomic Bomb Dome", historic: "memorial" },
        },
      },
    ],
  });
  assert.ok(hit);
  assert.equal(hit.lat, "34.3955");
  assert.equal(hit.display_name, "Atomic Bomb Dome, Otemachi, Naka Ward, Hiroshima, Japan");
  assert.equal(hit.class, "historic");
  assert.equal(hit.type, "memorial");
  assert.equal(hit.address["city"], "Hiroshima");
  assert.equal(hit.address["country_code"], "jp");
  assert.deepEqual(hit.namedetails, { name: "原爆ドーム", "name:en": "Atomic Bomb Dome" });
  assert.deepEqual(hit.boundingbox, ["34.39", "34.4", "132.45", "132.46"]);
});

test("a town is a place and a region a boundary, as Nominatim tags them", () => {
  const hits = geoapifyToNominatim({
    results: [
      { lat: 35, lon: 135.7, city: "Kyoto", result_type: "city", formatted: "Kyoto, Japan" },
      { lat: 35.2, lon: 135.5, state: "Kyoto Prefecture", result_type: "state" },
      { lat: 45.5, lon: -73.6, name: "Café Olimpico", category: "catering.cafe" },
    ],
  });
  assert.deepEqual(
    hits.map((h) => [h.class, h.type]),
    [
      ["place", "city"],
      ["boundary", "administrative"],
      ["amenity", "cafe"],
    ],
  );
});

test("results without coordinates are dropped; a non-answer is empty", () => {
  assert.deepEqual(geoapifyToNominatim({ results: [{ name: "x" }] }), []);
  assert.deepEqual(geoapifyToNominatim(null), []);
});

test("a GeoJSON route reads like OSRM's, instructions kept", () => {
  const osrm = geoapifyToOsrm({
    features: [
      {
        properties: {
          distance: 1234,
          time: 960,
          legs: [
            {
              steps: [
                { distance: 400, instruction: { text: "Walk north on Aioi-dori." } },
                { distance: 0, instruction: { text: "You have arrived." } },
              ],
            },
          ],
        },
      },
    ],
  });
  assert.equal(osrm.routes[0]?.distance, 1234);
  assert.equal(osrm.routes[0]?.duration, 960);
  assert.deepEqual(osrm.routes[0]?.legs[0]?.steps[0], {
    distance: 400,
    instruction: "Walk north on Aioi-dori.",
  });
  assert.deepEqual(geoapifyToOsrm({ features: [] }), { routes: [] });
});
