import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tagVaultItems, vaultPrompt, type VaultReco } from "./vault-for-build.ts";

const rom: VaultReco = {
  name: "Royal Ontario Museum",
  city: "Toronto",
  country: "Canada",
  category: "Museum",
  notes: "Go on a rainy day",
  recommended_by: "Mathilde",
  lat: 43.6677,
  lon: -79.3948,
  pin_type: "reco",
  created_at: "2026-09-06T12:00:00Z",
};

const park: VaultReco = {
  name: "High Park",
  city: "Toronto",
  country: "Canada",
  category: "Park",
  notes: null,
  recommended_by: null,
  lat: 43.6465,
  lon: -79.4637,
  pin_type: "wishlist",
  created_at: "2026-09-06T12:00:00Z",
};

describe("vaultPrompt", () => {
  it("lists scored vault places and future notes", () => {
    const text = vaultPrompt(
      "Toronto",
      [park, rom],
      [{ city: "Toronto", note: "Try the ferry if the weather is fair." }],
      { tags: ["Museums"], preferredCountries: ["Canada"] },
    );
    assert.match(text, /Royal Ontario Museum/);
    assert.match(text, /saved by Mathilde/);
    assert.match(text, /source "vault"/);
    assert.match(text, /Try the ferry/);
    assert.ok(text.indexOf("Royal Ontario Museum") < text.indexOf("High Park"));
  });

  it("returns empty when the vault has nothing for that city", () => {
    assert.equal(vaultPrompt("Paris", [], [], { tags: [], preferredCountries: [] }), "");
  });

  it("tags stops whose titles match a vault place", () => {
    const tagged = tagVaultItems(
      [
        { title: "Royal Ontario Museum", source: "new" as const },
        { title: "Canoe Restaurant", source: "new" as const },
      ],
      [rom, park],
    );
    assert.equal(tagged[0]!.source, "vault");
    assert.equal(tagged[1]!.source, "new");
  });
});
