import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  estimatedSeconds,
  planStopQueries,
  QUERIES_PER_STOP,
  stopsNeedingLocation,
} from "./geocode-plan.ts";

test("no area means no lookup at all — never a bare name", () => {
  // This is the Slovakia rule: a bare "Harvey's" is how a Montreal burger
  // ended up in eastern Europe.
  assert.deepEqual(planStopQueries({ title: "Harvey's" }, null), []);
  assert.deepEqual(planStopQueries({ title: "Harvey's" }, "   "), []);
  assert.deepEqual(planStopQueries({ title: "Harvey's" }, undefined), []);
});

test("every query carries the area", () => {
  const queries = planStopQueries({ title: "Harvey's" }, "Montreal, Canada");
  assert.ok(queries.length > 0);
  for (const q of queries) assert.ok(q.endsWith("Montreal, Canada"), q);
});

test("an untitled stop is not looked up", () => {
  assert.deepEqual(planStopQueries({ title: "   " }, "Lisbon, Portugal"), []);
});

test("the detail line is used as a hint when it names a place", () => {
  // Planner items stash the venue or street in detail and leave coords empty.
  const queries = planStopQueries(
    { title: "Lunch", detail: "1038 Canada Place, Vancouver; suggest booking" },
    "Vancouver, Canada",
  );
  assert.ok(
    queries.some((q) => /canada place/i.test(q)),
    queries.join(" | "),
  );
});

test("queries are capped so a long plan stays bounded", () => {
  const queries = planStopQueries(
    { title: "Museum of Art and History", detail: "12 Rue Example, Paris" },
    "Paris, France",
  );
  assert.ok(queries.length <= QUERIES_PER_STOP, `${queries.length} queries`);
});

test("duplicate candidates collapse to one query", () => {
  const queries = planStopQueries({ title: "Louvre", detail: "Louvre" }, "Paris, France");
  assert.equal(new Set(queries.map((q) => q.toLowerCase())).size, queries.length);
});

test("stopsNeedingLocation skips what is already placed", () => {
  const stops = [
    { title: "Placed", lat: 45.5, lon: -73.5 },
    { title: "Unplaced" },
    { title: "Half placed", lat: 45.5 },
    { title: "  " },
  ];
  assert.deepEqual(
    stopsNeedingLocation(stops).map((s) => s.title),
    ["Unplaced", "Half placed"],
  );
});

test("estimatedSeconds rounds up, because a part second is still a wait", () => {
  assert.equal(estimatedSeconds(10, 1100), 11);
  assert.equal(estimatedSeconds(1, 1100), 2);
  assert.equal(estimatedSeconds(0, 1100), 0);
});

test("the area's box, widened, keeps Old Montreal and rejects Valcartier", async () => {
  const { areaBoxFrom, widenBox, inBox, boxViewbox } = await import("./geocode-plan.ts");
  // Montreal's box as Nominatim gives it: [south, north, west, east].
  const montreal = areaBoxFrom(["45.4100", "45.7048", "-73.9740", "-73.4742"]);
  assert.ok(montreal);
  const box = widenBox(montreal);
  assert.ok(inBox(box, 45.5075, -73.5519), "Old Port");
  assert.ok(inBox(box, 45.4576, -73.7497), "the airport, just past the line");
  assert.ok(!inBox(box, 46.985723, -71.407334), "Valcartier");
  assert.equal(boxViewbox(montreal), "-73.97400,45.70480,-73.47420,45.41000");
});

test("a malformed box is no box", async () => {
  const { areaBoxFrom } = await import("./geocode-plan.ts");
  assert.equal(areaBoxFrom(undefined), null);
  assert.equal(areaBoxFrom(["1", "2", "3"]), null);
  assert.equal(areaBoxFrom(["50", "40", "0", "1"]), null);
  assert.equal(areaBoxFrom(["a", "b", "c", "d"]), null);
});

test("a city with no size still gets a margin of about ten kilometres", async () => {
  const { areaBoxFrom, widenBox, inBox } = await import("./geocode-plan.ts");
  const point = widenBox(areaBoxFrom(["45.5", "45.5", "-73.5", "-73.5"])!);
  assert.ok(inBox(point, 45.55, -73.45));
  assert.ok(!inBox(point, 45.8, -73.5));
});

test("a stop far from the rest of the trip is flagged; a road trip is not", async () => {
  const { strayStopIds } = await import("./geocode-plan.ts");
  const city = [
    { id: "a", lat: 45.5075, lon: -73.5519 },
    { id: "b", lat: 45.5017, lon: -73.5673 },
    { id: "c", lat: 45.5231, lon: -73.6017 },
    { id: "d", lat: 45.4972, lon: -73.5794 },
    { id: "castor", lat: 46.985723, lon: -71.407334 },
    { id: "unplaced", lat: null, lon: null },
  ];
  assert.deepEqual([...strayStopIds(city)], ["castor"]);
  const roadTrip = [
    { id: "mtl", lat: 45.5, lon: -73.57 },
    { id: "qc", lat: 46.81, lon: -71.21 },
    { id: "ott", lat: 45.42, lon: -75.69 },
    { id: "tor", lat: 43.65, lon: -79.38 },
  ];
  assert.equal(strayStopIds(roadTrip).size, 0);
});

test("the source's address and venue are asked for before the title", async () => {
  const { planStopQueries } = await import("./geocode-plan.ts");
  const q = planStopQueries(
    {
      title: "Morning treat by the water",
      place: "Queue de Castor",
      address: "310 Rue de la Commune E",
    },
    "Montreal, Canada",
  );
  assert.equal(q[0], "310 Rue de la Commune E, Montreal, Canada");
  assert.ok(q.includes("Queue de Castor, Montreal, Canada"), q.join(" | "));
});

test("a venue with its local name in brackets tries both", async () => {
  const { planStopQueries } = await import("./geocode-plan.ts");
  const q = planStopQueries(
    { title: "Shrine visit", place: "Itsukushima Shrine (厳島神社)" },
    "Miyajima, Japan",
  );
  assert.deepEqual(q.slice(0, 2), [
    "Itsukushima Shrine, Miyajima, Japan",
    "厳島神社, Miyajima, Japan",
  ]);
});

test("boxAround is about 45 km each way", async () => {
  const { boxAround } = await import("./geocode-plan.ts");
  const box = boxAround({ lat: 34.39, lon: 132.45 });
  assert.ok(Math.abs(box.north - box.south - 0.81) < 0.01);
  assert.ok(box.west < 132.45 && box.east > 132.45);
  assert.ok(
    box.east - box.west > box.north - box.south,
    "wider in longitude away from the equator",
  );
});
