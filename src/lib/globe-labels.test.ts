import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { labelBudget, placeCityLabels } from "./globe-labels.ts";

const at = (city: string, x: number, y: number) => ({ id: `${city}-${x}-${y}`, city, x, y });

describe("placeCityLabels", () => {
  it("keeps labels that are nowhere near each other", () => {
    const kept = placeCityLabels([at("Lisbon", 0, 0), at("Tokyo", 400, 300)]);
    assert.deepEqual(
      kept.map((k) => k.city),
      ["Lisbon", "Tokyo"],
    );
  });

  it("drops the second of two that would print on top of each other", () => {
    // This is the Toronto/Montreal case from the globe: two pins a few px apart.
    const kept = placeCityLabels([at("Toronto", 100, 100), at("Montreal", 104, 102)]);
    assert.deepEqual(
      kept.map((k) => k.city),
      ["Toronto"],
    );
  });

  it("drops Porto when it would sit inside Lisbon", () => {
    const kept = placeCityLabels([at("Lisbon", 200, 200), at("Porto", 210, 196)]);
    assert.deepEqual(
      kept.map((k) => k.city),
      ["Lisbon"],
    );
  });

  it("keeps a neighbour that clears the first label's box", () => {
    // "Lisbon" is ~32px wide; 60px to the right is clear.
    const kept = placeCityLabels([at("Lisbon", 200, 200), at("Porto", 262, 200)]);
    assert.equal(kept.length, 2);
  });

  it("separates by vertical distance too", () => {
    const kept = placeCityLabels([at("Lisbon", 200, 200), at("Porto", 202, 230)]);
    assert.equal(kept.length, 2);
  });

  it("shows one label per city, however many pins it has", () => {
    const kept = placeCityLabels([
      at("Lisbon", 0, 0),
      at("Lisbon", 300, 300),
      at("lisbon", 60, 60),
    ]);
    assert.equal(kept.length, 1);
  });

  it("ignores a pin with no city rather than drawing an empty label", () => {
    const kept = placeCityLabels([at("", 0, 0), at("  ", 200, 200), at("Lisbon", 400, 400)]);
    assert.deepEqual(
      kept.map((k) => k.city),
      ["Lisbon"],
    );
  });

  it("respects the cap", () => {
    const spread = Array.from({ length: 30 }, (_, i) => at(`City${i}`, i * 80, i * 40));
    assert.equal(placeCityLabels(spread, { max: 5 }).length, 5);
  });

  it("returns nothing when there is no budget", () => {
    assert.deepEqual(placeCityLabels([at("Lisbon", 0, 0)], { max: 0 }), []);
  });

  it("is stable — the same input gives the same labels", () => {
    const input = [at("Lisbon", 0, 0), at("Porto", 6, 3), at("Tokyo", 300, 300)];
    assert.deepEqual(placeCityLabels(input), placeCityLabels(input));
  });

  it("gives a long name more room than a short one", () => {
    // "Rio de Janeiro" is wide enough to swallow a label 60px to its right.
    const wide = placeCityLabels([at("Rio de Janeiro", 200, 200), at("Ilha", 262, 200)]);
    assert.equal(wide.length, 1);
  });
});

describe("labelBudget", () => {
  it("shows few names when the globe is far away", () => {
    assert.equal(labelBudget(1), 6);
  });

  it("shows more as you zoom", () => {
    assert.ok(labelBudget(1.4) > labelBudget(1));
    assert.ok(labelBudget(2) > labelBudget(1.4));
  });
});
