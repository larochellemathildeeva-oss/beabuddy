import { strict as assert } from "node:assert";
import { test } from "node:test";
import { geoapifyProvider } from "./geo-endpoints.ts";
import { legCached, routeOnce } from "./route-legs.server.ts";

// Geoapify's routing answer for one journey: 1.2 km, 15 minutes.
const answer = {
  features: [
    {
      properties: {
        distance: 1200,
        time: 900,
        legs: [{ steps: [{ distance: 1200, instruction: { text: "Walk north" } }] }],
      },
    },
  ],
};

test("one cache for directions and Optimize: a journey is bought once", async () => {
  const provider = geoapifyProvider("KEY");
  const a = { lat: 35.0116, lon: 135.7681 };
  const b = { lat: 35.0039, lon: 135.7786 };
  const real = globalThis.fetch;
  let calls = 0;
  let fail = true;
  globalThis.fetch = (async () => {
    calls += 1;
    return fail
      ? new Response("busy", { status: 503 })
      : new Response(JSON.stringify(answer), { status: 200 });
  }) as typeof fetch;
  try {
    // A failure is not remembered: the next ask tries again.
    assert.equal(await routeOnce(provider, a, b, "walking"), null);
    assert.equal(legCached(provider, a, b, "walking"), false);
    fail = false;
    const first = await routeOnce(provider, a, b, "walking");
    assert.deepEqual(first, {
      distance: 1200,
      duration: 900,
      steps: [{ instruction: "Walk north", distance: 1200 }],
    });
    assert.equal(legCached(provider, a, b, "walking"), true);
    const again = await routeOnce(provider, a, b, "walking");
    assert.deepEqual(again, first);
    assert.equal(calls, 2, "the second ask came from the cache");
    // A drive between the same pins is a different journey.
    assert.equal(legCached(provider, a, b, "driving"), false);
  } finally {
    globalThis.fetch = real;
  }
});
