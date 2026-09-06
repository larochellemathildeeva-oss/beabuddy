import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applySearchHits, draftsToSave, searchQueryForReco, startRecoDrafts } from "./reco-list.ts";

test("searchQueryForReco adds a city when the name does not already include it", () => {
  assert.equal(searchQueryForReco({ name: "Bar Raval" }), "Bar Raval");
  assert.equal(searchQueryForReco({ name: "Bar Raval", city: "Toronto" }), "Bar Raval, Toronto");
  assert.equal(searchQueryForReco({ name: "Toronto Islands", city: "Toronto" }), "Toronto Islands");
});

test("startRecoDrafts drops blanks and caps the batch", () => {
  const drafts = startRecoDrafts([
    { name: "  " },
    { name: "Terroni", city: "Toronto", notes: "lunch" },
    ...Array.from({ length: 30 }, (_, i) => ({ name: `Place ${i}` })),
  ]);
  assert.equal(drafts.length, 25);
  assert.equal(drafts[0]?.originalName, "Terroni");
  assert.equal(drafts[0]?.query, "Terroni, Toronto");
  assert.equal(drafts[0]?.notes, "lunch");
  assert.equal(drafts[0]?.pin_type, "reco");
});

test("applySearchHits preselects the first match", () => {
  const [draft] = startRecoDrafts([{ name: "Terroni" }]);
  assert.ok(draft);
  const ready = applySearchHits(draft, [
    { name: "Terroni Queen", source: "Web search", url: "https://example.com", lat: 1, lon: 2 },
  ]);
  assert.equal(ready.status, "ready");
  assert.equal(ready.chosen, 0);
  const empty = applySearchHits(draft, []);
  assert.equal(empty.status, "empty");
  assert.equal(empty.chosen, null);
});

test("draftsToSave uses the chosen pin and skips the rest", () => {
  const [one, two] = startRecoDrafts([{ name: "Terroni" }, { name: "Skip me" }]);
  assert.ok(one && two);
  const ready = applySearchHits(one, [
    {
      name: "Terroni Queen",
      city: "Toronto",
      country: "Canada",
      address: "720 Queen St W",
      category: "Restaurant",
      source: "Web search",
      url: "https://osm.example/terroni",
      lat: 43.64,
      lon: -79.4,
    },
  ]);
  two.skip = true;
  const saved = draftsToSave([ready, two], "Sam");
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.name, "Terroni");
  assert.equal(saved[0]?.city, "Toronto");
  assert.equal(saved[0]?.recommended_by, "Sam");
  assert.equal(saved[0]?.source, "Uploaded list");
  assert.equal(saved[0]?.lat, 43.64);
  assert.ok(saved[0]?.travel_tags?.includes("Restaurants"));
});

test("draftsToSave keeps an edited name and city, and records the page source", () => {
  const [draft] = startRecoDrafts([{ name: "Old name", city: "Lisbon", notes: "sunset" }]);
  assert.ok(draft);
  draft.originalName = "Time Out Market";
  draft.city = "Lisbon";
  draft.category = "Market";
  const ready = applySearchHits(draft, [
    {
      name: "Time Out Market Lisboa",
      city: "Lisboa",
      source: "Web search",
      url: "https://osm.example",
      lat: 38.7,
      lon: -9.1,
    },
  ]);
  const [saved] = draftsToSave([ready], undefined, "https://www.timeout.com/lisbon");
  assert.equal(saved?.name, "Time Out Market");
  assert.equal(saved?.city, "Lisbon");
  assert.equal(saved?.notes, "sunset");
  assert.equal(saved?.source, "https://www.timeout.com/lisbon");
});
