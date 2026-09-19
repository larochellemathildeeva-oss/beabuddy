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
