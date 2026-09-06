import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Pin } from "../data/atlas.ts";
import { rankOpportunities, scoreOpportunity } from "./score-opportunity.ts";

const now = new Date("2026-09-06T12:00:00Z");

function pin(partial: Partial<Pin> & Pick<Pin, "id" | "name">): Pin {
  return {
    type: "reco",
    city: "Toronto",
    country: "Canada",
    lat: 43.65,
    lon: -79.38,
    ...partial,
  };
}

describe("scoreOpportunity", () => {
  it("ranks a high-priority nearby reco above a distant wishlist", () => {
    const here = { lat: 43.65, lon: -79.38 };
    const near = pin({
      id: "near",
      name: "ROM",
      category: "museum",
      priority: "High",
      dateAdded: "2026-09-01",
      lat: 43.6677,
      lon: -79.3948,
    });
    const far = pin({
      id: "far",
      name: "A park in Vancouver",
      type: "wishlist",
      city: "Vancouver",
      lat: 49.28,
      lon: -123.12,
      dateAdded: "2025-01-01",
    });
    const prefs = { tags: ["Museums"], preferredCountries: ["Canada"] };
    const ranked = rankOpportunities([far, near], prefs, { here, now });
    assert.equal(ranked[0]!.pin.id, "near");
    assert.ok(ranked[0]!.score.score > ranked[1]!.score.score);
  });

  it("lets typed priorities override: nearby beats a high-priority far pin", () => {
    const here = { lat: 43.65, lon: -79.38 };
    const close = pin({
      id: "close",
      name: "Café around the corner",
      type: "wishlist",
      lat: 43.651,
      lon: -79.381,
    });
    const important = pin({
      id: "far-high",
      name: "Must-do museum",
      priority: "High",
      category: "museum",
      lat: 49.28,
      lon: -123.12,
    });
    const ranked = rankOpportunities([important, close], { tags: [], preferredCountries: [], priorities: "somewhere nearby" }, { here, now });
    assert.equal(ranked[0]!.pin.id, "close");
  });

  it("penalises places already visited", () => {
    const a = scoreOpportunity(pin({ id: "a", name: "Old favourite", type: "visited" }), {
      tags: [],
      preferredCountries: [],
    });
    const b = scoreOpportunity(pin({ id: "b", name: "New reco" }), { tags: [], preferredCountries: [] });
    assert.ok(b.score > a.score);
  });
});
