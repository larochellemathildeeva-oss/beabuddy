import { strict as assert } from "node:assert";
import { test } from "node:test";
import { followedTripCard } from "./trip-follow.ts";
import { sharedTripView } from "./trip-share.ts";

const TRIP = {
  title: "Japan",
  city: "Kyoto, Japan",
  country: "Japan",
  start_date: "2026-10-01",
  end_date: "2026-10-10",
};
const NOW = Date.parse("2026-10-03T03:00:00Z");
const stop = (title: string, position: number, extra: Record<string, string | null> = {}) => ({
  day_date: "2026-10-03",
  time_label: "10:00",
  kind: "sight",
  title,
  address: "1 Somewhere St",
  position,
  ...extra,
});

test("a followed trip's card: what the link shows, cut down", () => {
  const view = sharedTripView(
    TRIP,
    [stop("Fushimi Inari", 0, { arrived_at: "2026-10-03T01:00:00Z" }), stop("Gion", 1)],
    { following: true, now: NOW },
  );
  assert.deepEqual(followedTripCard("tok", view), {
    token: "tok",
    title: "Japan",
    place: "Kyoto, Japan",
    startDate: "2026-10-01",
    endDate: "2026-10-10",
    live: true,
    nowAt: "Fushimi Inari",
  });
});

test("a plan-only link's card never says where they are", () => {
  const view = sharedTripView(
    TRIP,
    [stop("Fushimi Inari", 0, { arrived_at: "2026-10-03T01:00:00Z" })],
    { following: false, now: NOW },
  );
  const card = followedTripCard("tok", view);
  assert.equal(card.live, false);
  assert.equal(card.nowAt, null);
  // No stops, addresses or times on the card itself.
  assert.doesNotMatch(JSON.stringify(card), /Somewhere|10:00|Fushimi/);
});
