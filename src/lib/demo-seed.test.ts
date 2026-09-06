import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_NOTES, DEMO_PLACES, DEMO_RECOS, DEMO_SOURCE, DEMO_TRIPS, demoGlobePins } from "./demo-seed.ts";

describe("demo seed", () => {
  it("covers enough cities, pin types and a dense Lisbon cluster", () => {
    assert.equal(DEMO_SOURCE, "demo-seed");
    const cities = new Set(DEMO_RECOS.filter((r) => r.pin_type === "visited").map((r) => r.city));
    assert.ok(cities.size >= 8, `expected ≥8 visited cities, got ${cities.size}`);
    const types = new Set(DEMO_RECOS.map((r) => r.pin_type));
    for (const t of ["visited", "reco", "wishlist", "nexttime"] as const) {
      assert.ok(types.has(t), `missing pin type ${t}`);
    }
    const lisbon = DEMO_RECOS.filter((r) => r.city === "Lisbon" && r.pin_type !== "visited");
    assert.ok(lisbon.length >= 5, "Lisbon needs enough pins for Near demos");
    assert.ok(DEMO_NOTES.length >= 3);
    assert.ok(DEMO_TRIPS.length >= 2);
    assert.ok(DEMO_TRIPS.every((t) => t.stops.length >= 2));
    assert.ok(DEMO_PLACES.some((p) => p.label === "Lisbon"));
  });

  it("demoGlobePins returns finite coordinates for the landing globe", () => {
    const pins = demoGlobePins();
    assert.ok(pins.length >= 15);
    for (const p of pins) {
      assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lon));
      assert.ok(p.id.startsWith("demo-"));
    }
  });

  it("exposes clearDemoSeed alongside load", async () => {
    const mod = await import("./demo-seed.ts");
    assert.equal(typeof mod.clearDemoSeed, "function");
    assert.equal(typeof mod.loadDemoSeed, "function");
  });
});
