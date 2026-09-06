import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCostPolicy, mergeAlternativeItems } from "./itinerary-plan.ts";

describe("applyCostPolicy", () => {
  const plan = {
    estimated_total: 120,
    costs: [{ label: "Lunch", amount: 20 }],
    items: [{ title: "Lunch", estimated_cost: 20 }],
  };

  it("keeps estimates when the traveller asked for them", () => {
    assert.deepEqual(applyCostPolicy(plan, true), plan);
  });

  it("strips estimates when they were not asked for", () => {
    assert.deepEqual(applyCostPolicy(plan, false), {
      estimated_total: null,
      costs: [],
      items: [{ title: "Lunch", estimated_cost: null }],
    });
  });
});

describe("mergeAlternativeItems", () => {
  it("replaces only the ticked indexes", () => {
    const next = mergeAlternativeItems(
      ["museum", "lunch", "walk"],
      ["cinema", "cafe"],
      [0, 2],
    );
    assert.deepEqual(next, ["cinema", "lunch", "cafe"]);
  });

  it("leaves a stop alone when no replacement arrived", () => {
    const next = mergeAlternativeItems(["museum", "lunch"], ["cinema"], [0, 1]);
    assert.deepEqual(next, ["cinema", "lunch"]);
  });
});
