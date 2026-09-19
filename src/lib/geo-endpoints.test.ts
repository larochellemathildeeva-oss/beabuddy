import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PUBLIC_PROVIDER, locationIqProvider, routeUrl, searchUrl } from "./geo-endpoints.ts";

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
    language: "en",
  });
  assert.ok(url.includes("format=jsonv2"));
  assert.ok(url.includes("limit=10"));
  assert.ok(url.includes("addressdetails=1"));
  assert.ok(url.includes("namedetails=1"));
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
