import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { RouteLeg } from "./directions.functions.ts";
import type { DirectionStop } from "./direction-stops.ts";
import { directionsToAsk, legStillHolds, mergeLegs } from "./directions-reuse.ts";

const hotel: DirectionStop = { id: "h", title: "Hotel", lat: 35.0, lon: 135.76 };
const market: DirectionStop = { id: "m", title: "Market", lat: 35.005, lon: 135.765 };
const temple: DirectionStop = { id: "t", title: "Temple", lat: 35.01, lon: 135.77 };
const cafe: DirectionStop = { id: "c", title: "Cafe", lat: 35.003, lon: 135.762 };

function walk(from: DirectionStop, to: DirectionStop, extra: Partial<RouteLeg> = {}): RouteLeg {
  return {
    from: from.title,
    to: to.title,
    mode: "walking",
    distance: 700,
    duration: 540,
    steps: [],
    mapUrl: "",
    fromLat: from.lat!,
    fromLon: from.lon!,
    toLat: to.lat!,
    toLon: to.lon!,
    ...extra,
  };
}

test("a journey between the same two stops still holds", () => {
  assert.equal(legStillHolds(walk(hotel, market), hotel, market, "auto"), true);
});

test("a journey that led somewhere else, or from somewhere else, does not", () => {
  assert.equal(legStillHolds(walk(hotel, market), hotel, cafe, "auto"), false);
  assert.equal(legStillHolds(walk(cafe, market), hotel, market, "auto"), false);
  // A row saved before it kept where it leaves from.
  assert.equal(legStillHolds({ ...walk(hotel, market), from: "" }, hotel, market, "auto"), false);
});

test("a moved pin, a capped leg or another way of getting around is asked again", () => {
  const moved = { ...market, lat: 35.02 };
  assert.equal(legStillHolds(walk(hotel, market), hotel, moved, "auto"), false);
  assert.equal(legStillHolds(walk(hotel, market, { capped: true }), hotel, market, "auto"), false);
  assert.equal(legStillHolds(walk(hotel, market), hotel, market, "drive"), false);
});

test("an unknown spot holds until both stops are on the map", () => {
  const nowhere: DirectionStop = { id: "n", title: "Market" };
  const unknown = { ...walk(hotel, market), unknownSpot: true };
  delete unknown.toLat;
  delete unknown.toLon;
  assert.equal(legStillHolds(unknown, hotel, nowhere, "auto"), true);
  assert.equal(legStillHolds(unknown, hotel, market, "auto"), false);
});

test("a stop added in the middle asks only the journeys into and out of it", () => {
  const stops = [hotel, cafe, market, temple];
  const known = [
    { leg: walk(hotel, market), onTimeline: true }, // was hotel → market
    { leg: walk(market, temple), onTimeline: true }, // index shifted
    { leg: walk(market, temple), onTimeline: true },
  ];
  const { keep, ask } = directionsToAsk(stops, known, "auto");
  assert.deepEqual(ask, [0, 1]);
  assert.equal(keep[2]?.leg.to, "Temple");

  const fresh = [walk(hotel, cafe), walk(cafe, market)];
  const legs = mergeLegs(keep, ask, fresh);
  assert.deepEqual(
    legs?.map((l) => `${l.from}→${l.to}`),
    ["Hotel→Cafe", "Cafe→Market", "Market→Temple"],
  );
});

test("with nothing new, every journey is asked again", () => {
  const stops = [hotel, market];
  const { keep, ask } = directionsToAsk(
    stops,
    [{ leg: walk(hotel, market), onTimeline: false }],
    "auto",
  );
  assert.deepEqual(ask, [0]);
  assert.deepEqual(keep, [undefined]);
});

test("an answer short of a leg is not merged", () => {
  const { keep, ask } = directionsToAsk([hotel, cafe, market], [], "auto");
  assert.equal(mergeLegs(keep, ask, [walk(hotel, cafe)]), null);
});
