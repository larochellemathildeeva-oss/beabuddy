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

  it("does not treat a substring as a tag match", () => {
    // "art" must not match Cartagena, nor "bar" Barcelona.
    const prefs = { tags: ["art", "bar"], preferredCountries: [] };
    const decoy = scoreOpportunity(
      pin({ id: "d", name: "Hostel", city: "Cartagena", country: "Colombia" }),
      prefs,
    );
    const real = scoreOpportunity(
      pin({ id: "r", name: "Art gallery", city: "Toronto", category: "art" }),
      prefs,
    );
    assert.ok(real.score > decoy.score);
    assert.ok(!decoy.reasons.some((r) => r.startsWith("Matches")));
  });

  it("surfaces a long-dormant save, which is the point of the vault", () => {
    // The old recency-only term ranked this last. It is the product's whole
    // premise: saved years ago, never visited, surfaced now.
    const old = pin({ id: "old", name: "Bar Basso", dateAdded: "2023-09-06" });
    const fresh = pin({ id: "fresh", name: "Somewhere new", dateAdded: "2026-09-05" });
    const prefs = { tags: [], preferredCountries: [] };
    const dormant = scoreOpportunity(old, prefs, { now });
    assert.ok(dormant.score > 0);
    assert.ok(dormant.reasons.some((r) => r.includes("never visited")));
    // and a just-saved pin still gets its own bump
    assert.ok(scoreOpportunity(fresh, prefs, { now }).reasons.includes("Saved this week"));
  });

  it("matches stored travel tags even when the name is opaque", () => {
    const prefs = { tags: ["Museums"], preferredCountries: [] };
    const tagged = scoreOpportunity(pin({ id: "rom", name: "ROM", travelTags: ["Museums"] }), prefs);
    const untagged = scoreOpportunity(pin({ id: "rom2", name: "ROM" }), prefs);
    assert.ok(tagged.reasons.some((r) => r.startsWith("Matches")));
    assert.ok(!untagged.reasons.some((r) => r.startsWith("Matches")));
    assert.ok(tagged.score > untagged.score);
  });

  it("does not credit dormancy to somewhere already visited", () => {
    const been = scoreOpportunity(
      pin({ id: "v", name: "Old haunt", type: "visited", dateAdded: "2023-09-06" }),
      { tags: [], preferredCountries: [] },
      { now },
    );
    assert.ok(!been.reasons.some((r) => r.includes("never visited")));
  });
});
