import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  addressForStop,
  hasCoords,
  wideDayPinsToKeep,
  isSavedDirectionItem,
  looksLikeStreetAddress,
  legMapsUrl,
  mapsDirToUrl,
  mapsPlaceUrl,
  placeHintFromDetail,
  readsLikeProse,
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

test("Maps directions start from the phone, never the stop before", () => {
  const url = legMapsUrl(
    { mode: "walking", toLat: 49.284, toLon: -123.12 },
    { title: "Dinner", lat: 49.284, lon: -123.12 },
    "Vancouver, Canada",
  );
  assert.equal(
    url,
    "https://www.google.com/maps/dir/?api=1&destination=49.284,-123.12&travelmode=walking",
  );
  assert.ok(!url.includes("origin="));
});

test("legMapsUrl goes to the stop's own pin, then the leg's end, then its name", () => {
  const moved = legMapsUrl(
    { mode: "driving", toLat: 10, toLon: 10 },
    { title: "Dinner", lat: 49.284, lon: -123.12 },
    "Vancouver, Canada",
  );
  assert.ok(moved.includes("destination=49.284,-123.12"));
  assert.ok(moved.includes("travelmode=driving"));
  const legOnly = legMapsUrl(
    { mode: "transit", toLat: 49.2, toLon: -123.1 },
    { title: "Dinner" },
    "",
  );
  assert.ok(legOnly.includes("destination=49.2,-123.1"));
  const named = legMapsUrl(null, { title: "Dinner" }, "Vancouver, Canada", "transit");
  assert.ok(named.includes(encodeURIComponent("Dinner, Vancouver, Canada")));
  assert.ok(named.includes("travelmode=transit"));
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

test("a stop without a pin is looked up next to its own day, before or after it", async () => {
  const { sameDayAnchors } = await import("./direction-stops.ts");
  const museum = { day_date: "2026-10-07", lat: 34.3915, lon: 132.4523 };
  const lunch = { day_date: "2026-10-07", lat: null, lon: null };
  const crawl = { day_date: "2026-10-07", lat: 34.2985, lon: 132.3218 };
  const nextDay = { day_date: "2026-10-08", lat: null, lon: null };
  const undated = { lat: null, lon: null };
  assert.deepEqual(sameDayAnchors([museum, lunch, crawl, nextDay, undated]), [
    { lat: 34.2985, lon: 132.3218 },
    { lat: 34.3915, lon: 132.4523 },
    { lat: 34.3915, lon: 132.4523 },
    null,
    null,
  ]);
  assert.deepEqual(sameDayAnchors([lunch, crawl])[0], { lat: 34.2985, lon: 132.3218 });
});

test("a booking status or travel note in the detail is never looked up", () => {
  for (const detail of [
    "Booked",
    "Booked 09:30",
    "BOOKED · 2 people",
    "Confirmed",
    "Getting there: Head to Motoyasubashi Pier, 11:30",
    "Afterwards: Leave for Hiroshima Station",
  ]) {
    assert.equal(placeHintFromDetail(detail), null, detail);
  }
});

test("an arrival, a label and a browse are stripped to the place", () => {
  assert.equal(placeQueryCandidates("Arrive Hiroshima Station")[0], "Hiroshima Station");
  assert.ok(
    placeQueryCandidates("Walk/browse Hondori Shopping Street").includes("Hondori Shopping Street"),
  );
  assert.ok(placeQueryCandidates("Lunch: Kakiya").includes("Kakiya"));
});

test("a sentence about the stop is not its address", () => {
  // Barreiras: these were saved as addresses and searched for as places.
  assert.equal(
    placeHintFromDetail("Drive up for panoramic sunset views overlooking Barreiras"),
    null,
  );
  assert.equal(placeHintFromDetail("Riverside lunch beside the Rio Grande"), null);
  // A name with its small words is still a name.
  assert.equal(placeHintFromDetail("Pão de Açúcar"), "Pão de Açúcar");
  assert.equal(placeHintFromDetail("Musée d'Orsay"), "Musée d'Orsay");
  assert.equal(readsLikeProse("清水寺"), false);
});

test("stopsForDirections goes out and back on a day trip", () => {
  const stops = stopsForDirections(
    [
      { city: "Kyoto", arrive_on: "2026-10-01", lat: 35.01, lon: 135.77 },
      { kind: "daytrip", city: "Hiroshima", arrive_on: "2026-10-04", lat: 34.39, lon: 132.46 },
    ],
    [],
  );
  assert.deepEqual(
    stops.map((s) => [s.title, s.day_date]),
    [
      ["Kyoto", "2026-10-01"],
      ["Hiroshima", "2026-10-04"],
      ["Kyoto", "2026-10-04"],
    ],
  );
});

test("mapsDirToUrl can ask Maps for public transport", () => {
  const url = mapsDirToUrl({ title: "Louvre", lat: 48.86, lon: 2.34 }, "Paris, France", "transit");
  assert.ok(url.includes("travelmode=transit"));
});

test("mapsDirToUrl leaves the start to Maps and names the stop without coords", () => {
  const placed = mapsDirToUrl({ title: "Mercado", lat: -12.15, lon: -44.99 }, "Barreiras");
  assert.equal(
    placed,
    "https://www.google.com/maps/dir/?api=1&destination=-12.15,-44.99&travelmode=walking",
  );
  const named = mapsDirToUrl({ title: "Mercado" }, "Barreiras (BA)");
  assert.ok(named.includes(`destination=${encodeURIComponent("Mercado, Barreiras")}`));
  assert.ok(!named.includes("origin="));
});

test("a day trip's stops found far from the hotel are kept when they agree", () => {
  const osakaHotel = { lat: 34.665, lon: 135.501 };
  const keep = wideDayPinsToKeep([
    // Hiroshima Station and the Peace Memorial Museum, 280 km from Osaka.
    { index: 3, day: "2026-10-06", pin: { lat: 34.397, lon: 132.475 }, anchor: osakaHotel },
    { index: 4, day: "2026-10-06", pin: { lat: 34.392, lon: 132.452 }, anchor: osakaHotel },
    // Sannomiya, 27 km away: a day's reach on its own.
    { index: 9, day: "2026-10-08", pin: { lat: 34.694, lon: 135.195 }, anchor: osakaHotel },
  ]);
  assert.deepEqual([...keep].sort(), [3, 4, 9]);
});

test("a lone namesake a day's reach away is not kept", () => {
  const hiroshima = { lat: 34.397, lon: 132.475 };
  // A Hiroshima lunch found in Kyoto, nothing else of its day beside it.
  const keep = wideDayPinsToKeep([
    { index: 2, day: "2026-10-07", pin: { lat: 35.004, lon: 135.768 }, anchor: hiroshima },
    { index: 5, day: "2026-10-08", pin: { lat: 35.01, lon: 135.77 }, anchor: hiroshima },
  ]);
  assert.equal(keep.size, 0);
});

test("a far pair of namesakes is not kept on a day already pinned at home", () => {
  const kyoto = { lat: 35.0036, lon: 135.7786 };
  const wide = [
    // "Gion" in Chiba and "Ryō-shō" in Kanagawa, agreeing with each other.
    { index: 9, day: "2026-10-02", pin: { lat: 35.395, lon: 139.951 }, anchor: kyoto },
    { index: 10, day: "2026-10-02", pin: { lat: 35.59, lon: 139.499 }, anchor: kyoto },
  ];
  const home = new Map([
    [
      "2026-10-02",
      [
        { lat: 34.9675, lon: 135.7797 },
        { lat: 35.005, lon: 135.7656 },
        { lat: 35.0062, lon: 135.7672 },
        { lat: 35.0036, lon: 135.7786 },
      ],
    ],
  ]);
  assert.equal(wideDayPinsToKeep(wide, undefined, home).size, 0);
  // Without the day's own pins the pair still backs itself, as before.
  assert.equal(wideDayPinsToKeep(wide).size, 2);
});

test("a German street named with its preposition is a street address", () => {
  assert.equal(looksLikeStreetAddress("Unter den Linden 77"), true);
  assert.equal(looksLikeStreetAddress("Am Kupfergraben 6"), true);
  assert.equal(looksLikeStreetAddress("An der Alster 72"), true);
  // A name ending in a number still is not.
  assert.equal(looksLikeStreetAddress("Curry 36"), false);
  assert.equal(looksLikeStreetAddress("Terminal 5"), false);
});
