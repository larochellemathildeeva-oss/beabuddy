import { test } from "node:test";
import assert from "node:assert/strict";
import { legMiniMap, stepTurn } from "./leg-mini-map.ts";

test("both stops land inside the box, with room to spare", () => {
  const plan = legMiniMap({ lat: 38.7139, lon: -9.1335 }, { lat: 38.7069, lon: -9.1458 }, 320, 112);
  assert.ok(plan);
  for (const p of [plan.from, plan.to]) {
    assert.ok(p.x >= 20 && p.x <= 300, `x ${p.x}`);
    assert.ok(p.y >= 20 && p.y <= 92, `y ${p.y}`);
  }
  assert.ok(plan.tiles.length >= 1 && plan.tiles.length <= 6);
  // The tiles cover the whole box.
  assert.ok(plan.tiles.some((t) => t.left <= 0 && t.top <= 0));
});

test("stops across the street stay at street zoom", () => {
  const plan = legMiniMap({ lat: 48.8566, lon: 2.3522 }, { lat: 48.8567, lon: 2.3523 }, 320, 112);
  assert.equal(plan?.zoom, 17);
});

test("no map without both points, or across a continent", () => {
  assert.equal(legMiniMap(null, { lat: 1, lon: 1 }, 320, 112), null);
  assert.equal(legMiniMap({ lat: 1, lon: Number.NaN }, { lat: 1, lon: 1 }, 320, 112), null);
  assert.equal(legMiniMap({ lat: 48.85, lon: 2.35 }, { lat: 35.68, lon: 139.69 }, 320, 112), null);
});

test("each step gets its arrow", () => {
  assert.equal(stepTurn("Head east on Rua da Catedral"), "straight");
  assert.equal(stepTurn("Turn left onto Rua Coronel Magalhães"), "left");
  assert.equal(stepTurn("Turn slight right onto Rua do Mercado"), "right");
  assert.equal(stepTurn("Make a U-turn"), "uturn");
  assert.equal(stepTurn("You have arrived at your destination"), "arrive");
});
