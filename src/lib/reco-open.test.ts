import { test } from "node:test";
import assert from "node:assert/strict";
import { draftFromTyped, recMapsUrl } from "./reco-open.ts";

const q = (url: string) => new URL(url).searchParams.get("query");

test("a pinned rec opens on its pin, labelled with its name", () => {
  const url = new URL(recMapsUrl({ name: "Mandy's", lat: 45.5, lon: -73.55 }));
  assert.equal(url.searchParams.get("q"), "Mandy's@45.5,-73.55");
  assert.equal(
    q(recMapsUrl({ name: "Mandy's", address: "2067 Crescent St", lat: 45.5, lon: -73.55 })),
    "Mandy's, 2067 Crescent St",
    "with a street address, Maps finds the place itself",
  );
});

test("an unpinned rec opens a search for its name and where it is", () => {
  assert.equal(
    q(recMapsUrl({ name: "Mandy's", city: "Montreal", country: "Canada" })),
    "Mandy's, Montreal, Canada",
  );
  assert.equal(
    q(
      recMapsUrl({
        name: "Kakiya",
        address: "539 Miyajimacho",
        city: "Hatsukaichi",
        country: "Japan",
      }),
    ),
    "Kakiya, 539 Miyajimacho",
  );
  assert.equal(q(recMapsUrl({ name: "Olive et Gourmando" })), "Olive et Gourmando");
});

test("a typed name splits into name and city only at a comma", () => {
  assert.deepEqual(draftFromTyped("Mandy's, Montreal"), { name: "Mandy's", city: "Montreal" });
  assert.deepEqual(draftFromTyped("Café Olimpico Mile End"), { name: "Café Olimpico Mile End" });
  assert.deepEqual(draftFromTyped("  Kakiya,  "), { name: "Kakiya" });
});
