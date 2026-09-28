import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  echoesName,
  openPlacesNamed,
  openPlacesUrl,
  pickOpenPlace,
  readOpenPlaces,
} from "./open-places.ts";

const barreiras = { lat: -12.1439, lon: -44.9968 };

const answer = {
  results: [
    {
      place_id: "ov-liberdade",
      name: "Mercado Municipal",
      lat: -11.961,
      lon: -45.0143,
      confidence: 0.7,
      address: { freeform: "Rua Principal", locality: "Liberdade" },
    },
    {
      place_id: "ov-town",
      name: "Mercado Municipal de Barreiras",
      lat: -12.1452,
      lon: -44.9951,
      confidence: 0.9,
      address: { freeform: "Rua Barão do Rio Branco", locality: "Barreiras" },
    },
    {
      place_id: "ov-closed",
      name: "Mercado Municipal Velho",
      lat: -12.144,
      lon: -44.997,
      confidence: 0.8,
      operating_status: "permanently_closed",
    },
    { place_id: "ov-bad", name: "No position" },
  ],
};

test("the request searches by name near the middle of town", () => {
  const url = new URL(openPlacesUrl("Mercado Municipal", barreiras));
  assert.equal(url.pathname, "/v1/places");
  assert.equal(url.searchParams.get("q"), "Mercado Municipal");
  assert.equal(url.searchParams.get("lat"), "-12.14390");
  assert.equal(url.searchParams.get("lon"), "-44.99680");
  assert.ok(Number(url.searchParams.get("radius_mi")) <= 10);
});

test("closed places and rows without a position are dropped", () => {
  const places = readOpenPlaces(answer);
  assert.deepEqual(
    places.map((p) => p.id),
    ["ov-liberdade", "ov-town"],
  );
  assert.equal(
    places[1]!.label,
    "Mercado Municipal de Barreiras, Rua Barão do Rio Branco, Barreiras",
  );
  assert.deepEqual(readOpenPlaces(null), []);
  assert.deepEqual(readOpenPlaces({ results: "nope" }), []);
});

test("the town's market wins over the village namesake", () => {
  const found = pickOpenPlace(readOpenPlaces(answer), ["Mercado Municipal"], barreiras);
  assert.equal(found?.id, "ov-town");
});

test("a nearby place with another name is not the stop", () => {
  const places = readOpenPlaces({
    results: [{ place_id: "x", name: "Padaria Central", lat: -12.144, lon: -44.997 }],
  });
  assert.equal(pickOpenPlace(places, ["Lunch at Cais e Porto"], barreiras), null);
});

test("a restaurant is found by the name inside an activity title", () => {
  const places = readOpenPlaces({
    results: [
      {
        place_id: "cais",
        name: "Cais e Porto Restaurante",
        lat: -12.15,
        lon: -44.99,
        address: "Av. Beira Rio, Barreiras",
      },
    ],
  });
  assert.equal(pickOpenPlace(places, ["Lunch at Cais e Porto"], barreiras)?.id, "cais");
});

test("a search typed as three words finds the restaurant spelt as one", () => {
  const osaka = { lat: 34.6937, lon: 135.5023 };
  const places = readOpenPlaces({
    results: [
      { place_id: "amano-far", name: "Amano", lat: 34.9, lon: 135.7, address: "Kyoto" },
      {
        place_id: "amano",
        name: "Sushidokoro Amano",
        lat: 34.653,
        lon: 135.518,
        address: { freeform: "Shitennoji", locality: "Osaka" },
      },
      { place_id: "other", name: "Sushi Zanmai", lat: 34.69, lon: 135.5 },
    ],
  });
  const named = openPlacesNamed(places, ["sushido koro amano"], osaka);
  assert.deepEqual(
    named.map((p) => p.id),
    ["amano", "amano-far"],
  );
});

test("the map's own answer that is the place needs no second look", () => {
  assert.equal(
    echoesName("Sushidokoro Amano", { name: "Sushidokoro Amano", address: "Osaka, Japan" }),
    true,
  );
  assert.equal(echoesName("Sushidokoro Amano", { name: "Tennoji Park", address: "Osaka" }), false);
});
