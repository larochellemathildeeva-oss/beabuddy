import { strict as assert } from "node:assert";
import { test } from "node:test";
import { arrivalHelp, arrivalPoint, type ArrivalStop } from "./arrival-help.ts";

const stop = (title: string, kind: string, extra: Partial<ArrivalStop> = {}): ArrivalStop => ({
  id: title,
  title,
  kind,
  time_label: null,
  ...extra,
});

test("where a journey ends, when it can be said", () => {
  assert.deepEqual(arrivalPoint(stop("Flight to Lisbon", "flight")), { title: "Lisbon airport" });
  assert.deepEqual(arrivalPoint(stop("Train from Porto to Lisbon", "transport")), {
    title: "Lisbon station",
  });
  assert.deepEqual(arrivalPoint(stop("Arrive at Narita Airport", "transport")), {
    title: "Narita Airport",
  });
  assert.deepEqual(arrivalPoint(stop("Flight AC870", "flight", { lat: 38.77, lon: -9.13 })), {
    title: "Flight AC870",
    lat: 38.77,
    lon: -9.13,
  });
  assert.equal(arrivalPoint(stop("Transfer", "transport")), null);
});

test("the journey in is paired with the stay after it", () => {
  const help = arrivalHelp([
    stop("Breakfast", "meal"),
    stop("Flight to Lisbon", "flight", { time_label: "09:00" }),
    stop("Lunch", "meal"),
    stop("Hotel Avenida check-in", "hotel", { time_label: "15:00", address: "Av. da Liberdade" }),
  ]);
  assert.equal(help?.arrival.title, "Flight to Lisbon");
  assert.equal(help?.stay.title, "Hotel Avenida check-in");
  assert.equal(help?.checkIn, "15:00");
});

test("no stay after the journey, or no place to start from: nothing", () => {
  assert.equal(arrivalHelp([stop("Hotel", "hotel"), stop("Flight to Porto", "flight")]), null);
  assert.equal(arrivalHelp([stop("Transfer", "transport"), stop("Hotel", "hotel")]), null);
  assert.equal(arrivalHelp([stop("Museum", "sight")]), null);
});
