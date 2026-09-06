import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isMissingTravelTagsColumn, normalizeTravelTags, suggestTravelTags, tagsForSave } from "./reco-tags.ts";

test("suggestTravelTags maps a museum and a café", () => {
  assert.deepEqual(suggestTravelTags({ name: "Royal Ontario Museum", category: "Museum" }), [
    "Museums",
  ]);
  assert.ok(suggestTravelTags({ name: "Café de Flore", category: "Cafe" }).includes("Coffee shops"));
});

test("suggestTravelTags picks food tags from the category", () => {
  const tags = suggestTravelTags({
    name: "Bar Raval",
    notes: "Spanish tapas",
    category: "Restaurant",
  });
  assert.ok(tags.includes("Restaurants"));
});

test("suggestTravelTags does not treat a coffee shop as shopping", () => {
  const tags = suggestTravelTags({ name: "Pilot Coffee", category: "Cafe" });
  assert.ok(tags.includes("Coffee shops"));
  assert.ok(!tags.includes("Shopping"));
});

test("tagsForSave keeps a user's pick over a fresh guess", () => {
  assert.deepEqual(
    tagsForSave({ name: "ROM", category: "Museum", travel_tags: ["Art galleries"] }),
    ["Art galleries"],
  );
  assert.deepEqual(tagsForSave({ name: "ROM", category: "Museum" }), ["Museums"]);
});

test("normalizeTravelTags keeps only known place tags", () => {
  assert.deepEqual(normalizeTravelTags(["Museums", "Slow mornings", "museums", "bogus"]), ["Museums"]);
});

test("isMissingTravelTagsColumn recognises PostgREST wording", () => {
  assert.equal(
    isMissingTravelTagsColumn({ message: "Could not find the 'travel_tags' column of 'recommendations'" }),
    true,
  );
  assert.equal(isMissingTravelTagsColumn({ message: "permission denied" }), false);
});
