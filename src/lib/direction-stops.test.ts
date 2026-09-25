import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  addressForStop,
  hasCoords,
  isSavedDirectionItem,
  looksLikeStreetAddress,
  mapsDirUrl,
  mapsPlaceUrl,
  placeHintFromDetail,
  placeQueryCandidates,
  reuseKeyForStop,
  stopsForDirections,
  streetNameFromText,
  timelineStopsForDirections,
} from "./direction-stops.ts";

test("placeHintFromDetail keeps a street or venue and drops prose", () => {
  assert.equal(
    placeHintFromDetail("1038 Canada Place, Vancouver; suggest booking a harbor-view luxury room."),
    "1038 Canada Place, Vancouver",
  );
  assert.equal(
    placeHintFromDetail("Fairmont Pacific Rim; suggest reserving an evening table"),
    "Fairmont Pacific Rim",
  );
  assert.equal(
    placeHintFromDetail(
      "Browse luxury flagships including Prada, Gucci, and Tiffany & Co. along Vancouver",
    ),
    null,
  );
  assert.equal(placeHintFromDetail(""), null);
});

test("looksLikeStreetAddress requires a leading street number", () => {
  assert.equal(looksLikeStreetAddress("1017 W Hastings St"), true);
  assert.equal(looksLikeStreetAddress("Fairmont Pacific Rim"), false);
});

test("addressForStop prefers the address column, then the detail hint", () => {
  assert.equal(addressForStop({ address: "  9 Main St  ", detail: "ignored" }), "9 Main St");
  assert.equal(
    addressForStop({ address: null, detail: "217 Carrall St; suggest booking" }),
    "217 Carrall St",
  );
});

test("timelineStopsForDirections skips Walk/Drive rows already on the timeline", () => {
  const stops = timelineStopsForDirections([
    { title: "Dinner at Botanist Restaurant", detail: "Fairmont Pacific Rim; suggest reserving" },
    { title: "Walk to Dinner at Botanist Restaurant", kind: "Transport" },
    { title: "Drive to Whistler", kind: "Transport" },
  ]);
  assert.equal(stops.length, 1);
  assert.equal(stops[0]?.title, "Dinner at Botanist Restaurant");
  assert.equal(stops[0]?.address, "Fairmont Pacific Rim");
});

test("stopsForDirections uses cities when there are two or more", () => {
  const stops = stopsForDirections(
    [
      { city: "Vancouver", lat: 49.28, lon: -123.12 },
      { city: "Whistler", lat: 50.12, lon: -122.95 },
    ],
    [{ title: "Dinner", detail: "1017 W Hastings St" }],
  );
  assert.equal(stops.length, 2);
  assert.equal(stops[0]?.title, "Vancouver");
  assert.equal(stops[0]?.lat, 49.28);
});

test("mapsDirUrl uses coordinates when both ends are known", () => {
  const url = mapsDirUrl(
    { title: "Hotel", lat: 49.289, lon: -123.117 },
    { title: "Dinner", lat: 49.284, lon: -123.12 },
    "Vancouver, Canada",
    "walking",
  );
  assert.ok(url.includes("origin=49.289,-123.117"));
  assert.ok(url.includes("destination=49.284,-123.12"));
  assert.ok(url.includes("travelmode=walking"));
});

test("mapsDirUrl falls back to a named search only when coords are missing", () => {
  const url = mapsDirUrl({ title: "Hotel" }, { title: "Dinner" }, "Vancouver, Canada");
  assert.ok(url.includes(encodeURIComponent("Hotel, Vancouver, Canada")));
  assert.ok(url.includes(encodeURIComponent("Dinner, Vancouver, Canada")));
});

test("hasCoords rejects empty and 0,0 pins", () => {
  assert.equal(hasCoords({ lat: 49.2, lon: -123.1 }), true);
  assert.equal(hasCoords({ lat: 0, lon: 0 }), false);
  assert.equal(hasCoords({ lat: null, lon: -123 }), false);
});

test("streetNameFromText pulls a street out of a shopping or range line", () => {
  assert.equal(streetNameFromText("Alberni Street Luxury Shopping"), "Alberni Street");
  assert.equal(streetNameFromText("Granville St between W 5th and W 16th"), "Granville St");
  assert.equal(streetNameFromText("Water St and surrounding alleys"), "Water St");
});

test("placeHintFromDetail keeps a street range as the street name", () => {
  assert.equal(
    placeHintFromDetail("Granville St between W 5th and W 16th; explore independent fashion"),
    "Granville St",
  );
});

test("placeQueryCandidates prefers a street or venue over a long activity title", () => {
  assert.deepEqual(placeQueryCandidates("Alberni Street Luxury Shopping", null), [
    "Alberni Street",
    "Alberni Street Luxury Shopping",
  ]);
  assert.deepEqual(placeQueryCandidates("Lunch at Nightingale", "1017 W Hastings St"), [
    "1017 W Hastings St",
  ]);
  assert.equal(
    placeQueryCandidates("Check in at Fairmont Pacific Rim", "1038 Canada Place, Vancouver")[0],
    "1038 Canada Place, Vancouver",
  );
  assert.equal(
    placeQueryCandidates("South Granville Boutiques & Art Galleries", "Granville St")[0],
    "Granville St",
  );
  assert.ok(
    placeQueryCandidates("South Granville Boutiques & Art Galleries", null).includes(
      "South Granville",
    ),
  );
});

test("reuseKeyForStop treats the same street with a city suffix as one pin", () => {
  assert.equal(
    reuseKeyForStop({ title: "Check in", address: "1038 Canada Place, Vancouver" }),
    reuseKeyForStop({ title: "Check out", address: "1038 Canada Place" }),
  );
});

/**
 * A venue's own name beats a sentence about it.
 *
 * An imported plan puts prose in `detail` ("Breakfast in Old Montréal"), and
 * that used to be searched before the title. The geocoder takes limit=1 and
 * stops at the first hit, so Olive et Gourmando landed on the Old Montréal
 * neighbourhood centroid — a confident pin in the wrong place, which is the
 * failure the area anchor exists to prevent.
 */
test("placeQueryCandidates searches the venue name before a prose detail", () => {
  assert.deepEqual(placeQueryCandidates("Olive et Gourmando", "Breakfast in Old Montréal"), [
    "Olive et Gourmando",
    "Breakfast in Old Montréal",
  ]);
  assert.equal(placeQueryCandidates("St-Viateur Bagel", "Mile End")[0], "St-Viateur Bagel");
  assert.equal(placeQueryCandidates("Marché Jean-Talon", "Little Italy")[0], "Marché Jean-Talon");
});

test("placeQueryCandidates still puts a real address first", () => {
  assert.deepEqual(placeQueryCandidates("Olive et Gourmando", "351 Rue Saint-Paul O"), [
    "351 Rue Saint-Paul O",
  ]);
  assert.equal(
    placeQueryCandidates("Mile End stroll", "Saint-Viateur Street")[0],
    "Saint-Viateur Street",
  );
});

test("placeQueryCandidates keeps the prose as a fallback when the name finds nothing", () => {
  assert.ok(
    placeQueryCandidates("Dinner in Little Italy / Mile End", "Italian, Lebanese or Québécois")
      .length >= 2,
  );
});

test("a place link opens the phone's maps app, not a website", () => {
  // openstreetmap.org is a web page on a phone: no directions button, no
  // handover to the app already holding your route.
  const url = mapsPlaceUrl("Peace Memorial Museum", { lat: 34.3955, lon: 132.4536 });
  assert.ok(url.startsWith("https://maps.google.com/?q="));
  assert.ok(!url.includes("openstreetmap"));
});

test("a place link carries the name, so Maps shows the place, not a coordinate", () => {
  const pinned = new URL(mapsPlaceUrl("Peace Memorial Museum", { lat: 34.3955, lon: 132.4536 }));
  assert.equal(pinned.searchParams.get("q"), "Peace Memorial Museum@34.3955,132.4536");
  const withStreet = new URL(
    mapsPlaceUrl("Kakiya", { lat: 34.29, lon: 132.32 }, "539 Miyajimacho, Hatsukaichi"),
  );
  assert.equal(withStreet.searchParams.get("query"), "Kakiya, 539 Miyajimacho, Hatsukaichi");
  const nameless = new URL(mapsPlaceUrl("  ", { lat: 34.3955, lon: 132.4536 }));
  assert.equal(nameless.searchParams.get("query"), "34.3955,132.4536");
});

test("a place link falls back to the name when there is no pin", () => {
  const url = mapsPlaceUrl("Crew Collective & Café", { lat: null, lon: null });
  assert.equal(new URL(url).searchParams.get("query"), "Crew Collective & Café");
});
