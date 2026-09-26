import { test } from "node:test";
import assert from "node:assert/strict";
import {
  laterHeading,
  currentHighlights,
  currentLeg,
  laterTrips,
  packingReadiness,
  peopleOnTrip,
  pastTrips,
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

const dated = (kind: string, title: string, day_date: string) => ({
  kind,
  title,
  detail: null,
  time_label: null,
  day_date,
});

test("with several flights and hotels, the next flight and tonight's stay", () => {
  const rows = [
    dated("flight", "Out", "2026-10-07"),
    dated("hotel", "Tokyo hotel", "2026-10-07"),
    dated("transport", "NH 12 to Osaka", "2026-10-10"),
    dated("hotel", "Kyoto inn", "2026-10-10"),
    dated("flight", "Home", "2026-10-14"),
  ];
  const at = (today: string) => {
    const { flight, lodging } = currentHighlights(rows, today);
    return [flight?.title ?? null, lodging?.title ?? null];
  };
  assert.deepEqual(at("2026-09-26"), ["Out", "Tokyo hotel"]);
  assert.deepEqual(at("2026-10-07"), ["Out", "Tokyo hotel"]);
  assert.deepEqual(at("2026-10-08"), ["NH 12 to Osaka", "Tokyo hotel"]);
  assert.deepEqual(at("2026-10-10"), ["NH 12 to Osaka", "Kyoto inn"]);
  assert.deepEqual(at("2026-10-12"), ["Home", "Kyoto inn"]);
  assert.deepEqual(at("2026-10-15"), [null, "Kyoto inn"]);
});

test("undated flights and stays keep plan order", () => {
  const rows = [row("hotel", "First inn"), row("flight", "Out"), row("hotel", "Second inn")];
  const { flight, lodging } = currentHighlights(rows, "2026-10-01");
  assert.equal(flight?.title, "Out");
  assert.equal(lodging?.title, "First inn");
});

test("a trip through several cities shows the city that matters today", () => {
  const stops = [
    { city: "Tokyo, Japan", arrive_on: "2026-10-07", depart_on: "2026-10-10" },
    { city: "Kyoto", arrive_on: "2026-10-10", depart_on: "2026-10-14" },
  ];
  const rows = [
    dated("flight", "Out", "2026-10-07"),
    dated("hotel", "Tokyo hotel", "2026-10-07"),
    dated("flight", "To Kyoto", "2026-10-10"),
    dated("hotel", "Kyoto inn", "2026-10-10"),
    dated("flight", "Home", "2026-10-14"),
  ];
  const at = (today: string) => {
    const leg = currentLeg(stops, rows, today)!;
    return [leg.label, leg.city, leg.flight?.title ?? null, leg.lodging?.title ?? null];
  };
  assert.deepEqual(at("2026-09-26"), ["First stop", "Tokyo", "Out", "Tokyo hotel"]);
  assert.deepEqual(at("2026-10-08"), ["Now in", "Tokyo", "To Kyoto", "Tokyo hotel"]);
  assert.deepEqual(at("2026-10-11"), ["Now in", "Kyoto", "Home", "Kyoto inn"]);
});

test("no leg for one city, or when no city has dates", () => {
  const one = [
    { city: "Lisbon", arrive_on: "2026-10-01", depart_on: null },
    { city: "Lisbon, Portugal", arrive_on: "2026-10-03", depart_on: null },
  ];
  assert.equal(currentLeg(one, [], "2026-09-26"), null);
  const undated = [
    { city: "Tokyo", arrive_on: null, depart_on: null },
    { city: "Kyoto", arrive_on: null, depart_on: null },
  ];
  assert.equal(currentLeg(undated, [], "2026-09-26"), null);
});

test("a finished trip is never the active one, even marked in progress", () => {
  const trips = [
    { id: "japan", start_date: "2026-09-07", end_date: "2026-09-07", status: "in_progress" },
    { id: "undated", start_date: null, end_date: null, status: "upcoming" },
  ];
  assert.equal(pickActiveTrip(trips, "2026-09-26")?.id, "undated");
  assert.equal(pickActiveTrip(trips.slice(0, 1), "2026-09-26"), null);
});

test("past trips: the last year, most recent first", () => {
  const trip = (id: string, start_date: string | null, end_date: string | null) => ({
    id,
    start_date,
    end_date,
  });
  const trips = [
    trip("old", "2025-08-01", "2025-08-05"),
    trip("spring", "2026-04-01", "2026-04-09"),
    trip("japan", "2026-09-07", "2026-09-07"),
    trip("now", "2026-09-24", "2026-09-30"),
    trip("soon", "2026-10-07", null),
    trip("undated", null, null),
    trip("edge", "2025-09-20", "2025-09-26"),
  ];
  assert.deepEqual(
    pastTrips(trips, "2026-09-26").map((t) => t.id),
    ["japan", "spring", "edge"],
  );
  assert.deepEqual(
    pastTrips(trips, "2026-09-26", 1).map((t) => t.id),
    ["japan"],
  );
});
