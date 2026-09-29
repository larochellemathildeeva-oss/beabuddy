import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  checkupHeadline,
  idDocumentExpiry,
  longWalkingDays,
  missingReferences,
  missingStay,
  outsideDates,
  timingClashes,
  tripCheckup,
  unplacedStops,
  untimedTravel,
  type CheckupItem,
} from "./trip-checkup.ts";

let n = 0;
const item = (extra: Partial<CheckupItem>): CheckupItem => ({
  id: `i${++n}`,
  title: "Stop",
  kind: "sight",
  day_date: "2026-10-06",
  time_label: null,
  ...extra,
});
const trip = { start_date: "2026-10-05", end_date: "2026-10-09" };

test("stops outside the trip's dates are named", () => {
  const found = outsideDates(trip, [
    item({ title: "Belém Tower", day_date: "2026-10-11" }),
    item({ title: "Alfama", day_date: "2026-10-06" }),
  ]);
  assert.equal(found.length, 1);
  assert.match(found[0]!.detail, /Belém Tower/);
  assert.deepEqual(outsideDates({ start_date: null, end_date: null }, [item({})]), []);
});

test("a planned stay that runs into the next stop is a clash", () => {
  const museum = item({ title: "Gulbenkian", time_label: "14:00", planned_stay_minutes: 180 });
  const dinner = item({ title: "Dinner", kind: "meal", time_label: "16:30" });
  const [found] = timingClashes([dinner, museum]);
  assert.equal(found?.title, "Gulbenkian runs into Dinner");
  assert.match(found!.detail, /until 17:00/);
});

test("two stops at the same minute clash; a stop inside another does not", () => {
  const park = item({ title: "Park", time_label: "10:00" });
  const inside = item({ title: "Cenotaph", time_label: "10:00", parent_id: park.id });
  assert.deepEqual(timingClashes([park, inside]), []);
  const other = item({ title: "Cafe", time_label: "10:00" });
  assert.equal(timingClashes([park, other])[0]?.title, "Two stops at 10:00");
});

test("a journey plainly longer than the gap is flagged; a comfortable one is not", () => {
  // About 8 km apart, 15 minutes between: by road that is ~23 minutes.
  const a = item({ title: "Belém", time_label: "10:00", lat: 38.6916, lon: -9.216 });
  const b = item({ title: "Oriente", time_label: "10:15", lat: 38.7678, lon: -9.099 });
  assert.equal(timingClashes([a, b])[0]?.title, "Not enough time to reach Oriente");
  const later = { ...b, time_label: "11:30" };
  assert.deepEqual(timingClashes([a, later]), []);
  // Without pins there is nothing to measure, so nothing is said.
  assert.deepEqual(timingClashes([{ ...a, lat: null, lon: null }, b]), []);
});

test("directions rows and notes never count as stops", () => {
  const a = item({
    title: "Walk to Alfama",
    kind: "walk",
    time_label: "10:00",
    planned_stay_minutes: 60,
  });
  const b = item({ title: "Alfama", time_label: "10:15" });
  assert.deepEqual(timingClashes([a, b]), []);
});

test("a long day on foot is mentioned; hops too long to walk are left out", () => {
  const path = [0, 1, 2, 3, 4, 5, 6].map((k) =>
    item({ title: `S${k}`, lat: 38.7 + (k % 2) * 0.02, lon: -9.14 }),
  );
  const found = longWalkingDays(path);
  assert.equal(found.length, 1);
  assert.match(found[0]!.detail, /km of walking/);
  const far = [item({ lat: 38.7, lon: -9.14 }), item({ lat: 41.15, lon: -8.61 })];
  assert.deepEqual(longWalkingDays(far), []);
});

test("travel without a time is a warning", () => {
  const found = untimedTravel([
    item({ title: "Flight to Porto", kind: "flight" }),
    item({ title: "Train to Sintra", kind: "transport", time_label: "09:10" }),
    item({ title: "Drive to Cascais", kind: "transport" }),
  ]);
  assert.deepEqual(
    found.map((f) => f.title),
    ["Flight to Porto has no time"],
  );
});

test("stops with neither pin nor address are listed together", () => {
  const found = unplacedStops([
    item({ title: "Tasca" }),
    item({ title: "Miradouro", address: "Largo" }),
    item({ title: "Note to self", kind: "note" }),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.detail.startsWith("Tasca."), true);
});

test("booked travel and stays without a reference, unless a document carries it", () => {
  const hotel = item({ title: "Hotel", kind: "hotel", booked: true });
  const flight = item({ title: "Flight", kind: "flight", booked: true, booking_ref: "ABC123" });
  const dinner = item({ title: "Dinner", kind: "meal", booked: true });
  assert.match(missingReferences([hotel, flight, dinner])[0]!.detail, /^Hotel\./);
  assert.deepEqual(
    missingReferences(
      [hotel],
      [{ kind: "accommodation", itinerary_item_id: hotel.id, reference: "X9" }],
    ),
    [],
  );
});

test("two nights with nowhere to stay", () => {
  assert.equal(missingStay(trip, [item({})])[0]?.id, "no-stay");
  assert.deepEqual(missingStay(trip, [item({ kind: "hotel" })]), []);
  assert.deepEqual(missingStay(trip, [], [{ kind: "accommodation" }]), []);
  assert.deepEqual(missingStay({ start_date: "2026-10-05", end_date: "2026-10-06" }, []), []);
});

test("passports and visas that expire before, during or soon after the trip", () => {
  const doc = (kind: string, expires_on: string) => ({ kind, label: `${kind} A`, expires_on });
  assert.match(
    idDocumentExpiry(trip, [doc("Passport", "2026-10-01")])[0]!.title,
    /will have expired/,
  );
  assert.match(
    idDocumentExpiry(trip, [doc("Passport", "2026-10-07")])[0]!.title,
    /during the trip/,
  );
  assert.match(idDocumentExpiry(trip, [doc("Passport", "2027-02-01")])[0]!.title, /six months/);
  assert.deepEqual(idDocumentExpiry(trip, [doc("Passport", "2027-06-01")]), []);
  // A visa only has to last the trip.
  assert.deepEqual(idDocumentExpiry(trip, [doc("Visa", "2027-02-01")]), []);
  assert.deepEqual(idDocumentExpiry(trip, [doc("Insurance", "2026-10-01")]), []);
});

test("the checkup puts what can spoil a day first", () => {
  const found = tripCheckup({
    trip,
    items: [item({ title: "Tasca" }), item({ title: "Flight", kind: "flight" })],
  });
  assert.equal(found[0]!.level, "warn");
  assert.equal(found.at(-1)!.level, "info");
  assert.match(checkupHeadline(found), /found \d things worth checking/);
  assert.match(checkupHeadline([]), /Nothing to fix/);
});
