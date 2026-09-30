import { test } from "node:test";
import assert from "node:assert/strict";
import { draftFromTyped, googlePlaceKey, googlePlaceLink, recMapsUrl } from "./reco-open.ts";

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

test("a rec saved from a Google share link opens that link, not a search", () => {
  const shared = "https://maps.app.goo.gl/AbCd1234";
  assert.equal(recMapsUrl({ name: "Mandy's", lat: 45.5, lon: -73.55, url: shared }), shared);
  assert.equal(googlePlaceLink("https://goo.gl/maps/xyz", "X"), "https://goo.gl/maps/xyz");
  assert.equal(googlePlaceLink("https://share.google/abc", "X"), "https://share.google/abc");
});

test("a Google place ID opens through query_place_id", () => {
  const url = new URL(
    googlePlaceLink(
      "https://www.google.com/maps/search/?api=1&query=Eiffel&query_place_id=ChIJLU7jZClu5kcR4PcOOO6p3I0",
      "Eiffel Tower",
    )!,
  );
  assert.equal(url.searchParams.get("query_place_id"), "ChIJLU7jZClu5kcR4PcOOO6p3I0");
  assert.equal(url.searchParams.get("query"), "Eiffel Tower");
  const inPath = googlePlaceLink(
    "https://www.google.com/maps/place/Eiffel+Tower/@48.85,2.29,17z/data=!4m6!3m5!1s0x47e66e2964e34e2d:0x8ddca9ee380ef7e0!8m2!3d48.8583!4d2.2944!19sChIJLU7jZClu5kcR4PcOOO6p3I0",
    "Eiffel Tower",
  );
  assert.ok(inPath?.includes("query_place_id=ChIJLU7jZClu5kcR4PcOOO6p3I0"));
});

test("a Google feature ID opens by its customer ID", () => {
  assert.equal(
    googlePlaceLink(
      "https://www.google.com/maps/place/Eiffel+Tower/@48.85,2.29,17z/data=!3m1!4b1!4m6!3m5!1s0x47e66e2964e34e2d:0x8ddca9ee380ef7e0!8m2!3d48.8583!4d2.2944",
      "Eiffel Tower",
    ),
    `https://maps.google.com/?cid=${BigInt("0x8ddca9ee380ef7e0").toString()}`,
  );
  assert.equal(
    googlePlaceLink("https://maps.google.com/?q=Bar+Raval&ftid=0x882b34c3:0x1a2b", "Bar Raval"),
    `https://maps.google.com/?cid=${0x1a2b}`,
  );
  assert.equal(
    googlePlaceLink("https://maps.google.com/?cid=1234567", "X"),
    "https://maps.google.com/?cid=1234567",
  );
});

test("links that do not name one Google place are not used", () => {
  // Béa's own search link for a typed-in rec, and other sites.
  assert.equal(
    googlePlaceLink("https://www.google.com/maps/search/?api=1&query=Mandy's%2C%20Montreal", "X"),
    null,
  );
  assert.equal(googlePlaceLink("https://www.yelp.com/biz/mandys", "X"), null);
  assert.equal(googlePlaceLink("https://www.google.com/search?q=mandys", "X"), null);
  assert.equal(googlePlaceLink("https://evil.google.com.example.org/maps/place/x", "X"), null);
  assert.equal(googlePlaceLink("javascript:alert(1)", "X"), null);
  assert.equal(googlePlaceLink(null, "X"), null);
  assert.equal(googlePlaceLink("https://www.google.com/maps/%E0%A4%A", "X"), null);
  // Pinned rec without a link still opens on its pin.
  const url = new URL(recMapsUrl({ name: "Mandy's", lat: 45.5, lon: -73.55, url: null }));
  assert.equal(url.searchParams.get("q"), "Mandy's@45.5,-73.55");
});

test("a Google link's place is a key two recs can be compared by", () => {
  const id = "ChIJLU7jZClu5kcR4PcOOO6p3I0";
  assert.equal(
    googlePlaceKey(`https://www.google.com/maps/search/?api=1&query=Eiffel&query_place_id=${id}`),
    `place:${id}`,
  );
  assert.equal(
    googlePlaceKey(`https://www.google.fr/maps/place/Tour+Eiffel/data=!4m2!3m1!19s${id}`),
    `place:${id}`,
  );
  // A feature ID and its customer ID are the same number.
  assert.equal(
    googlePlaceKey("https://www.google.com/maps/place/X/data=!4m2!3m1!1s0x47e66e2964e34e2d:0x1a2b"),
    googlePlaceKey(`https://maps.google.com/?cid=${0x1a2b}`),
  );
  assert.equal(
    googlePlaceKey("https://maps.app.goo.gl/abc123"),
    "link:https://maps.app.goo.gl/abc123",
  );
});

test("links with no Google ID give no key", () => {
  assert.equal(
    googlePlaceKey("https://www.google.com/maps/place/Tour+Eiffel/@48.85,2.29,17z"),
    null,
  );
  assert.equal(googlePlaceKey("https://www.google.com/maps/search/?api=1&query=Eiffel"), null);
  assert.equal(googlePlaceKey("https://example.com/?query_place_id=ChIJabc"), null);
  assert.equal(googlePlaceKey(null), null);
});
