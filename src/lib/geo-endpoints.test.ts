import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  PUBLIC_PROVIDER,
  classifyGeoStatus,
  locationIqProvider,
  nextDelayMs,
  routeProfile,
  reverseUrl,
  routeUrl,
  searchUrl,
  viewboxAround,
} from "./geo-endpoints.ts";

test("the public endpoint is unchanged and carries no key", () => {
  const url = searchUrl(PUBLIC_PROVIDER, { query: "Olive et Gourmando", language: "*" });
  assert.ok(url.startsWith("https://nominatim.openstreetmap.org/search?"));
  assert.ok(url.includes("q=Olive+et+Gourmando"));
  assert.ok(url.includes("accept-language=*"));
  assert.ok(!url.includes("key="), "no token should appear on the keyless endpoint");
});

test("LocationIQ takes the same query with a key on the end", () => {
  const url = searchUrl(locationIqProvider("tok_abc"), { query: "清水寺", language: "*" });
  assert.ok(url.startsWith("https://us1.locationiq.com/v1/search?"));
  assert.ok(url.includes("key=tok_abc"));
  assert.ok(url.includes(encodeURIComponent("清水寺").replace(/%20/g, "+")));
});

test("search options map onto the parameters the place parser needs", () => {
  const url = searchUrl(PUBLIC_PROVIDER, {
    query: "Mandy's",
    limit: 10,
    format: "jsonv2",
    addressDetails: true,
    nameDetails: true,
    extraTags: true,
    language: "en",
  });
  assert.ok(url.includes("format=jsonv2"));
  assert.ok(url.includes("limit=10"));
  assert.ok(url.includes("addressdetails=1"));
  assert.ok(url.includes("namedetails=1"));
  assert.ok(url.includes("extratags=1"));
});

test("extratags is omitted unless asked for", () => {
  const url = searchUrl(PUBLIC_PROVIDER, { query: "subway" });
  assert.ok(!url.includes("extratags"));
});

test("a query with an ampersand or a slash cannot break the URL", () => {
  const url = searchUrl(PUBLIC_PROVIDER, { query: "Crew Collective & Café / Old Montréal" });
  assert.ok(!url.includes("& Café"), "the ampersand must be encoded, not left as a separator");
  assert.equal(new URL(url).searchParams.get("q"), "Crew Collective & Café / Old Montréal");
});

test("routing keeps OSRM's lon,lat order on both providers", () => {
  const from = { lat: 45.5, lon: -73.55 };
  const to = { lat: 45.52, lon: -73.58 };
  const pub = routeUrl(PUBLIC_PROVIDER, "driving", from, to);
  assert.ok(pub.includes("/route/v1/driving/-73.55,45.5;-73.58,45.52"));
  assert.ok(!pub.includes("key="));

  const paid = routeUrl(locationIqProvider("tok_abc"), "walking", from, to);
  assert.ok(paid.startsWith("https://us1.locationiq.com/v1/directions/route/v1/walking/"));
  assert.ok(paid.includes("key=tok_abc"));
});

test("the paid provider is allowed to go faster, within the same minute cap", () => {
  assert.equal(PUBLIC_PROVIDER.gapMs, 1_100);
  assert.equal(locationIqProvider("t").gapMs, 500);
  // Two a second, but sixty a minute — the minute is what binds on a long plan.
  assert.equal(locationIqProvider("t").perMinute, 60);
});

test("walking is 'foot' on the demo router and 'walking' on LocationIQ", () => {
  // Swapping the base URL and keeping "foot" would 400 every walking leg,
  // silently, because a route that does not come back already means "no route".
  assert.equal(routeProfile(PUBLIC_PROVIDER, "walking"), "foot");
  assert.equal(routeProfile(locationIqProvider("t"), "walking"), "walking");
  assert.equal(routeProfile(PUBLIC_PROVIDER, "driving"), "driving");
  assert.equal(routeProfile(locationIqProvider("t"), "driving"), "driving");
});

test("a rate limit is not the same answer as 'no such place'", () => {
  assert.equal(classifyGeoStatus(200), "ok");
  assert.equal(classifyGeoStatus(429), "retry");
  assert.equal(classifyGeoStatus(503), "retry");
  assert.equal(classifyGeoStatus(408), "retry");
  assert.equal(classifyGeoStatus(404), "miss");
  assert.equal(classifyGeoStatus(400), "miss");
});

test("nextDelayMs keeps the burst rate between requests", () => {
  const p = locationIqProvider("t");
  assert.equal(nextDelayMs(p, [], 10_000), 0, "nothing sent yet");
  assert.equal(nextDelayMs(p, [10_000], 10_000), 500, "just sent one");
  assert.equal(nextDelayMs(p, [10_000], 10_300), 200, "part way through the gap");
  assert.equal(nextDelayMs(p, [10_000], 10_600), 0, "gap already elapsed");
});

test("nextDelayMs waits out the minute cap, which the burst rate would blow through", () => {
  const p = locationIqProvider("t");
  // Sixty requests sent over the last thirty seconds: allowed at 2/s, but the
  // minute's allowance is spent, so the next one waits for the oldest to age out.
  const now = 100_000;
  const recent = Array.from({ length: 60 }, (_, i) => now - 30_000 + i * 500);
  const wait = nextDelayMs(p, recent, now);
  assert.ok(wait > 25_000, `expected a long wait, got ${wait}`);
  assert.ok(wait <= 30_500, `expected under half a minute, got ${wait}`);
});

test("nextDelayMs stops waiting once the minute has rolled over", () => {
  const p = locationIqProvider("t");
  const now = 200_000;
  const old = Array.from({ length: 60 }, (_, i) => now - 90_000 + i * 100);
  assert.equal(nextDelayMs(p, old, now), 0, "all of those are older than a minute");
});

test("viewboxAround makes a box that actually contains the point", () => {
  const [x1, y1, x2, y2] = viewboxAround(45.5, -73.55, 12).split(",").map(Number);
  assert.ok(x1! < -73.55 && x2! > -73.55, "longitude should straddle the point");
  assert.ok(y1! > 45.5 && y2! < 45.5, "latitude should straddle the point");
});

test("viewboxAround widens with latitude, because degrees of longitude shrink", () => {
  const width = (box: string) => {
    const [x1, , x2] = box.split(",").map(Number);
    return x2! - x1!;
  };
  // Same 12km, much further north: the box must be wider in degrees.
  assert.ok(width(viewboxAround(64.1, -21.9)) > width(viewboxAround(1.35, 103.8)) * 2);
});

test("viewboxAround survives the poles and the date line", () => {
  assert.ok(
    viewboxAround(89.9, 179.9)
      .split(",")
      .every((n) => Number.isFinite(Number(n))),
  );
  const [, y1, , y2] = viewboxAround(89.9, 0).split(",").map(Number);
  assert.ok(y1! <= 90 && y2! <= 90, "latitude must stay on the planet");
});

test("a search carries the viewbox when one is given, and not otherwise", () => {
  const box = viewboxAround(45.5, -73.55);
  assert.ok(searchUrl(PUBLIC_PROVIDER, { query: "subway", viewbox: box }).includes("viewbox="));
  assert.ok(!searchUrl(PUBLIC_PROVIDER, { query: "subway" }).includes("viewbox="));
});

test("a nearby search must bound the viewbox, or chains stay worldwide", () => {
  // viewbox alone does not change Nominatim's answer for "subway". bounded=1
  // is what finds the shop around the corner instead of one in Mexico.
  const box = viewboxAround(45.5, -73.55);
  const nearby = searchUrl(PUBLIC_PROVIDER, {
    query: "subway",
    viewbox: box,
    bounded: true,
  });
  assert.ok(nearby.includes("viewbox="));
  assert.equal(new URL(nearby).searchParams.get("bounded"), "1");
  // Never bound without a box — the parameter would be meaningless.
  const naked = searchUrl(PUBLIC_PROVIDER, { query: "subway", bounded: true });
  assert.equal(new URL(naked).searchParams.get("bounded"), null);
});

test("LocationIQ never receives jsonv2 — it 400s and Recs looks empty", () => {
  // Nominatim accepts jsonv2. LocationIQ's documented formats are json/xml
  // only; jsonv2 is "Invalid Request", which we used to treat as no match.
  const paid = searchUrl(locationIqProvider("tok_abc"), {
    query: "Harvey's",
    format: "jsonv2",
    addressDetails: true,
  });
  assert.equal(new URL(paid).searchParams.get("format"), "json");
  assert.ok(!paid.includes("jsonv2"));

  const pub = searchUrl(PUBLIC_PROVIDER, { query: "Harvey's", format: "jsonv2" });
  assert.equal(new URL(pub).searchParams.get("format"), "jsonv2");
});

test("reverse geocoding also drops jsonv2 on LocationIQ", () => {
  const paid = reverseUrl(locationIqProvider("tok_abc"), 45.5, -73.55);
  assert.equal(new URL(paid).searchParams.get("format"), "json");
  const pub = reverseUrl(PUBLIC_PROVIDER, 45.5, -73.55);
  assert.equal(new URL(pub).searchParams.get("format"), "jsonv2");
});

test("viewboxAround defaults wide enough that a city-edge shop still fits", () => {
  // 25 km ≈ 0.225° of latitude. The old 12 km default left too much of a
  // city outside once searches were actually restricted to the box.
  const [, y1, , y2] = viewboxAround(45.5, -73.55).split(",").map(Number);
  assert.ok(y1! - y2! > 0.4, `expected ~0.45° of latitude, got ${y1! - y2!}`);
});

test("reverse geocoding goes to the same provider as everything else", () => {
  const pub = reverseUrl(PUBLIC_PROVIDER, 45.5, -73.55);
  assert.ok(pub.startsWith("https://nominatim.openstreetmap.org/reverse?"));
  assert.ok(!pub.includes("key="));
  assert.ok(!pub.includes("bigdatacloud"));

  const paid = reverseUrl(locationIqProvider("tok_abc"), 45.5, -73.55);
  assert.ok(paid.startsWith("https://us1.locationiq.com/v1/reverse?"));
  assert.ok(paid.includes("key=tok_abc"));
  assert.equal(new URL(paid).searchParams.get("lat"), "45.5");
  assert.equal(new URL(paid).searchParams.get("lon"), "-73.55");
});
