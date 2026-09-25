import { test } from "node:test";
import assert from "node:assert/strict";
import { isExactPoiMatch, overpassQuery, poiIntent, readOverpass } from "./poi-search.ts";

const peel = { lat: 45.5003, lon: -73.5733 }; // downtown Montreal

test("kinds of place are recognised, plurals and accents too", () => {
  for (const q of [
    "coffee",
    "Coffee shops",
    "cafés",
    "bagels",
    "Sushi",
    "museums",
    "musée",
    "ice cream",
  ]) {
    assert.equal(poiIntent(q)?.kind, "category", q);
  }
});

test("a chain or a short name is a brand search, and 'subways' means Subway", () => {
  assert.deepEqual(poiIntent("subways"), { kind: "brand", text: "subways".slice(0, -1) });
  assert.deepEqual(poiIntent("Tim Hortons"), { kind: "brand", text: "Tim Horton" });
  assert.deepEqual(poiIntent("Mandy's"), { kind: "brand", text: "Mandy" });
});

test("addresses and long phrases stay with the geocoder", () => {
  assert.equal(poiIntent("1-10 Otemachi, Naka Ward"), null);
  assert.equal(poiIntent("1500 Peel St"), null);
  assert.equal(poiIntent("the museum by the river with the big dome"), null);
  assert.equal(poiIntent("a"), null);
});

test("a brand query matches the brand tag or the start of the name, apostrophes optional", () => {
  const q = overpassQuery({ kind: "brand", text: "Mandy's" }, peel, 2000);
  assert.match(q, /\(around:2000,45\.50030,-73\.57330\)/);
  assert.match(q, /\["brand"~"\^M\['’\]\?a/);
  assert.match(q, /\["name"~"\^/);
  assert.match(q, /out center tags 40;$/);
});

test("a brand typed with or without its s still matches the tag exactly", () => {
  const q = overpassQuery(poiIntent("Tim Hortons")!, peel, 2000);
  const brand = new RegExp(q.match(/\["brand"~"\^(.*?)\$",i\]/)![1]!.replace(/\\\\/g, "\\"), "i");
  const whole = (v: string) => new RegExp(`^(?:${brand.source})$`, "i").test(v);
  assert.ok(whole("Tim Hortons"));
  assert.ok(whole("Tim Horton's"));
  assert.ok(!whole("Tim Hortons Express Bar"));
});

test("regex characters in a name cannot break the query", () => {
  const q = overpassQuery({ kind: "brand", text: 'A&W (Root) "Beer"' }, peel, 2000);
  // Each special character escaped for the regex (\\( in the QL string).
  assert.ok(q.includes("\\\\("), q);
  // Every quote inside the value is escaped, so the string ends where it should.
  const brand = q.match(/\["brand"~"((?:[^"\\]|\\.)*)",i\]/);
  assert.ok(brand, q);
  assert.ok(brand[1]!.includes('\\"'), "quotes are escaped");
});

test("a category query asks for each of its tags, named places only", () => {
  const q = overpassQuery(poiIntent("coffee")!, peel, 2000);
  assert.match(q, /\["amenity"="cafe"\]\["name"\]/);
  assert.match(q, /\["cuisine"~"coffee",i\]\["name"\]/);
});

test("answers come back nearest first, with address and hours, and no streets", () => {
  const hits = readOverpass(
    [
      {
        type: "node",
        id: 1,
        lat: 45.52,
        lon: -73.57,
        tags: { amenity: "fast_food", brand: "Subway" },
      },
      {
        type: "way",
        id: 2,
        center: { lat: 45.5005, lon: -73.5735 },
        tags: {
          amenity: "fast_food",
          name: "Subway",
          "addr:housenumber": "1200",
          "addr:street": "Rue Peel",
          "addr:city": "Montréal",
          opening_hours: "Mo-Su 07:00-23:00",
        },
      },
      {
        type: "way",
        id: 3,
        center: { lat: 45.5, lon: -73.57 },
        tags: { highway: "residential", name: "Subway Street" },
      },
    ],
    peel,
  );
  assert.deepEqual(
    hits.map((h) => h.id),
    ["way/2", "node/1"],
  );
  assert.equal(hits[0]!.address, "1200 Rue Peel, Montréal");
  assert.equal(hits[0]!.openingHours, "Mo-Su 07:00-23:00");
  assert.ok(hits[0]!.distanceM < 50);
  assert.equal(hits[1]!.name, "Subway", "a branch with only a brand is still named");
});

test("the same place mapped twice is shown once", () => {
  const tags = { amenity: "cafe", name: "Café Olimpico" };
  const hits = readOverpass(
    [
      { type: "node", id: 1, lat: 45.5231, lon: -73.6017, tags },
      { type: "way", id: 2, center: { lat: 45.52312, lon: -73.60172 }, tags },
    ],
    peel,
  );
  assert.equal(hits.length, 1);
});

test("an exact match is the brand or the whole name, not a name that starts the same", () => {
  assert.ok(isExactPoiMatch({ name: "Subway" }, "subways"));
  assert.ok(isExactPoiMatch({ name: "Subway Peel", brand: "Subway" }, "Subway"));
  assert.ok(isExactPoiMatch({ name: "Tim Horton's" }, "tim hortons"));
  assert.ok(!isExactPoiMatch({ name: "Paris Pizza" }, "Paris"));
});

test("a place mapped under its local name is found and shown by its English one", () => {
  const q = overpassQuery(
    { kind: "brand", text: "Itsukushima Shrine" },
    { lat: 34.2975, lon: 132.3219 },
    2000,
  );
  assert.match(q, /\["name:en"~"\^I/);
  const [hit] = readOverpass(
    [
      {
        type: "way",
        id: 9,
        center: { lat: 34.2959, lon: 132.3198 },
        tags: { amenity: "place_of_worship", name: "厳島神社", "name:en": "Itsukushima Shrine" },
      },
    ],
    { lat: 34.2975, lon: 132.3219 },
  );
  assert.equal(hit!.name, "Itsukushima Shrine (厳島神社)");
  assert.ok(isExactPoiMatch(hit!, "itsukushima shrine"));
  // A Latin-script name is left as it is.
  const [louvre] = readOverpass(
    [
      {
        type: "node",
        id: 1,
        lat: 48.86,
        lon: 2.34,
        tags: { tourism: "museum", name: "Musée du Louvre", "name:en": "Louvre Museum" },
      },
    ],
    { lat: 48.86, lon: 2.34 },
  );
  assert.equal(louvre!.name, "Musée du Louvre");
});

test("matchesBrand keeps the chain and drops its neighbours", async () => {
  const { matchesBrand } = await import("./poi-search.ts");
  assert.ok(matchesBrand({ name: "McDonald's", amenity: "fast_food" }, "mcdonald"));
  assert.ok(matchesBrand({ brand: "McDonald's", amenity: "fast_food" }, "mcdonalds"));
  assert.ok(matchesBrand({ name: "マクドナルド", "name:en": "McDonald's" }, "McDonalds"));
  assert.ok(!matchesBrand({ name: "Tim Hortons", amenity: "cafe" }, "mcdonald"));
  assert.ok(!matchesBrand({ name: "Burger King" }, ""));
});

test("a brand search asks Geoapify by name across the broad categories", async () => {
  const { geoapifyPlacesUrl } = await import("./geoapify.ts");
  const { BRAND_CATEGORIES } = await import("./poi-search.ts");
  const url = new URL(
    geoapifyPlacesUrl("K", BRAND_CATEGORIES, { lat: 45.5, lon: -73.6 }, 2000, 60, "mcdonald"),
  );
  assert.equal(url.searchParams.get("name"), "mcdonald");
  assert.match(url.searchParams.get("categories")!, /^catering,commercial,/);
  assert.equal(url.searchParams.get("limit"), "60");
});
