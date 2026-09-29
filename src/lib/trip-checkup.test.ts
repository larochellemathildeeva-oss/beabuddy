import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkupHeadline, checkupPill, tripCheckup, type CheckupStop } from "./trip-checkup.ts";

let n = 0;
function stop(over: Partial<CheckupStop>): CheckupStop {
  n += 1;
  return {
    id: `s${n}`,
    kind: "sight",
    title: `Stop ${n}`,
    day_date: "2026-10-02",
    time_label: null,
    lat: 38.71,
    lon: -9.14,
    booked: false,
    booking_ref: null,
    planned_stay_minutes: null,
    ...over,
  };
}

const hotel = () =>
  stop({
    kind: "hotel",
    title: "Hotel Lis",
    booked: true,
    booking_ref: "AB12",
    time_label: "15:00",
  });
const trip = { start_date: "2026-10-01", end_date: "2026-10-04" };

test("a plan the arithmetic cannot fault says nothing", () => {
  const items = [
    hotel(),
    stop({ title: "Museum", time_label: "10:00", planned_stay_minutes: 90 }),
    stop({ kind: "meal", title: "Lunch", time_label: "12:30", lat: 38.711, lon: -9.141 }),
  ];
  const found = tripCheckup({ ...trip, items });
  assert.deepEqual(found, []);
  assert.equal(checkupHeadline(found), "Béa checked the whole trip. Nothing needs a second look.");
  assert.equal(checkupPill(found), "All clear");
});

test("stops dated outside the trip are flagged first", () => {
  const items = [
    hotel(),
    stop({ kind: "meal", title: "Lunch", booked: false }),
    stop({ title: "Tram 28", day_date: "2026-10-09" }),
    stop({ title: "Early bird", day_date: "2026-09-30" }),
  ];
  const found = tripCheckup({ ...trip, items });
  assert.equal(found[0]?.text, "Tram 28 is on Oct 9, after the trip ends (Oct 4).");
  assert.equal(found[1]?.text, "Early bird is on Sep 30, before the trip starts (Oct 1).");
  assert.equal(found[0]?.tone, "warn");
  assert.equal(found[0]?.dayLabel, "Fri · Oct 9");
});

test("two stops at the same time, or a stay running into the next", () => {
  const items = [
    hotel(),
    stop({ title: "Museum", time_label: "10:00", planned_stay_minutes: 120 }),
    stop({ title: "Castle", time_label: "11:00" }),
    stop({ kind: "meal", title: "Lunch", time_label: "13:00" }),
    stop({ title: "Tiles", time_label: "13:00" }),
  ];
  const texts = tripCheckup({ ...trip, items }).map((f) => f.text);
  assert.deepEqual(texts, [
    "Museum runs until 12:00, but Castle starts at 11:00.",
    "Lunch and Tiles are both at 13:00.",
  ]);
});

test("a journey the gap cannot hold, measured when a route is known", () => {
  const a = stop({ title: "Belém", time_label: "10:00", lat: 38.6916, lon: -9.216 });
  const b = stop({ kind: "meal", title: "Lunch", time_label: "10:30", lat: 38.7139, lon: -9.1334 });
  const items = [hotel(), a, b];
  // Straight line is ~7.6 km: nobody walks it, so no guess is made.
  assert.deepEqual(tripCheckup({ ...trip, items }), []);
  // A measured route of 45 min against a 30 min gap is worth saying.
  const found = tripCheckup({ ...trip, items, travelMinutes: () => 45 });
  assert.equal(found.length, 1);
  assert.equal(
    found[0]?.text,
    "30 min between Belém and Lunch, and getting to Lunch takes about 45 min.",
  );
  assert.equal(found[0]?.stopId, b.id);
});

test("without a route, a short straight-line walk is the estimate", () => {
  const a = stop({ title: "Rossio", time_label: "10:00", lat: 38.7139, lon: -9.1394 });
  // ~2.2 km away: about 31 min at a slow city pace, against a 15 min gap.
  const b = stop({ title: "Alfama", time_label: "10:15", lat: 38.7118, lon: -9.1136 });
  const found = tripCheckup({ ...trip, items: [hotel(), a, b] });
  assert.equal(found.length, 1);
  assert.match(
    found[0]!.text,
    /^15 min between Rossio and Alfama, and the walk to Alfama alone is about \d+ min\.$/,
  );
});

test("stay minutes count against the gap", () => {
  const a = stop({ title: "Gulbenkian", time_label: "10:00", planned_stay_minutes: 100 });
  const b = stop({ kind: "meal", title: "Lunch", time_label: "12:00" });
  const found = tripCheckup({ ...trip, items: [hotel(), a, b], travelMinutes: () => 35 });
  assert.equal(
    found[0]?.text,
    "20 min to spare after Gulbenkian, and getting to Lunch takes about 35 min.",
  );
  // Short by only five minutes: rounding, not a problem.
  assert.equal(tripCheckup({ ...trip, items: [hotel(), a, b], travelMinutes: () => 5 }).length, 0);
});

test("untimed or unpinned stops are never called late or far", () => {
  const items = [
    hotel(),
    stop({ title: "Morning", time_label: "Morning" }),
    stop({ title: "Pinless", time_label: "10:05", lat: null, lon: null, kind: "note" }),
    stop({ title: "Next", time_label: "10:10" }),
  ];
  assert.deepEqual(tripCheckup({ ...trip, items }), []);
});

test("hotels and flights are not part of the day's sequence", () => {
  const items = [
    stop({ kind: "flight", title: "TP 123", time_label: "10:00", booked: true, booking_ref: "X" }),
    stop({ kind: "hotel", title: "Hotel", time_label: "10:00", booked: true, booking_ref: "Y" }),
    stop({ title: "Museum", time_label: "10:00" }),
  ];
  assert.deepEqual(tripCheckup({ ...trip, items }), []);
});

test("bookings: not marked booked, or booked with no confirmation number", () => {
  const items = [
    stop({ kind: "flight", title: "Flight to Lisbon", booked: false }),
    stop({ kind: "hotel", title: "Casa", booked: true, booking_ref: "  " }),
    stop({ kind: "transport", title: "Metro", booked: false }),
    stop({ kind: "meal", title: "Dinner", booked: false }),
  ];
  const texts = tripCheckup({ ...trip, items }).map((f) => f.text);
  assert.deepEqual(texts, [
    "Flight to Lisbon isn't marked as booked yet.",
    "Casa is marked booked, but no confirmation number is saved.",
  ]);
});

test("missing pins, stray pins, undated stops and no place to stay", () => {
  const far = stop({ title: "Far away" });
  const items = [
    stop({ title: "Unpinned", lat: null, lon: null }),
    stop({ title: "Failed geocode", lat: 0, lon: 0 }),
    stop({ kind: "walk", title: "River walk", lat: null, lon: null }),
    far,
    stop({ title: "Someday", day_date: null }),
    stop({ kind: "note", title: "Remember", day_date: null }),
  ];
  const found = tripCheckup({ ...trip, items, strayIds: new Set([far.id]) });
  assert.deepEqual(
    found.map((f) => [f.kind, f.text]),
    [
      ["unplaced", "Unpinned isn't on the map yet."],
      ["unplaced", "Failed geocode isn't on the map yet."],
      ["stray", "Far away is pinned far from the rest of the trip."],
      ["undated", "1 stop isn't on a day yet."],
      ["no-stay", "No place to stay is on the plan yet."],
    ],
  );
  assert.equal(found.at(-1)?.stopId, null);
  assert.equal(checkupHeadline(found), "Béa found 5 things worth checking.");
  assert.equal(checkupPill(found), "5 to check");
});

test("a trip without dates skips the date checks, and a day trip needs no bed", () => {
  const items = [stop({ day_date: null }), stop({ day_date: "2030-01-01" })];
  assert.deepEqual(tripCheckup({ items }), []);
  assert.deepEqual(
    tripCheckup({ start_date: "2026-10-02", end_date: "2026-10-02", items: [stop({})] }),
    [],
  );
});

test("keys are stable and unique", () => {
  const items = [
    hotel(),
    stop({ title: "A", time_label: "09:00" }),
    stop({ title: "B", time_label: "09:00" }),
    stop({ title: "C", time_label: "09:00" }),
  ];
  const keys = tripCheckup({ ...trip, items }).map((f) => f.key);
  assert.equal(keys.length, 2);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(
    keys,
    tripCheckup({ ...trip, items }).map((f) => f.key),
  );
});
