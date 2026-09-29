import { strict as assert } from "node:assert";
import { test } from "node:test";
import { chooseResolved, placeNameKey, type ResolvedRow } from "./resolved-places.ts";

const kyoto = { lat: 35.0037, lon: 135.7682 };
const ryosho: ResolvedRow = {
  lat: 35.0031,
  lon: 135.7746,
  label: "Ryosho, Gionmachi Minamigawa",
  source: "match",
};

test("placeNameKey: one name however it is written", () => {
  assert.equal(placeNameKey("RYŌ-SHŌ"), placeNameKey("ryo sho"));
  assert.equal(placeNameKey("Kōdai-ji"), placeNameKey("Kodai-ji"));
  assert.equal(placeNameKey("Café Rosetta"), placeNameKey("cafe rosetta"));
  assert.equal(placeNameKey("一蘭"), null); // too short to tell places apart
  assert.equal(placeNameKey("  "), null);
});

test("chooseResolved: one matched spot near town is the place", () => {
  const got = chooseResolved([ryosho], kyoto);
  assert.equal(got?.source, "match");
  assert.equal(got?.label, ryosho.label);
});

test("chooseResolved: a namesake in another city is not", () => {
  assert.equal(chooseResolved([{ ...ryosho, lat: 34.6937, lon: 135.5023 }], kyoto), null);
});

test("chooseResolved: a chain matched at several spots in town is left to the lookup", () => {
  const namba = { ...ryosho, lat: 35.0105, lon: 135.7672 };
  assert.equal(chooseResolved([ryosho, namba], kyoto), null);
  // Two matches at the same spot are one place.
  assert.equal(chooseResolved([ryosho, { ...ryosho, lat: 35.0032 }], kyoto)?.source, "match");
});

test("chooseResolved: one traveller's pick is not enough; two agreeing win over the map", () => {
  const pick = (voter: string, lat = 35.0008): ResolvedRow => ({
    lat,
    lon: 135.7668,
    label: "Men-ya Inoichi",
    source: "traveller",
    voter,
  });
  const matchedElsewhere: ResolvedRow = { ...ryosho, lat: 34.9851, lon: 135.7584 };
  assert.equal(chooseResolved([matchedElsewhere, pick("a")], kyoto)?.source, "match");
  // The same traveller twice is still one.
  assert.equal(chooseResolved([matchedElsewhere, pick("a"), pick("a")], kyoto)?.source, "match");
  const agreed = chooseResolved([matchedElsewhere, pick("a"), pick("b", 35.0009)], kyoto);
  assert.equal(agreed?.source, "traveller");
  assert.ok(Math.abs(agreed!.lat - 35.00085) < 1e-9);
});

test("chooseResolved: travellers who disagree settle nothing", () => {
  const pick = (voter: string, lat: number): ResolvedRow => ({
    lat,
    lon: 135.7668,
    label: "x",
    source: "traveller",
    voter,
  });
  const rows = [pick("a", 35.0), pick("b", 35.0), pick("c", 35.01), pick("d", 35.01)];
  assert.equal(chooseResolved(rows, kyoto), null);
});
