import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dropBareAreas, hitsSpanCountries, widerQueries } from "./place-search-near.ts";

test("hitsSpanCountries is false for one country or no countries", () => {
  assert.equal(hitsSpanCountries([{ country: "Canada" }, { country: "Canada" }]), false);
  assert.equal(hitsSpanCountries([{ country: null }, {}]), false);
  assert.equal(hitsSpanCountries([]), false);
});

test("hitsSpanCountries catches the worldwide Subway list", () => {
  assert.equal(
    hitsSpanCountries([
      { country: "Mexico" },
      { country: "New Zealand" },
      { country: "Finland" },
      { country: "India" },
    ]),
    true,
  );
});

test("dropBareAreas drops the trip's city when the venue is elsewhere", () => {
  const hits = [
    { name: "Kyoto", class: "place", type: "city" },
    { name: "Kyotamba", class: "boundary", type: "administrative" },
    { name: "Kyoto Prefecture", class: "boundary", type: "administrative" },
  ];
  assert.deepEqual(dropBareAreas(hits, "Motoyasubashi Pier"), []);
});

test("dropBareAreas keeps venues, and areas that share a word with the name", () => {
  const hits = [
    { name: "Gion", class: "place", type: "suburb" },
    { name: "Motoyasu Pier", class: "man_made", type: "pier" },
    { name: "Kyoto", class: "place", type: "city" },
  ];
  assert.deepEqual(
    dropBareAreas(hits, "Gion").map((h) => h.name),
    ["Gion", "Motoyasu Pier"],
  );
  assert.deepEqual(
    dropBareAreas(hits, "Motoyasu Pier").map((h) => h.name),
    ["Motoyasu Pier"],
  );
});

test("widerQueries tries the country, then anywhere", () => {
  assert.deepEqual(widerQueries("Motoyasubashi Pier", "Kyoto, Kyoto Prefecture, Japan"), [
    "Motoyasubashi Pier, Japan",
    "Motoyasubashi Pier",
  ]);
  assert.deepEqual(widerQueries("Louvre", "Paris"), ["Louvre"]);
});
