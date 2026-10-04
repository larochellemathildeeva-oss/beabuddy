import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { savedCities, savedSummary, todaysCompanion, untilLabel } from "./home-now.ts";

const stop = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  kind: "sight",
  day_date: "2026-10-04",
  time_label: null,
  arrived_at: null,
  left_at: null,
  ...extra,
});

describe("todaysCompanion", () => {
  it("is where you are and what comes next, from the taps", () => {
    const state = todaysCompanion(
      [
        stop("a", { arrived_at: "2026-10-04T08:00:00Z", left_at: "2026-10-04T09:00:00Z" }),
        stop("b", { arrived_at: "2026-10-04T10:00:00Z" }),
        stop("c"),
        stop("other-day", { day_date: "2026-10-05" }),
      ],
      "2026-10-04",
    );
    assert.equal(state.phase, "at");
    assert.equal(state.current?.id, "b");
    assert.equal(state.next?.id, "c");
    assert.equal(state.stops.length, 3);
  });

  it("offers only a next stop before anything is tapped", () => {
    const state = todaysCompanion([stop("a"), stop("b")], "2026-10-04");
    assert.equal(state.phase, "not-started");
    assert.equal(state.current, null);
    assert.equal(state.next?.id, "a");
  });

  it("leaves journeys between stops out", () => {
    const state = todaysCompanion(
      [stop("walk", { kind: "transport", title: "Travel to the museum" }), stop("a")],
      "2026-10-04",
    );
    assert.equal(state.next?.id, "a");
  });

  it("has nothing for a day with no stops", () => {
    const state = todaysCompanion([stop("a", { day_date: "2026-10-05" })], "2026-10-04");
    assert.equal(state.next, null);
    assert.equal(state.stops.length, 0);
  });
});

describe("untilLabel", () => {
  const now = new Date(2026, 9, 4, 10, 30);
  it("counts the minutes, then the hours", () => {
    assert.equal(untilLabel("10:50", now), "In 20 min");
    assert.equal(untilLabel("12:50", now), "In 2 h 20 min");
    assert.equal(untilLabel("13:30", now), "In 3 h");
  });
  it("says nothing for a time that has gone or none at all", () => {
    assert.equal(untilLabel("09:00", now), "");
    assert.equal(untilLabel("10:30", now), "");
    assert.equal(untilLabel(null, now), "");
    assert.equal(untilLabel("Lunch", now), "");
  });
});

describe("savedCities", () => {
  const place = (city: string | null, extra: Record<string, unknown> = {}) => ({
    city,
    country: "Portugal",
    lat: 38.7,
    lon: -9.1,
    ...extra,
  });
  it("groups by city, most places first, one row per spelling", () => {
    const rows = savedCities([
      place("Lisbon"),
      place("Lisbon, Portugal"),
      place("Porto", { lat: 41.1, lon: -8.6 }),
      place("lisbon"),
    ]);
    assert.deepEqual(
      rows.map((r) => [r.city, r.count]),
      [
        ["Lisbon", 3],
        ["Porto", 1],
      ],
    );
  });
  it("leaves out visited places and places with no city", () => {
    const rows = savedCities([place("Lisbon", { visited: true }), place(null), place("")]);
    assert.deepEqual(rows, []);
  });
  it("puts a city in the middle of its pins, or nowhere without any", () => {
    const [kyoto] = savedCities([
      place("Kyoto", { lat: 35, lon: 135 }),
      place("Kyoto", { lat: 36, lon: 137 }),
    ]);
    assert.equal(kyoto?.lat, 35.5);
    assert.equal(kyoto?.lon, 136);
    const [bare] = savedCities([place("Nara", { lat: null, lon: null })]);
    assert.equal(bare?.lat, null);
  });
});

describe("savedSummary", () => {
  it("counts places and cities", () => {
    const cities = savedCities([
      { city: "Lisbon", country: null, lat: null, lon: null },
      { city: "Lisbon", country: null, lat: null, lon: null },
      { city: "Kyoto", country: null, lat: null, lon: null },
    ]);
    assert.deepEqual(savedSummary(cities), {
      strong: "3 saved places",
      rest: " in 2 cities are waiting for a trip.",
    });
  });
  it("speaks of one place in the singular", () => {
    const one = savedCities([{ city: "Kyoto", country: null, lat: null, lon: null }]);
    assert.deepEqual(savedSummary(one), {
      strong: "1 saved place",
      rest: " in Kyoto is waiting for a trip.",
    });
  });
});
