import { test } from "node:test";
import assert from "node:assert/strict";
import { laterHeading, packingReadiness, tripHighlights } from "./home-trip.ts";

const row = (kind: string, title: string) => ({
  kind,
  title,
  detail: null,
  time_label: null,
  day_date: null,
});

test("the flight out and the stay, and nothing guessed", () => {
  const rows = [
    row("meal", "Breakfast"),
    row("transport", "AC 781 to LAX"),
    row("hotel", "The Line Hotel"),
    row("flight", "Return flight"),
  ];
  const { flight, lodging } = tripHighlights(rows);
  assert.equal(flight?.title, "Return flight", "a flight row wins over a transport row");
  assert.equal(lodging?.title, "The Line Hotel");
  assert.equal(tripHighlights([row("transport", "AC 781 to LAX")]).flight?.title, "AC 781 to LAX");
  assert.deepEqual(tripHighlights([row("transport", "Tram to the park"), row("meal", "Lunch")]), {
    flight: null,
    lodging: null,
  });
});

test("packing readiness counts what is packed", () => {
  assert.equal(packingReadiness([]), null);
  assert.deepEqual(
    packingReadiness([{ packed: true }, { packed: false }, { packed: true }, { packed: false }]),
    {
      packed: 2,
      total: 4,
      ratio: 0.5,
    },
  );
});

test("the heading over later trips says only what is true", () => {
  const sep24 = new Date("2026-09-24T12:00:00");
  assert.equal(laterHeading(["2026-10-07", "2026-11-20"], sep24), "Later this autumn");
  assert.equal(laterHeading(["2026-10-07", "2026-12-20"], sep24), "Later this year");
  assert.equal(laterHeading(["2027-02-01"], sep24), "Coming up");
  assert.equal(laterHeading(["2026-10-07", null], sep24), "Coming up");
  assert.equal(laterHeading(["2027-01-10"], new Date("2026-12-24T12:00:00")), "Later this winter");
});
