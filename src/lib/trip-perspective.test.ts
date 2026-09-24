import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asPerspective,
  defaultPerspective,
  isDayScoped,
  TRIP_PERSPECTIVES,
  tripIsUnderway,
} from "./trip-perspective.ts";

describe("TRIP_PERSPECTIVES", () => {
  it("keeps the trip-wide view as a peer, not a footnote", () => {
    // The whole point of the fourth perspective is that stops, prep, packing,
    // documents and budget stay reachable from a day-centric screen. If it
    // ever stops being in this list, half the product has gone with it.
    assert.ok(TRIP_PERSPECTIVES.some((p) => p.id === "trip"));
  });

  it("gives every perspective a label and a hint", () => {
    for (const p of TRIP_PERSPECTIVES) {
      assert.ok(p.label.length > 0, `${p.id} has no label`);
      assert.ok(p.hint.length > 0, `${p.id} has no hint`);
    }
  });
});

describe("isDayScoped", () => {
  it("scopes the three day views", () => {
    assert.equal(isDayScoped("companion"), true);
    assert.equal(isDayScoped("map"), true);
    assert.equal(isDayScoped("timeline"), true);
  });

  it("does not scope the trip view — a packing list is not a Tuesday thing", () => {
    assert.equal(isDayScoped("trip"), false);
  });
});

describe("defaultPerspective", () => {
  it("opens on Now while the trip is running", () => {
    assert.equal(defaultPerspective(true), "companion");
  });

  it("opens on the day list otherwise", () => {
    assert.equal(defaultPerspective(false), "timeline");
  });
});

describe("asPerspective", () => {
  it("accepts the known ids", () => {
    assert.equal(asPerspective("map"), "map");
    assert.equal(asPerspective("trip"), "trip");
  });

  it("refuses anything else", () => {
    for (const bad of ["Map", "", "todo", null, undefined, 3, {}]) {
      assert.equal(asPerspective(bad), null);
    }
  });
});

describe("tripIsUnderway", () => {
  const trip = { start_date: "2026-10-07", end_date: "2026-10-11" };

  it("is true on the first and last day", () => {
    assert.equal(tripIsUnderway(trip, "2026-10-07"), true);
    assert.equal(tripIsUnderway(trip, "2026-10-11"), true);
  });

  it("is false either side", () => {
    assert.equal(tripIsUnderway(trip, "2026-10-06"), false);
    assert.equal(tripIsUnderway(trip, "2026-10-12"), false);
  });

  it("treats a start with no end as a single day", () => {
    const oneDay = { start_date: "2026-10-07", end_date: null };
    assert.equal(tripIsUnderway(oneDay, "2026-10-07"), true);
    assert.equal(tripIsUnderway(oneDay, "2026-10-08"), false);
  });

  it("is false for an undated trip whatever the date", () => {
    assert.equal(tripIsUnderway({ start_date: null, end_date: null }, "2026-10-07"), false);
    assert.equal(tripIsUnderway({ start_date: "   " }, "2026-10-07"), false);
  });
});
