import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pinLabel } from "../data/atlas.ts";
import {
  bucketLocationGroups,
  canPinAsBeen,
  isLocation,
  listOf,
  recsForLocation,
  SAVE_LISTS,
} from "./place-lists.ts";

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

test("a city saved with no country matches its recs on the city alone", () => {
  const rows = [
    rec("Time Out Market", "Lisbon", "Portugal"),
    rec("Somewhere", "Springfield", null),
  ];
  assert.deepEqual(
    recsForLocation({ city: "Lisbon", country: null }, rows, []).map((r) => r.name),
    ["Time Out Market"],
  );
  assert.equal(recsForLocation({ city: "Springfield", country: null }, rows, []).length, 1);
  // A rec with no country is not claimed by a city that has one: it could be a namesake.
  assert.equal(recsForLocation({ city: "Springfield", country: "USA" }, rows, []).length, 0);
});

test("the shown names are Recommendation, Bucket list and Been there", () => {
  assert.deepEqual(pinLabel, {
    reco: "Recommendation",
    wishlist: "Bucket list",
    nexttime: "Bucket list",
    visited: "Been there",
  });
});

const loc = (id: string, over: Record<string, unknown>) => ({
  id,
  name: "",
  city: null as string | null,
  country: null as string | null,
  category: "City",
  pin_type: "wishlist" as string | null,
  visited: false,
  ...over,
});

test("the same city saved twice in two spellings is one Bucket list location", () => {
  const groups = bucketLocationGroups([
    loc("a", { name: "Los Ángeles", city: "Los Ángeles", country: "USA" }),
    loc("b", {
      name: "Los Angeles",
      city: "Los Angeles",
      country: "United States",
      pin_type: "nexttime",
    }),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0]!.rows.map((r) => r.id),
    ["a", "b"],
  );
});

test("a location saved as a recommendation is on the Bucket list; been there and recs are not", () => {
  const groups = bucketLocationGroups([
    loc("city", { name: "Santa Monica", city: "Santa Monica", country: "USA", pin_type: "reco" }),
    loc("none", {
      name: "Japan",
      city: "Japan",
      country: "Japan",
      category: "Country",
      pin_type: null,
    }),
    loc("been", { name: "Paris", city: "Paris", country: "France", pin_type: "visited" }),
    loc("food", { name: "Bestia", city: "Los Angeles", country: "USA", category: "Food" }),
  ]);
  assert.deepEqual(groups.map((g) => g.rows[0]!.id).sort(), ["city", "none"]);
});

test("a country pin is a country even when its name and country are spelt differently", () => {
  const [japan] = bucketLocationGroups([
    loc("j", { name: "Japan", city: "Japan", country: "日本", category: "Country" }),
  ]);
  assert.equal(japan!.city, null);
  assert.equal(japan!.name, "Japan");
});

test("a place goes to Been there only when it has a point on the map to pin", () => {
  assert.equal(canPinAsBeen([{ lat: 34.05, lon: -118.24 }]), true);
  assert.equal(
    canPinAsBeen([
      { lat: null, lon: null },
      { lat: 34.05, lon: -118.24 },
    ]),
    true,
  );
  assert.equal(canPinAsBeen([{ lat: null, lon: null }]), false);
  assert.equal(canPinAsBeen([]), false);
});
