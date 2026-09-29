import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CreditGuard, RATE_LIMIT_REST_MS, geoapifyCredits, nextUtcDay } from "./geo-credits.ts";
import { geoapifyDetailsUrl, geoapifyPlacesUrl, geoapifyStaticMapUrl } from "./geoapify.ts";

const noon = Date.UTC(2026, 8, 28, 12);

test("each Geoapify request costs what its usage report says", () => {
  assert.equal(geoapifyCredits("https://api.geoapify.com/v1/geocode/search?text=x&apiKey=k"), 1);
  assert.equal(geoapifyCredits("https://api.geoapify.com/v1/routing?waypoints=1,2|3,4"), 1);
  assert.equal(geoapifyCredits(geoapifyDetailsUrl("k", 34.39, 132.45)), 2);
  assert.equal(geoapifyCredits(geoapifyPlacesUrl("k", "catering", { lat: 1, lon: 2 }, 500, 60)), 1);
  assert.equal(
    geoapifyCredits("https://maps.geoapify.com/v1/tile/positron/3/1/2.png?apiKey=k"),
    0.25,
  );
  assert.equal(
    geoapifyCredits("https://maps.geoapify.com/v1/styles/klokantech-basic/fonts/Noto/0-255.pbf"),
    0.25,
  );
  const three = [
    { lat: 1, lon: 1 },
    { lat: 2, lon: 2 },
    { lat: 3, lon: 3 },
  ];
  assert.equal(geoapifyCredits(geoapifyStaticMapUrl("k", three)), 4);
});

test("other services and nonsense cost nothing", () => {
  assert.equal(geoapifyCredits("https://us1.locationiq.com/v1/search?q=x"), 0);
  assert.equal(geoapifyCredits("https://nominatim.openstreetmap.org/search?q=x"), 0);
  assert.equal(geoapifyCredits("https://evil.com/geoapify.com/v1/geocode"), 0);
  assert.equal(geoapifyCredits("not a url"), 0);
});

test("the next UTC day starts at midnight UTC", () => {
  assert.equal(nextUtcDay(noon), Date.UTC(2026, 8, 29));
  assert.equal(nextUtcDay(Date.UTC(2026, 11, 31, 23, 59)), Date.UTC(2027, 0, 1));
});

test("reaching the ceiling rests Geoapify until the next UTC day", () => {
  const guard = new CreditGuard(10);
  assert.equal(guard.spend(9, noon), false);
  assert.equal(guard.resting(noon), false);
  assert.equal(guard.spend(1, noon), true);
  assert.equal(guard.resting(noon), true);
  assert.equal(guard.reason, "ceiling");
  assert.equal(guard.spend(1, noon + 1), false, "already resting: no second switch");
  const tomorrow = Date.UTC(2026, 8, 29, 0, 1);
  assert.equal(guard.resting(tomorrow), false);
  assert.equal(guard.credits(tomorrow), 0);
});

test("a refusal rests it for the day, a 429 for ten minutes", () => {
  const refused = new CreditGuard();
  assert.equal(refused.answered(200, noon), false);
  assert.equal(refused.answered(404, noon), false);
  assert.equal(refused.answered(402, noon), true);
  assert.equal(refused.reason, "refused");
  assert.equal(refused.resting(Date.UTC(2026, 8, 28, 23, 59)), true);

  const busy = new CreditGuard();
  assert.equal(busy.answered(429, noon), true);
  assert.equal(busy.reason, "rate-limited");
  assert.equal(busy.resting(noon + RATE_LIMIT_REST_MS - 1), true);
  assert.equal(busy.resting(noon + RATE_LIMIT_REST_MS), false);
  assert.equal(busy.reason, null);
});
