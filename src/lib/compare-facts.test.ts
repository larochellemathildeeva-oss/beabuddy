import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysSince, formatMetres, haversine } from "./geo.ts";
import { buildCompareFacts, factsPrompt, type PlaceForCompare } from "./compare-facts.ts";

const rom: PlaceForCompare = {
  name: "ROM",
  city: "Toronto",
  country: "Canada",
  category: "museum",
  kind: "Recommendation",
  notes: null,
  lat: 43.6677,
  lon: -79.3948,
  recommendedBy: "Mathilde",
  dateAdded: "2026-08-25",
  source: "Friend",
  alreadyBeen: false,
};

const highPark: PlaceForCompare = {
  name: "High Park",
  city: "Toronto",
  country: "Canada",
  category: "park",
  kind: "Wishlist",
  notes: null,
  lat: 43.6465,
  lon: -79.4637,
  recommendedBy: null,
  dateAdded: "2026-07-28",
  source: null,
  alreadyBeen: false,
};

describe("haversine", () => {
  it("is ~0 at the same point", () => {
    assert.ok(haversine({ lat: 43.65, lon: -79.38 }, { lat: 43.65, lon: -79.38 }) < 1);
  });

  it("puts ROM about 6 km from High Park", () => {
    const m = haversine({ lat: rom.lat!, lon: rom.lon! }, { lat: highPark.lat!, lon: highPark.lon! });
    assert.ok(m > 5_000 && m < 8_000, `got ${m}`);
  });
});

describe("daysSince", () => {
  it("counts calendar days from YYYY-MM-DD", () => {
    assert.equal(daysSince("2026-08-25", new Date("2026-09-06T15:00:00Z")), 12);
  });

  it("returns 0 for today and null for junk", () => {
    assert.equal(daysSince("2026-09-06", new Date("2026-09-06T23:00:00Z")), 0);
    assert.equal(daysSince("last week"), null);
  });
});

describe("buildCompareFacts", () => {
  const now = new Date("2026-09-06T12:00:00Z");
  const montreal = { lat: 45.5017, lon: -73.5673 };

  it("computes pairwise metres and days saved", () => {
    const facts = buildCompareFacts(
      [rom, highPark],
      { city: "Montreal", coords: montreal },
      "September",
      now,
    );
    assert.equal(facts.pairs.length, 1);
    assert.ok(facts.pairs[0]!.metres > 5_000 && facts.pairs[0]!.metres < 8_000);
    assert.equal(facts.places[0]!.daysSinceSaved, 12);
    assert.equal(facts.places[0]!.recommendedBy, "Mathilde");
    assert.ok(facts.places[0]!.metresFromHome! > 400_000);
    assert.equal(facts.homeGeocoded, true);
  });

  it("omits distances when coords or home are missing", () => {
    const noCoords = { ...rom, lat: null, lon: null };
    const facts = buildCompareFacts(
      [noCoords, { ...highPark, lat: null, lon: null }],
      { city: "Montreal", coords: null },
      null,
      now,
    );
    assert.equal(facts.pairs.length, 0);
    assert.equal(facts.places[0]!.metresFromHome, null);
    assert.equal(facts.homeGeocoded, false);
    const prompt = factsPrompt(facts);
    assert.match(prompt, /distances between places are unknown/);
    assert.match(prompt, /omit distance from home/);
    assert.doesNotMatch(prompt, /km from/);
  });
});

describe("formatMetres", () => {
  it("uses metres under 1 km and rounded km above", () => {
    assert.equal(formatMetres(420), "420 m");
    assert.equal(formatMetres(6200), "6.2 km");
    assert.equal(formatMetres(504_000), "504 km");
  });
});
