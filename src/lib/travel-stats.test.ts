import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Pin } from "../data/atlas.ts";
import { deriveTravelStats } from "./travel-stats.ts";

function pin(partial: Partial<Pin> & Pick<Pin, "id" | "name">): Pin {
  return {
    type: "visited",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.72,
    lon: -9.14,
    ...partial,
  };
}

describe("deriveTravelStats", () => {
  it("counts a city added by hand, not just photographed ones", () => {
    // The bug: adding a country on the World map left every number unchanged.
    const before = deriveTravelStats([], []);
    const after = deriveTravelStats([], [pin({ id: "a", name: "Lisbon" })]);
    assert.equal(before.countries, 0);
    assert.equal(after.countries, 1);
    assert.equal(after.cities, 1);
  });

  it("does not double-count a place that is both photographed and pinned", () => {
    const photos = [{ city: "Lisbon", country: "Portugal", taken_at: "2026-04-02" }];
    const stats = deriveTravelStats(photos, [pin({ id: "a", name: "Lisbon" })]);
    assert.equal(stats.cities, 1);
    assert.equal(stats.countries, 1);
  });

  it("ignores case and stray whitespace when matching places", () => {
    const photos = [{ city: "  paris ", country: "FRANCE", taken_at: null }];
    const stats = deriveTravelStats(photos, [
      pin({ id: "a", name: "Paris", city: "Paris", country: "France" }),
    ]);
    assert.equal(stats.cities, 1);
    assert.equal(stats.countries, 1);
  });

  it("only counts pins you have actually been to", () => {
    const wishlist = pin({ id: "w", name: "Kyoto", city: "Kyoto", country: "Japan", type: "wishlist" });
    const been = pin({ id: "b", name: "Osaka", city: "Osaka", country: "Japan", type: "visited" });
    assert.equal(deriveTravelStats([], [wishlist]).cities, 0);
    assert.equal(deriveTravelStats([], [wishlist, been]).cities, 1);
  });

  it("counts a reco marked visited", () => {
    const revisited = pin({ id: "r", name: "Bar Basso", type: "reco", visited: true });
    assert.equal(deriveTravelStats([], [revisited]).countries, 1);
  });

  it("keeps photos and days photo-only — a pin is neither", () => {
    const photos = [
      { city: "Lisbon", country: "Portugal", taken_at: "2026-04-02" },
      { city: "Lisbon", country: "Portugal", taken_at: "2026-04-03" },
    ];
    const stats = deriveTravelStats(photos, [pin({ id: "a", name: "Tokyo", city: "Tokyo", country: "Japan" })]);
    assert.equal(stats.photos, 2);
    assert.equal(stats.days, 2);
    assert.equal(stats.cities, 2);
  });
});
