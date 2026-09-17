import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { glyphLabel, timeForRail, timelineGlyph } from "./timeline-kind.ts";

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
