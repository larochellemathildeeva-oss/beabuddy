import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pinLabel } from "../data/atlas.ts";
import { isLocation, listOf, recsForLocation, SAVE_LISTS } from "./place-lists.ts";

test("Wishlist and Next time are one Bucket list; visited is Been there", () => {
  assert.equal(listOf({ pin_type: "wishlist" }), "bucket");
  assert.equal(listOf({ pin_type: "nexttime" }), "bucket");
  assert.equal(listOf({ pin_type: "visited" }), "been");
  assert.equal(listOf({ pin_type: "reco", visited: true }), "been");
  assert.equal(listOf({ pin_type: "reco" }), "recommendation");
  assert.equal(listOf({ pin_type: null }), "recommendation");
});

test("the save choices never offer Next time", () => {
  assert.deepEqual([...SAVE_LISTS], ["reco", "wishlist", "visited"]);
});

test("a city or country is a location; a business, landmark or neighbourhood is a rec", () => {
  assert.equal(isLocation({ name: "Lisbon", city: "Lisbon", category: "City" }), true);
  assert.equal(
    isLocation({ name: "Japan", city: "Japan", country: "Japan", category: "Country" }),
    true,
  );
  assert.equal(
    isLocation({ name: "Griffith Observatory", city: "Los Angeles", category: "Viewpoint" }),
    false,
  );
  assert.equal(
    isLocation({
      name: "Montmartre",
      city: "Montmartre",
      country: "France",
      category: "neighbourhood",
    }),
    false,
  );
  assert.equal(
    isLocation({ name: "Shibuya", city: "Shibuya", country: "Japan", category: "suburb" }),
    false,
  );
});

const rec = (name: string, city: string | null, country: string | null) => ({
  name,
  city,
  country,
  category: "Food",
});

test("a city's recs match across spellings and languages", () => {
  const rows = [
    rec("Grand Central Market", "Los Ángeles", "United States"),
    rec("Bestia", "Los Angeles, CA", "USA"),
    rec("Café de Flore", "Paris", "France"),
  ];
  const got = recsForLocation({ city: "Los Angeles", country: "USA" }, rows, []).map((r) => r.name);
  assert.deepEqual(got, ["Grand Central Market", "Bestia"]);
});

test("namesake cities in different countries never share recs", () => {
  const rows = [rec("Café de Flore", "Paris", "France"), rec("Paris Diner", "Paris", "US")];
  assert.deepEqual(
    recsForLocation({ city: "Paris", country: "France" }, rows, []).map((r) => r.name),
    ["Café de Flore"],
  );
});

test("a country counts recs in cities that are not saved locations themselves", () => {
  const rows = [
    rec("Kikunoi", "Kyoto", "Japan"),
    rec("Ichiran", "Fukuoka", "Japan"),
    rec("Bestia", "Los Angeles", "USA"),
  ];
  const japan = { city: null, country: "Japan" };
  assert.deepEqual(
    recsForLocation(japan, rows, []).map((r) => r.name),
    ["Kikunoi", "Ichiran"],
  );
  assert.deepEqual(
    recsForLocation(japan, rows, [{ city: "Kyoto", country: "Japan" }]).map((r) => r.name),
    ["Ichiran"],
  );
});

test("a rec with no country matches a city only when the location has none either", () => {
  const rows = [rec("Somewhere", "Springfield", null)];
  assert.equal(recsForLocation({ city: "Springfield", country: "USA" }, rows, []).length, 0);
  assert.equal(recsForLocation({ city: "Springfield", country: null }, rows, []).length, 1);
});

test("the shown names are Recommendation, Bucket list and Been there", () => {
  assert.deepEqual(pinLabel, {
    reco: "Recommendation",
    wishlist: "Bucket list",
    nexttime: "Bucket list",
    visited: "Been there",
  });
});
