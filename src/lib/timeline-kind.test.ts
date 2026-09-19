import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TIMELINE_KINDS,
  glyphLabel,
  normaliseKind,
  timeForRail,
  timelineGlyph,
  vaultCategory,
} from "./timeline-kind.ts";

describe("timelineGlyph", () => {
  it("maps the plain kinds", () => {
    assert.equal(timelineGlyph({ kind: "meal" }), "meal");
    assert.equal(timelineGlyph({ kind: "lodging" }), "lodging");
    assert.equal(timelineGlyph({ kind: "transport" }), "transport");
  });

  it("maps the synonyms an import or the AI might produce", () => {
    assert.equal(timelineGlyph({ kind: "dinner" }), "meal");
    assert.equal(timelineGlyph({ kind: "hotel" }), "lodging");
    assert.equal(timelineGlyph({ kind: "flight" }), "transport");
    assert.equal(timelineGlyph({ kind: "museum" }), "sight");
  });

  it("is case and whitespace insensitive", () => {
    assert.equal(timelineGlyph({ kind: "  MEAL " }), "meal");
  });

  it("reads Béa's own direction rows from the title", () => {
    assert.equal(timelineGlyph({ kind: "note", title: "Walk to Fushimi Inari" }), "walk");
    assert.equal(timelineGlyph({ kind: "note", title: "Drive to Sapporo" }), "transport");
  });

  it("spots a check-in whatever the kind says", () => {
    assert.equal(timelineGlyph({ kind: "activity", title: "Check in at Hotel Kanra" }), "lodging");
  });

  it("falls back to activity rather than nothing", () => {
    assert.equal(timelineGlyph({ kind: "something-new" }), "activity");
    assert.equal(timelineGlyph({}), "activity");
  });

  it("gives every glyph a spoken label", () => {
    for (const g of [
      "meal",
      "lodging",
      "transport",
      "sight",
      "walk",
      "note",
      "activity",
    ] as const) {
      assert.ok(glyphLabel(g).length > 0);
    }
  });
});

describe("timeForRail", () => {
  it("passes a 24h time through padded", () => {
    assert.equal(timeForRail("8:30"), "08:30");
    assert.equal(timeForRail("08:30"), "08:30");
  });

  it("converts pm", () => {
    assert.equal(timeForRail("2:30 pm"), "14:30");
    assert.equal(timeForRail("9:00 PM"), "21:00");
  });

  it("handles noon and midnight", () => {
    assert.equal(timeForRail("12:00 pm"), "12:00");
    assert.equal(timeForRail("12:30 am"), "00:30");
  });

  it("handles an hour with no minutes", () => {
    assert.equal(timeForRail("7pm"), "19:00");
  });

  it("keeps a short word as it is", () => {
    assert.equal(timeForRail("Morning"), "Morning");
  });

  it("truncates something too long for the rail", () => {
    assert.equal(timeForRail("After a slow lunch"), "After a…");
  });

  it("returns nothing for nothing", () => {
    assert.equal(timeForRail(null), "");
    assert.equal(timeForRail("   "), "");
  });
});

describe("normaliseKind", () => {
  it("passes the stored kinds through untouched", () => {
    for (const kind of TIMELINE_KINDS) assert.equal(normaliseKind(kind), kind);
  });

  it("folds the importer's old vocabulary onto the app's", () => {
    assert.equal(normaliseKind("Plan"), "activity");
    assert.equal(normaliseKind("Flight"), "flight");
    assert.equal(normaliseKind("Hotel"), "hotel");
    assert.equal(normaliseKind("Transport"), "transport");
    assert.equal(normaliseKind("Reservation"), "reservation");
  });

  it("understands the words a plan actually uses", () => {
    assert.equal(normaliseKind("Breakfast"), "meal");
    assert.equal(normaliseKind("dinner"), "meal");
    assert.equal(normaliseKind("Museum"), "sight");
    assert.equal(normaliseKind("hike"), "walk");
    assert.equal(normaliseKind("Airbnb"), "lodging");
  });

  it("falls back to activity, never to nothing", () => {
    assert.equal(normaliseKind(""), "activity");
    assert.equal(normaliseKind(null), "activity");
    assert.equal(normaliseKind("interpretive dance"), "activity");
  });

  // The whole point of one vocabulary: a stored kind the glyph table has
  // never heard of is how twenty rows ended up wearing the same icon.
  it("gives every stored kind a glyph of its own", () => {
    for (const kind of TIMELINE_KINDS) {
      if (kind === "activity" || kind === "reservation") continue;
      assert.notEqual(
        timelineGlyph({ kind, title: "Somewhere" }),
        "activity",
        `${kind} fell through to the generic glyph`,
      );
    }
  });
});

describe("vaultCategory", () => {
  it("files a kept stop by what it is", () => {
    assert.equal(vaultCategory(timelineGlyph({ kind: "dinner" })), "Restaurant");
    assert.equal(vaultCategory(timelineGlyph({ kind: "hotel" })), "Stay");
    assert.equal(vaultCategory(timelineGlyph({ kind: "museum" })), "Sight");
    assert.equal(vaultCategory(timelineGlyph({ kind: "activity" })), "Place");
  });
});
