import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  countryFilterAt,
  isGenericPlaceName,
  namesOtherCountry,
  pexelsSearchUrl,
  pexelsTownQuery,
  readPexelsPhoto,
  takeFromHour,
} from "./pexels.ts";
import { creditedOnPhoto, photoCredit } from "./wikimedia.ts";

const photo = (alt: string, extra: Record<string, unknown> = {}) => ({
  width: 4000,
  height: 3000,
  url: "https://www.pexels.com/photo/eiffel-tower-123/",
  photographer: " Jane Doe ",
  alt,
  src: {
    large: "https://images.pexels.com/photos/123/a.jpeg?w=940",
    large2x: "https://images.pexels.com/photos/123/a.jpeg?w=1880",
  },
  ...extra,
});

test("a Pexels search asks for landscape photos only for banners", () => {
  const banner = new URL(pexelsSearchUrl("Kyoto Japan", "banner"));
  assert.equal(banner.origin + banner.pathname, "https://api.pexels.com/v1/search");
  assert.equal(banner.searchParams.get("query"), "Kyoto Japan");
  assert.equal(banner.searchParams.get("orientation"), "landscape");
  assert.equal(new URL(pexelsSearchUrl("Louvre", "place")).searchParams.get("orientation"), null);
});

test("a town query is the town and its country, once", () => {
  assert.equal(pexelsTownQuery("Kyoto, Kyoto Prefecture", "Japan"), "Kyoto Japan");
  assert.equal(pexelsTownQuery("Singapore", "Singapore"), "Singapore");
  assert.equal(pexelsTownQuery("Lisbon"), "Lisbon");
  assert.equal(pexelsTownQuery(" ", "France"), "");
});

test("only a photo whose description names the place is taken", () => {
  const json = {
    photos: [photo("A cozy cafe with wooden chairs"), photo("The Eiffel Tower at sunset in Paris")],
  };
  const found = readPexelsPhoto(json, ["Eiffel Tower"], "place");
  assert.deepEqual(found, {
    url: "https://images.pexels.com/photos/123/a.jpeg?w=940",
    page: "https://www.pexels.com/photo/eiffel-tower-123/",
    author: "Jane Doe",
    license: "Pexels License",
    source: "pexels",
  });
  assert.equal(readPexelsPhoto(json, ["Café de Flore"], "place"), null);
  // Whole words only, and very short names never match.
  assert.equal(readPexelsPhoto({ photos: [photo("Parisian streets")] }, ["Paris"], "place"), null);
  assert.equal(readPexelsPhoto({ photos: [photo("Bar in Rome")] }, ["Bar"], "place"), null);
});

test("a banner takes the wide image and skips tall photos", () => {
  const tall = photo("Kyoto temple", { width: 2000, height: 3000 });
  assert.equal(readPexelsPhoto({ photos: [tall] }, ["Kyoto"], "banner"), null);
  assert.equal(
    readPexelsPhoto({ photos: [photo("Kyoto temple")] }, ["Kyoto"], "banner")?.url,
    "https://images.pexels.com/photos/123/a.jpeg?w=1880",
  );
});

test("answers from elsewhere or without a photographer are skipped", () => {
  const offsite = photo("Kyoto", { src: { large: "https://evil.example/a.jpg" } });
  const anonymous = photo("Kyoto", { photographer: "" });
  assert.equal(readPexelsPhoto({ photos: [offsite, anonymous] }, ["Kyoto"], "place"), null);
  assert.equal(readPexelsPhoto(null, ["Kyoto"], "place"), null);
});

test("a generic stop name never matches a stock photo", () => {
  assert.equal(isGenericPlaceName("Cafe"), true);
  assert.equal(isGenericPlaceName("The Old Town"), true);
  assert.equal(isGenericPlaceName("Café de Flore"), false);
  assert.equal(isGenericPlaceName("Louvre Museum"), false);
  const json = { photos: [photo("A cozy cafe with wooden chairs")] };
  assert.equal(readPexelsPhoto(json, ["Cafe"], "place"), null);
});

test("a town's photo must not name another country", () => {
  assert.equal(namesOtherCountry("Eiffel Tower in Paris, France", "United States"), true);
  assert.equal(namesOtherCountry("Paris, Texas, United States", "USA"), false);
  assert.equal(namesOtherCountry("Paris in the rain", "United States"), false);
  // "in" and "it" are country codes too, but not country names.
  assert.equal(namesOtherCountry("Walking in it at night", "France"), false);
  assert.equal(namesOtherCountry("Paris, France", null), false);
  const json = { photos: [photo("Paris, France at dusk")] };
  assert.equal(readPexelsPhoto(json, ["Paris"], "banner", "United States"), null);
  assert.ok(readPexelsPhoto(json, ["Paris"], "banner", "France"));
});

test("searches are counted over a rolling hour", () => {
  const times: number[] = [];
  assert.equal(takeFromHour(times, 0, 2), true);
  assert.equal(takeFromHour(times, 1_000, 2), true);
  assert.equal(takeFromHour(times, 2_000, 2), false);
  assert.equal(times.length, 2);
  assert.equal(takeFromHour(times, 60 * 60_000 + 1, 2), true);
});

test("a Pexels photo is credited to its photographer on Pexels", () => {
  assert.equal(creditedOnPhoto({ source: "pexels" }), false);
  assert.equal(creditedOnPhoto({}), true);
  assert.equal(
    photoCredit({ author: "Jane Doe", license: "Pexels License", source: "pexels" }),
    "Photo: Jane Doe on Pexels",
  );
});

test("a stop's photo that names a country its pin cannot be in is passed over", () => {
  const boxes = [
    { country: "Austria", bbox: [9.53, 46.37, 17.16, 49.02] },
    { country: "Spain", bbox: [-18.17, 27.64, 4.33, 43.79] },
    { country: "Aland", bbox: [19.5, 59.9, 21.1, 60.5] },
  ];
  const madrid = countryFilterAt(40.42, -3.7, boxes);
  const vienna = countryFilterAt(48.21, 16.37, boxes);
  assert.equal(madrid("ES"), true);
  assert.equal(madrid("AT"), false);
  assert.equal(vienna("AT"), true);
  // A country without a box never rules a photo out.
  assert.equal(madrid("JP"), true);

  const json = { photos: [photo("Inside Cafe Central in Vienna, Austria")] };
  assert.equal(readPexelsPhoto(json, ["Cafe Central"], "place", null, madrid), null);
  assert.notEqual(readPexelsPhoto(json, ["Cafe Central"], "place", null, vienna), null);
  // A description that names no country is taken anywhere.
  const plain = { photos: [photo("Cafe Central at night")] };
  assert.notEqual(readPexelsPhoto(plain, ["Cafe Central"], "place", null, madrid), null);
});
