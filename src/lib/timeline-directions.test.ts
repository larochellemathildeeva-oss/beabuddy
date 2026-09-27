import { strict as assert } from "node:assert";
import { describe, it, test } from "node:test";
import type { RouteLeg } from "./directions.functions.ts";
import {
  directionDetail,
  directionTitle,
  legsToTimelineItems,
  placedFromLegs,
  stripEmbeddedMapsUrl,
  syncDetailDraft,
} from "./timeline-directions.ts";

const walk: RouteLeg = {
  from: "Hotel",
  to: "Market",
  mode: "walking",
  distance: 800,
  duration: 600,
  steps: [],
  mapUrl: "https://maps.example/walk",
};

test("directionTitle names the walk or drive", () => {
  assert.equal(directionTitle(walk), "Walk to Market");
  assert.equal(directionTitle({ ...walk, mode: "driving" }), "Drive to Market");
});

test("directionDetail keeps a short summary without embedding the maps URL", () => {
  assert.equal(directionDetail(walk), "Walk · 800 m · 10 min");
});

test("stripEmbeddedMapsUrl clears leftover map links from older saves", () => {
  assert.equal(
    stripEmbeddedMapsUrl(
      "Exact spot unknown — open in maps · https://www.google.com/maps/dir/?api=1&origin=a",
    ),
    "Exact spot unknown — open in maps",
  );
  assert.equal(stripEmbeddedMapsUrl("Walk · 800 m · 10 min"), "Walk · 800 m · 10 min");
  assert.equal(stripEmbeddedMapsUrl(null), "");
  assert.equal(
    stripEmbeddedMapsUrl("Book here https://hotel.example/rooms"),
    "Book here https://hotel.example/rooms",
  );
});

test("syncDetailDraft keeps a focused edit through a remote refresh", () => {
  const remote =
    "Exact spot unknown — open in maps · https://www.google.com/maps/dir/?api=1&origin=a";
  assert.equal(syncDetailDraft(true, "typing a note", remote), "typing a note");
  assert.equal(
    syncDetailDraft(false, "typing a note", remote),
    "Exact spot unknown — open in maps",
  );
});

test("legsToTimelineItems uses the from-stop day and destination coords", () => {
  const items = legsToTimelineItems(
    [{ ...walk, toLat: 49.28, toLon: -123.12 }],
    [
      { title: "Hotel", day_date: "2026-09-12", time_label: "14:00", lat: 43.6, lon: -79.3 },
      { title: "Market", address: "701 W Georgia St", lat: 49.28, lon: -123.12 },
    ],
    [],
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "Transport");
  assert.equal(items[0]?.day_date, "2026-09-12");
  assert.equal(items[0]?.title, "Walk to Market");
  assert.equal(items[0]?.address, "701 W Georgia St");
  assert.equal(items[0]?.lat, 49.28);
  assert.equal(items[0]?.lon, -123.12);

  const again = legsToTimelineItems(
    [walk],
    [{ title: "Hotel", day_date: "2026-09-12" }],
    ["Walk to Market"],
  );
  assert.equal(again.length, 1);
  assert.equal(again[0]?.title, "Walk to Market");
});

test("directionDetail names a same-place stretch", () => {
  assert.equal(
    directionDetail({ ...walk, distance: 0, duration: 0, sameSpot: true }),
    "Same place — no walk",
  );
});

test("directionDetail only says the spot is unknown when it is", () => {
  assert.equal(
    directionDetail({ ...walk, distance: 0, duration: 0, unknownSpot: true }),
    "Exact spot unknown — open in maps",
  );
  assert.equal(directionDetail({ ...walk, distance: 0, duration: 0 }), "Open in maps");
});

describe("placedFromLegs", () => {
  const leg = (fromLat: number, fromLon: number, toLat: number, toLon: number) => ({
    fromLat,
    fromLon,
    toLat,
    toLon,
  });

  it("gives a stop the position the router worked out for it", () => {
    const placed = placedFromLegs(
      [leg(45.5, -73.6, 34.09, -118.41)],
      [
        { id: "a", title: "Montreal" },
        { id: "b", title: "Hotel Bel-Air" },
      ],
    );
    assert.deepEqual(placed, [
      { id: "a", lat: 45.5, lon: -73.6 },
      { id: "b", lat: 34.09, lon: -118.41 },
    ]);
  });

  it("never overwrites a position the stop already had", () => {
    // A point the user picked beats a geocoder's guess, always.
    const placed = placedFromLegs(
      [leg(1, 1, 2, 2)],
      [
        { id: "a", title: "Picked by hand", lat: 10, lon: 10 },
        { id: "b", title: "Unplaced" },
      ],
    );
    assert.deepEqual(placed, [{ id: "b", lat: 2, lon: 2 }]);
  });

  it("reports a stop once even when two legs touch it", () => {
    const placed = placedFromLegs(
      [leg(1, 1, 2, 2), leg(2, 2, 3, 3)],
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "C" },
      ],
    );
    assert.deepEqual(
      placed.map((p) => p.id),
      ["a", "b", "c"],
    );
  });

  it("skips stops with no timeline row behind them", () => {
    // City stops come from trip_stops and have no itinerary id to write to.
    assert.deepEqual(
      placedFromLegs([leg(1, 1, 2, 2)], [{ title: "City" }, { title: "City 2" }]),
      [],
    );
  });

  it("skips a leg the router could not place", () => {
    assert.deepEqual(
      placedFromLegs(
        [{}],
        [
          { id: "a", title: "A" },
          { id: "b", title: "B" },
        ],
      ),
      [],
    );
  });

  it("half a coordinate is not a position", () => {
    assert.deepEqual(
      placedFromLegs(
        [{ fromLat: 45.5 }],
        [
          { id: "a", title: "A" },
          { id: "b", title: "B" },
        ],
      ),
      [],
    );
  });
});

test("a saved walk keeps its steps and reads back as the same leg", async () => {
  const { directionDetailWithSteps, legFromDirectionRow } =
    await import("./timeline-directions.ts");
  const detail = directionDetailWithSteps({
    mode: "walking",
    distance: 1200,
    duration: 900,
    steps: [
      { instruction: "Head north on Karasuma-dori", distance: 350 },
      { instruction: "Turn  right\nonto Shijo-dori", distance: 850 },
      { instruction: "Arrive", distance: 0 },
    ],
  });
  assert.equal(
    detail,
    "Walk · 1.2 km · 15 min\nHead north on Karasuma-dori · 350 m\nTurn right onto Shijo-dori · 850 m\nArrive",
  );
  const leg = legFromDirectionRow({
    title: "Walk to Nishiki Market",
    detail,
    lat: 35,
    lon: 135.7,
  })!;
  assert.equal(leg.mode, "walking");
  assert.equal(leg.to, "Nishiki Market");
  assert.equal(leg.distance, 1200);
  assert.equal(leg.duration, 900);
  assert.deepEqual(leg.steps, [
    { instruction: "Head north on Karasuma-dori", distance: 350 },
    { instruction: "Turn right onto Shijo-dori", distance: 850 },
    { instruction: "Arrive", distance: 0 },
  ]);
  assert.equal(leg.toLat, 35);
});

test("an older saved drive with only a summary still reads as a leg", async () => {
  const { legFromDirectionRow } = await import("./timeline-directions.ts");
  const leg = legFromDirectionRow({
    title: "Drive to Nara",
    detail: "Drive · 45.0 km · 1 h 5 min",
  })!;
  assert.equal(leg.mode, "driving");
  assert.equal(leg.distance, 45000);
  assert.equal(leg.duration, 3900);
  assert.deepEqual(leg.steps, []);
  assert.equal(legFromDirectionRow({ title: "Lunch at Kakiya" }), null);
  const same = legFromDirectionRow({ title: "Walk to Hotel", detail: "Same place — no walk" })!;
  assert.equal(same.distance, 0);
  assert.equal(same.sameSpot, true);
});

test("walks and drives come off the list and attach to the stop they reach", async () => {
  const { splitDirectionRows, directionKey } = await import("./timeline-directions.ts");
  const items = [
    { title: "Kinkaku-ji", kind: "Activity", day_date: "2026-10-02" },
    {
      title: "Walk to Ryoan-ji",
      kind: "Transport",
      day_date: "2026-10-02",
      detail: "Walk · 1.4 km · 18 min",
    },
    { title: "Ryoan-ji", kind: "Activity", day_date: "2026-10-02" },
    {
      title: "Drive to Arashiyama",
      kind: "Transport",
      day_date: "2026-10-02",
      detail: "Drive · 6.0 km · 15 min",
    },
    { title: "Arashiyama", kind: "Activity", day_date: "2026-10-02" },
  ];
  const { stops, travel } = splitDirectionRows(items);
  assert.deepEqual(
    stops.map((s) => s.title),
    ["Kinkaku-ji", "Ryoan-ji", "Arashiyama"],
  );
  assert.equal(travel.get(directionKey("2026-10-02", "Ryoan-ji"))?.distance, 1400);
  assert.equal(travel.get(directionKey("2026-10-02", "arashiyama"))?.mode, "driving");
});
