import { test } from "node:test";
import assert from "node:assert/strict";
import {
  laterHeading,
  laterTrips,
  packingReadiness,
  peopleOnTrip,
  pickActiveTrip,
  tripHighlights,
} from "./home-trip.ts";

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

test("the active trip is the one underway, else the soonest ahead", () => {
  const trip = (id: string, start_date: string | null, end_date: string | null) => ({
    id,
    start_date,
    end_date,
  });
  const trips = [
    trip("past", "2026-08-01", "2026-08-05"),
    trip("far", "2026-12-01", "2026-12-05"),
    trip("soon", "2026-10-07", "2026-10-08"),
    trip("now", "2026-09-24", "2026-09-30"),
  ];
  assert.equal(pickActiveTrip(trips, "2026-09-26")?.id, "now");
  assert.equal(pickActiveTrip(trips, "2026-10-01")?.id, "soon");
  assert.deepEqual(
    laterTrips(trips, trips[3]!, "2026-09-26").map((t) => t.id),
    ["soon", "far"],
  );
  assert.equal(pickActiveTrip([trip("x", null, null)], "2026-09-26"), null);
});

test("people on a trip count you once", () => {
  const members = [
    { trip_id: "a", user_id: "me" },
    { trip_id: "a", user_id: "sam" },
    { trip_id: "a", user_id: "ana" },
    { trip_id: "b", user_id: "sam" },
  ];
  assert.equal(peopleOnTrip(members, "a", "me"), 3);
  assert.equal(peopleOnTrip(members, "c", "me"), 1);
});
