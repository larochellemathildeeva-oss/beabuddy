import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  asTripsLayout,
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
    assert.equal(tripMonth("2026-10-08"), "Oct 2026");
    assert.equal(tripMonth(null, "2025-03-02"), "Mar 2025");
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
    assert.ok(!(a!.x < 157 && a!.x + a!.width > 143 && a!.y < 207 && a!.y + a!.height > 193));
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
