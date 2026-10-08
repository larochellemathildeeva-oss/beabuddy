import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  browseKindOf,
  inBrowseKind,
  listCounts,
  prettyTag,
  recentlySaved,
  tripDays,
  walkMinutesAbout,
} from "./recs-browse.ts";

describe("browseKindOf", () => {
  it("sorts OSM tags and saved categories into the five kinds", () => {
    assert.equal(browseKindOf("cafe"), "Cafés");
    assert.equal(browseKindOf("Café"), "Cafés");
    assert.equal(browseKindOf("ice_cream"), "Cafés");
    assert.equal(browseKindOf("restaurant"), "Restaurants");
    assert.equal(browseKindOf("fast_food"), "Restaurants");
    assert.equal(browseKindOf("hotel"), "Stays");
    assert.equal(browseKindOf("guest_house"), "Stays");
    assert.equal(browseKindOf("museum"), "Things to do");
    assert.equal(browseKindOf("viewpoint"), "Things to do");
    assert.equal(browseKindOf("books"), "More");
    assert.equal(browseKindOf(""), "More");
    assert.equal(browseKindOf(null), "More");
  });

  it("matches whole words only", () => {
    assert.equal(browseKindOf("steakhouse"), "More");
    assert.equal(browseKindOf("Barber"), "More");
  });

  it("lets All take everything", () => {
    assert.equal(inBrowseKind("books", "All"), true);
    assert.equal(inBrowseKind("cafe", "Restaurants"), false);
  });
});

describe("prettyTag", () => {
  it("reads tags as words", () => {
    assert.equal(prettyTag("cafe"), "Café");
    assert.equal(prettyTag("fast_food"), "Fast food");
    assert.equal(prettyTag("museum"), "Museum");
    assert.equal(prettyTag(""), "Place");
  });
});

describe("walkMinutesAbout", () => {
  it("stretches the straight line and never says zero", () => {
    assert.equal(walkMinutesAbout(0), 1);
    assert.equal(walkMinutesAbout(400), 7);
    assert.equal(walkMinutesAbout(-1), null);
  });
});

describe("recentlySaved and listCounts", () => {
  const rows = [
    { created_at: "2026-01-01", pin_type: null },
    { created_at: "2026-03-01", pin_type: "wishlist" },
    { created_at: "2026-02-01", pin_type: "nexttime" },
    { created_at: "2026-02-15", pin_type: "odd" },
  ];
  it("puts the newest first", () => {
    assert.deepEqual(
      recentlySaved(rows, 2).map((r) => r.created_at),
      ["2026-03-01", "2026-02-15"],
    );
  });
  it("counts a row with no list as a recommendation", () => {
    assert.deepEqual(listCounts(rows), { reco: 2, bucket: 2, visited: 0 });
    // Counted where they are listed: a row marked visited is Been there, whatever its list.
    assert.deepEqual(
      listCounts([
        { pin_type: "wishlist", visited: true },
        { pin_type: "reco", visited: true },
      ]),
      { reco: 0, bucket: 0, visited: 2 },
    );
  });
});

describe("tripDays", () => {
  it("lists each date of the trip", () => {
    assert.deepEqual(tripDays("2026-10-01", "2026-10-03"), [
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });
  it("gives one day for a trip with no end, none with no start", () => {
    assert.deepEqual(tripDays("2026-10-01", null), ["2026-10-01"]);
    assert.deepEqual(tripDays(null, "2026-10-01"), []);
  });
});
