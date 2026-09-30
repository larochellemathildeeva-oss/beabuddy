import { strict as assert } from "node:assert";
import { test } from "node:test";
import { estimatedLegMeters, estimatedLegSeconds, plannedRideSeconds } from "./route-estimate.ts";

test("a 1 km straight line is about an 18 minute walk", () => {
  assert.equal(estimatedLegSeconds(1000, "walking"), 18 * 60);
  assert.equal(estimatedLegMeters(1000, "walking"), 1300);
});

test("a 10 km straight line is about a half-hour drive", () => {
  assert.equal(estimatedLegSeconds(10_000, "driving"), 28 * 60);
});

test("never under a minute, and nothing for no distance", () => {
  assert.equal(estimatedLegSeconds(20, "walking"), 60);
  assert.equal(estimatedLegSeconds(0, "walking"), 0);
  assert.equal(estimatedLegMeters(0, "driving"), 0);
});

test("a 5 km straight line is about half an hour on transit, waiting included", () => {
  assert.equal(estimatedLegSeconds(5_000, "transit"), 28 * 60);
  assert.equal(estimatedLegMeters(5_000, "transit"), 6500);
});

test("a ride between towns is timed at a train's or a highway's pace", () => {
  // Himeji Castle to Sannomiya, about 52 km apart: 40 minutes by JR.
  assert.equal(estimatedLegSeconds(52_000, "transit"), 73 * 60);
  assert.equal(estimatedLegSeconds(52_000, "driving"), 73 * 60);
  // Kansai Airport to Kyoto, about 79 km: the HARUKA is 75 minutes; it read 5 h 18 min.
  assert.ok(estimatedLegSeconds(79_000, "transit") < 110 * 60);
});

test("a ride between two timed stations takes the plan's own time", () => {
  const kyoto = {
    title: "Kyoto Station",
    kind: "transport",
    day_date: "2026-10-04",
    time_label: "14:45",
  };
  const shinOsaka = {
    title: "Shin-Osaka Station",
    kind: "transport",
    day_date: "2026-10-04",
    time_label: "15:00",
  };
  assert.equal(plannedRideSeconds(kyoto, shinOsaka), 15 * 60);
  // Not a station at one end, another day, no time, or times out of order.
  assert.equal(plannedRideSeconds({ ...kyoto, kind: "sight" }, shinOsaka), null);
  assert.equal(plannedRideSeconds(kyoto, { ...shinOsaka, day_date: "2026-10-05" }), null);
  assert.equal(plannedRideSeconds(kyoto, { ...shinOsaka, time_label: null }), null);
  assert.equal(plannedRideSeconds(shinOsaka, kyoto), null);
  // Named by its pier's address, the boat's arrival still counts.
  const arrival = {
    title: "Miyajima arrival",
    address: "Miyajima Pier No. 3, Hatsukaichi",
    kind: "transport",
    day_date: "2026-10-07",
    time_label: "12:35",
  };
  const motoyasu = { ...arrival, title: "Motoyasu Pier", address: null, time_label: "11:50" };
  assert.equal(plannedRideSeconds(motoyasu, arrival), 45 * 60);
  // Two timed transfers are not one ride.
  const taxi = { title: "Taxi to the hotel", kind: "transport", day_date: "2026-10-04" };
  assert.equal(plannedRideSeconds({ ...taxi, time_label: "14:00" }, shinOsaka), null);
});
