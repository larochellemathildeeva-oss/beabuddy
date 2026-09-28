import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asPerspective,
  defaultPerspective,
  TRIP_PERSPECTIVES,
  tripIsUnderway,
} from "./trip-perspective.ts";

describe("TRIP_PERSPECTIVES", () => {
  it("is the Overview, the three day views, then Bookings", () => {
    assert.deepEqual(
      TRIP_PERSPECTIVES.map((p) => p.id),
      ["overview", "companion", "map", "timeline", "bookings"],
    );
  });

  it("gives every perspective a label, and a hint where one helps", () => {
    for (const p of TRIP_PERSPECTIVES) {
      assert.ok(p.label.length > 0, `${p.id} has no label`);
      assert.equal(typeof p.hint, "string", `${p.id} has no hint field`);
    }
    // The map's layout switch says enough; its tab carries no hint line.
    assert.equal(TRIP_PERSPECTIVES.find((p) => p.id === "map")!.hint, "");
  });
});

describe("defaultPerspective", () => {
  it("opens on Now while the trip is running", () => {
    assert.equal(defaultPerspective(true), "companion");
  });

  it("opens on the Overview otherwise", () => {
    assert.equal(defaultPerspective(false), "overview");
  });
});

describe("asPerspective", () => {
  it("accepts the known ids", () => {
    assert.equal(asPerspective("map"), "map");
    assert.equal(asPerspective("timeline"), "timeline");
    assert.equal(asPerspective("trip"), null, "a saved Trip view opens on the default");
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
