import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  asTripsLayout,
  groupByPlace,
  heroTrips,
  placeTags,
  tripCountdown,
  tripMonth,
  tripRowTag,
} from "./trips-page.ts";

const now = new Date(2026, 9, 4, 15, 0);

describe("asTripsLayout", () => {
  it("reads List, and anything else as Big banner", () => {
    assert.equal(asTripsLayout("list"), "list");
    assert.equal(asTripsLayout("big"), "big");
    assert.equal(asTripsLayout(null), "big");
    assert.equal(asTripsLayout("grid"), "big");
  });
});

describe("tripCountdown", () => {
  it("counts the days before, then the day of the trip", () => {
    assert.deepEqual(tripCountdown("2026-10-08", "2026-10-10", now), {
      value: "4",
      unit: "days",
      label: "In 4 days",
    });
    assert.deepEqual(tripCountdown("2026-10-05", "2026-10-10", now), {
      value: "1",
      unit: "day",
      label: "Tomorrow",
    });
    assert.deepEqual(tripCountdown("2026-10-04", "2026-10-10", now), {
      value: "Today",
      unit: "",
      label: "Leaving today",
    });
    assert.deepEqual(tripCountdown("2026-10-02", "2026-10-06", now), {
      value: "3",
      unit: "of 5",
      label: "Day 3 of 5",
    });
  });
  it("says nothing without dates, after the trip, or months away", () => {
    assert.equal(tripCountdown(null, null, now), null);
    assert.equal(tripCountdown("2026-09-01", "2026-09-03", now), null);
    assert.equal(tripCountdown("2027-03-01", "2027-03-03", now), null);
  });
});

describe("tripRowTag", () => {
  it("marks drafts, live trips, soon trips and loose dates", () => {
    assert.deepEqual(tripRowTag({ start_date: null, end_date: null }, now), {
      text: "Draft",
      tone: "draft",
    });
    assert.deepEqual(tripRowTag({ start_date: "2026-10-04", end_date: "2026-10-05" }, now), {
      text: "Underway",
      tone: "live",
    });
    assert.deepEqual(tripRowTag({ start_date: "2026-10-05", end_date: "2026-10-06" }, now), {
      text: "Tomorrow",
      tone: "soon",
    });
    assert.deepEqual(tripRowTag({ start_date: "2026-10-10", end_date: "2026-10-12" }, now), {
      text: "In 6 days",
      tone: "soon",
    });
    assert.deepEqual(
      tripRowTag(
        { start_date: "2026-12-10", end_date: "2026-12-12", dates_status: "tentative" },
        now,
      ),
      { text: "Tentative", tone: "draft" },
    );
    assert.equal(
      tripRowTag({ start_date: "2026-12-10", end_date: "2026-12-12", dates_status: "fixed" }, now),
      null,
    );
    assert.equal(
      tripRowTag(
        { start_date: "2026-01-10", end_date: "2026-01-12", dates_status: "tentative" },
        now,
      ),
      null,
    );
  });
});

describe("tripMonth", () => {
  it("names the start month, else the end month", () => {
    const month = (y: number, m: number) =>
      new Date(y, m, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
    assert.equal(tripMonth("2026-10-08"), month(2026, 9));
    assert.equal(tripMonth(null, "2025-03-02"), month(2025, 2));
    assert.equal(tripMonth(null, null), "");
  });
});

describe("heroTrips", () => {
  it("takes trips ahead, then behind, and drafts only when nothing is dated", () => {
    assert.deepEqual(heroTrips({ upcoming: [1, 2], past: [3, 4, 5], drafts: [9] }), [1, 2, 3, 4]);
    assert.deepEqual(heroTrips({ upcoming: [], past: [], drafts: [9] }), [9]);
  });
});

describe("placeTags", () => {
  it("never covers another trip's pin", () => {
    const pins = [
      { x: 60, y: 200 },
      { x: 150, y: 200 },
    ];
    const [a] = placeTags(pins, [140, 120], { width: 390, top: 100, bottom: 300 });
    assert.ok(!a || !(a.x < 157 && a.x + a.width > 143 && a.y < 207 && a.y + a.height > 193));
  });
  const frame = { width: 390, top: 100, bottom: 300 };
  it("puts a tag right of its pin, or left near the edge", () => {
    const [a, b] = placeTags(
      [
        { x: 50, y: 200 },
        { x: 360, y: 150 },
      ],
      [120, 120],
      frame,
    );
    assert.equal(a!.left, false);
    assert.equal(a!.x, 60);
    assert.equal(b!.left, true);
    assert.equal(b!.x, 230);
  });
  it("moves a tag off one already placed, inside the frame", () => {
    const [a, b] = placeTags(
      [
        { x: 50, y: 200 },
        { x: 60, y: 205 },
      ],
      [120, 120],
      frame,
    );
    assert.ok(Math.abs(a!.y - b!.y) >= 44 + 6);
    for (const box of [a!, b!]) assert.ok(box.y >= 100 && box.y + box.height <= 300);
  });
});

describe("groupByPlace", () => {
  it("puts trips to one place together, keeping order", () => {
    const lisbon = { id: 1, lat: 38.72, lon: -9.14 };
    const porto = { id: 2, lat: 41.15, lon: -8.61 };
    const lisbonAgain = { id: 3, lat: 38.74, lon: -9.15 };
    assert.deepEqual(groupByPlace([lisbon, porto, lisbonAgain]), [[lisbon, lisbonAgain], [porto]]);
  });
});

describe("placeTags with trips to one place", () => {
  it("never leaves two tags on top of each other", () => {
    const pins = Array.from({ length: 4 }, () => ({ x: 100, y: 200 }));
    const boxes = placeTags(pins, [120, 120, 120, 120], { width: 390, top: 100, bottom: 300 });
    const placed = boxes.filter((b) => b !== null);
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        assert.ok(
          a.x >= b.x + b.width ||
            b.x >= a.x + a.width ||
            a.y >= b.y + b.height ||
            b.y >= a.y + a.height,
        );
      }
  });
});
