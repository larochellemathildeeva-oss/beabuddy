import { strict as assert } from "node:assert";
import { test } from "node:test";
import { daysForMaps } from "./day-maps.ts";

const row = (
  day: string | null,
  title: string,
  lat: number | null,
  lon: number | null,
  kind = "activity",
) => ({
  kind,
  title,
  day_date: day,
  lat,
  lon,
});

test("one map per day, pins in order, journeys and missing pins left out", () => {
  const days = daysForMaps([
    row("2026-10-08", "Shukkeien", 34.4, 132.46),
    row("2026-10-07", "Museum", 34.39, 132.45),
    row("2026-10-07", "Walk to the Dome", 34.391, 132.451, "transport"),
    row("2026-10-07", "Dome", 34.395, 132.453),
    row("2026-10-07", "Lunch somewhere", null, null),
    row("2026-10-07", "Null island", 0, 0),
    row(null, "Undated", 35, 135),
  ]);
  assert.deepEqual(days, [
    {
      day: "2026-10-07",
      points: [
        { lat: 34.39, lon: 132.45 },
        { lat: 34.395, lon: 132.453 },
      ],
    },
    { day: "2026-10-08", points: [{ lat: 34.4, lon: 132.46 }] },
  ]);
});

test("a day with nothing on the map gets no picture; long trips are capped", () => {
  assert.deepEqual(daysForMaps([row("2026-10-07", "Somewhere", null, null)]), []);
  const many = Array.from({ length: 30 }, (_, i) =>
    row(`2026-11-${String(i + 1).padStart(2, "0")}`, `Stop ${i}`, 1, 1),
  );
  assert.equal(daysForMaps(many, 21).length, 21);
});
