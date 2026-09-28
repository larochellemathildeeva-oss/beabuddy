import { strict as assert } from "node:assert";
import { test } from "node:test";
import { prepFacts, prepPlaceLine } from "./trip-prep.ts";

const now = new Date(2026, 8, 27);

test("prepPlaceLine joins place and dates, adding the year only when it differs", () => {
  assert.equal(
    prepPlaceLine(
      { city: "Barreiras", country: "Brazil", start_date: "2024-10-01", end_date: "2024-10-03" },
      now,
    ),
    "Barreiras, Brazil · Oct 1 – 3, 2024",
  );
  assert.equal(
    prepPlaceLine(
      { city: "Lisbon", country: null, start_date: "2026-10-01", end_date: "2026-10-07" },
      now,
    ),
    "Lisbon · Oct 1 – 7",
  );
  assert.equal(prepPlaceLine({ city: "Tokyo", country: "Japan" }, now), "Tokyo, Japan");
  assert.equal(prepPlaceLine({}, now), "");
});

test("prepFacts counts days, stops, flights and stays", () => {
  const facts = prepFacts(
    { start_date: "2024-10-01", end_date: "2024-10-03" },
    [
      { kind: "flight", title: "Flight to Barreiras" },
      { kind: "flight", title: "Flight home" },
      { kind: "hotel", title: "Hotel Central" },
      { kind: "sight", title: "Waterfall" },
      { kind: "meal", title: "Lunch" },
      { kind: "sight", title: "Market" },
    ],
    now,
  );
  assert.deepEqual(facts, [
    { id: "days", value: "3 days", label: "Oct 1 – 3" },
    { id: "stops", value: "6 stops", label: "in itinerary" },
    { id: "flights", value: "2 bookings", label: "flights" },
    { id: "stay", value: "1 booking", label: "hotel" },
  ]);
});

test("prepFacts leaves out what the trip cannot answer", () => {
  assert.deepEqual(prepFacts({}, []), []);
  assert.deepEqual(
    prepFacts({}, [{ kind: "sight", title: "Castle" }]).map((f) => f.id),
    ["stops"],
  );
});
