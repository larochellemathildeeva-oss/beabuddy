import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { PLACE_ART, placeArtFor, placeArtUrl } from "./place-art.ts";

test("every place picture exists", () => {
  for (const art of PLACE_ART) {
    const url = placeArtUrl(art);
    assert.ok(existsSync(new URL(`../../public${url}`, import.meta.url)), url);
  }
});

test("a place is pictured by its category, then its kind, then its name", () => {
  assert.equal(placeArtFor({ category: "Café", name: "Café 23" }), "cafe");
  assert.equal(placeArtFor({ category: "restaurant", name: "Café 23" }), "restaurant");
  assert.equal(placeArtFor({ kind: "meal", name: "Somewhere" }), "restaurant");
  assert.equal(placeArtFor({ name: "Museu Nacional do Azulejo" }), "museum");
  assert.equal(placeArtFor({ category: "museum" }), "museum");
  assert.equal(placeArtFor({ name: "Sagrada Família basilica" }), "church");
  assert.equal(placeArtFor({ category: "fast_food" }), "restaurant");
  assert.equal(placeArtFor({ kind: "lodging", name: "Casa Azul" }), "hotel");
  assert.equal(placeArtFor({ name: "Miradouro da Graça" }), "viewpoint");
  assert.equal(placeArtFor({ name: "Fushimi Inari Shrine" }), "temple");
});

test("words match whole, so 'barbecue' is not a bar and 'artisan' is not art", () => {
  assert.equal(placeArtFor({ name: "Barbecue Joe" }), "street");
  assert.equal(placeArtFor({ name: "Artisan gifts" }), "street");
  assert.equal(placeArtFor({}), "street");
});
