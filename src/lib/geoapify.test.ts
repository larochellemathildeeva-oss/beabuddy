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

test("places: a circle around the point, nearest first, keyed", async () => {
  const { geoapifyPlacesUrl } = await import("./geoapify.ts");
  const url = new URL(geoapifyPlacesUrl("K", "catering.cafe", { lat: 45.52, lon: -73.6 }, 2000));
  assert.equal(url.pathname, "/v2/places");
  assert.equal(url.searchParams.get("categories"), "catering.cafe");
  assert.equal(url.searchParams.get("filter"), "circle:-73.6,45.52,2000");
  assert.equal(url.searchParams.get("bias"), "proximity:-73.6,45.52");
  assert.equal(url.searchParams.get("apiKey"), "K");
});

test("places come back as OSM elements, tags kept and gaps filled", async () => {
  const { geoapifyPlacesToElements } = await import("./geoapify.ts");
  const els = geoapifyPlacesToElements({
    features: [
      {
        geometry: { coordinates: [-73.6005, 45.5229] },
        properties: {
          name: "Café Olimpico",
          street: "Rue Saint-Viateur Ouest",
          housenumber: "124",
          city: "Montréal",
          categories: ["catering", "catering.cafe"],
          datasource: {
            raw: { amenity: "cafe", name: "Café Olimpico", osm_id: 123, osm_type: "n" },
          },
        },
      },
      {
        properties: { lat: 1, lon: 2, name: "No tags café", categories: ["catering.cafe"] },
      },
      { properties: { name: "nowhere" } },
    ],
  });
  assert.equal(els.length, 2);
  assert.deepEqual(els[0], {
    type: "node",
    id: 123,
    lat: 45.5229,
    lon: -73.6005,
    tags: {
      amenity: "cafe",
      name: "Café Olimpico",
      osm_id: "123",
      osm_type: "n",
      "addr:housenumber": "124",
      "addr:street": "Rue Saint-Viateur Ouest",
      "addr:city": "Montréal",
    },
  });
  assert.equal(els[1]?.tags["amenity"], "cafe", "kind taken from the category");
});

test("place details: hours, website, phone and every name", async () => {
  const { readPlaceDetails, geoapifyDetailsUrl } = await import("./geoapify.ts");
  const url = new URL(geoapifyDetailsUrl("K", 34.3915, 132.4523));
  assert.equal(url.pathname, "/v2/place-details");
  assert.equal(url.searchParams.get("lat"), "34.3915");
  const facts = readPlaceDetails({
    features: [
      {
        properties: {
          feature_type: "details",
          name: "Hiroshima Peace Memorial Museum",
          opening_hours: "Mo-Su 08:30-18:00",
          website: "https://hpmmuseum.jp/",
          contact: { phone: "+81 82-241-4004" },
          facilities: { wheelchair: true },
          datasource: { raw: { name: "広島平和記念資料館", "name:en": "Peace Memorial Museum" } },
        },
      },
    ],
  });
  assert.deepEqual(facts, {
    name: "Hiroshima Peace Memorial Museum",
    names: ["Hiroshima Peace Memorial Museum", "広島平和記念資料館", "Peace Memorial Museum"],
    openingHours: "Mo-Su 08:30-18:00",
    website: "https://hpmmuseum.jp/",
    phone: "+81 82-241-4004",
    wheelchair: "yes",
  });
  assert.equal(readPlaceDetails({ features: [] }), null);
  assert.equal(
    readPlaceDetails({ features: [{ properties: { name: "x", website: "javascript:alert(1)" } }] })
      ?.website,
    undefined,
    "only web links",
  );
});

test("static map: numbered pins in order, joined by a line, keyed", async () => {
  const { geoapifyStaticMapUrl } = await import("./geoapify.ts");
  const url = new URL(
    geoapifyStaticMapUrl("K", [
      { lat: 34.3915, lon: 132.4523 },
      { lat: 34.3955, lon: 132.4536 },
    ]),
  );
  assert.equal(url.host, "maps.geoapify.com");
  assert.equal(url.pathname, "/v1/staticmap");
  const marker = url.searchParams.get("marker")!;
  assert.match(marker, /^lonlat:132\.452300,34\.391500;.*text:1/);
  assert.match(marker, /\|lonlat:132\.453600,34\.395500;.*text:2/);
  assert.equal(
    url.searchParams.get("geometry")?.split(";")[0],
    "polyline:132.452300,34.391500,132.453600,34.395500",
  );
  assert.equal(url.searchParams.get("apiKey"), "K");
});

test("matrix: every point is a source and a target, lon first, keyed", async () => {
  const { geoapifyMatrixRequest } = await import("./geoapify.ts");
  const { url, body } = geoapifyMatrixRequest("K&Y", "walk", [
    { lat: 35.0116, lon: 135.7681 },
    { lat: 34.9949, lon: 135.785 },
  ]);
  assert.equal(url, "https://api.geoapify.com/v1/routematrix?apiKey=K%26Y");
  const parsed = JSON.parse(body);
  assert.equal(parsed.mode, "walk");
  assert.deepEqual(parsed.sources, [
    { location: [135.7681, 35.0116] },
    { location: [135.785, 34.9949] },
  ]);
  assert.deepEqual(parsed.targets, parsed.sources);
});

test("matrix answer: read by index, gaps stay null, strays are ignored", async () => {
  const { readMatrix } = await import("./geoapify.ts");
  const m = readMatrix(
    {
      sources_to_targets: [
        [
          { source_index: 0, target_index: 0, time: 0, distance: 0 },
          { source_index: 0, target_index: 1, time: 420, distance: 500 },
        ],
        [
          { source_index: 1, target_index: 0, time: null },
          { source_index: 1, target_index: 5, time: 99 },
        ],
      ],
    },
    2,
  );
  assert.deepEqual(m, [
    [0, 420],
    [null, null],
  ]);
  assert.deepEqual(readMatrix({ error: "Unauthorized" }, 1), [[null]]);
});
