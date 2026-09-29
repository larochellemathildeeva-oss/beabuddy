import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  againTitle,
  copyDayItems,
  dayOffset,
  duplicateStops,
  duplicateTripItems,
  shiftDay,
  type SourceItem,
} from "./trip-duplicate.ts";

const ids = () => {
  let n = 0;
  return () => `new-${++n}`;
};
const item = (id: string, extra: Partial<SourceItem>): SourceItem => ({
  id,
  day_date: "2024-05-01",
  time_label: null,
  kind: "sight",
  title: id,
  detail: null,
  address: null,
  lat: null,
  lon: null,
  position: 0,
  planned_stay_minutes: null,
  ...extra,
});

test("days move by whole days, across months and leap years", () => {
  assert.equal(dayOffset("2024-05-01", "2026-10-05"), 887);
  assert.equal(shiftDay("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftDay("2024-12-31", 1), "2025-01-01");
  assert.equal(shiftDay(null, 3), null);
  assert.equal(dayOffset("2024-05-01", null), null);
});

test("a duplicate keeps the plan and leaves bookings, progress and directions behind", () => {
  const park = item("park", { position: 0, day_date: "2024-05-01", time_label: "10:00" });
  const rows = duplicateTripItems(
    [
      {
        ...park,
        booked: true,
        booking_ref: "X9",
        arrived_at: "2024-05-01T10:00:00Z",
      } as SourceItem,
      item("cenotaph", { position: 1, parent_id: "park", inside: [{ title: "Bell" }] as never }),
      item("Walk to Alfama", { position: 2, kind: "walk" }),
      item("dinner", { position: 3, day_date: "2024-05-02" }),
    ],
    3,
    ids(),
  );
  assert.deepEqual(
    rows.map((r) => [r.id, r.title, r.day_date, r.position]),
    [
      ["new-1", "park", "2024-05-04", 0],
      ["new-2", "cenotaph", "2024-05-04", 1],
      ["new-3", "dinner", "2024-05-05", 2],
    ],
  );
  assert.equal(rows[1]!.parent_id, "new-1", "a stop inside another points at the copy");
  assert.equal(rows[0]!.time_label, "10:00");
  for (const row of rows) {
    assert.equal("booked" in row || "booking_ref" in row || "arrived_at" in row, false);
  }
});

test("a day copied onto another lands after what is there", () => {
  const rows = copyDayItems(
    [item("a", { position: 5 }), item("b", { position: 2 }), item("c", { day_date: "2024-05-02" })],
    "2024-05-01",
    "2026-10-06",
    ids(),
    40,
  );
  assert.deepEqual(
    rows.map((r) => [r.title, r.day_date, r.position]),
    [
      ["b", "2026-10-06", 40],
      ["a", "2026-10-06", 41],
    ],
  );
});

test("the trip's cities move with it", () => {
  const stops = duplicateStops(
    [
      {
        kind: "destination",
        city: "Porto",
        country: "PT",
        lat: 1,
        lon: 2,
        arrive_on: "2024-05-03",
        depart_on: "2024-05-05",
        position: 4,
      },
      {
        kind: "destination",
        city: "Lisbon",
        country: "PT",
        lat: 1,
        lon: 2,
        arrive_on: "2024-05-01",
        depart_on: null,
        position: 1,
      },
    ],
    10,
  );
  assert.deepEqual(
    stops.map((s) => [s.city, s.arrive_on, s.depart_on, s.position]),
    [
      ["Lisbon", "2024-05-11", null, 0],
      ["Porto", "2024-05-13", "2024-05-15", 1],
    ],
  );
});

test("the copy's name", () => {
  assert.equal(againTitle("Lisbon"), "Lisbon again");
  assert.equal(againTitle("Lisbon again"), "Lisbon again");
});
