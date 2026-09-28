import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pexelsSearchUrl, pexelsTownQuery, readPexelsPhoto } from "./pexels.ts";
import { photoCredit } from "./wikimedia.ts";

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

test("a Pexels photo is credited to its photographer on Pexels", () => {
  assert.equal(
    photoCredit({ author: "Jane Doe", license: "Pexels License", source: "pexels" }),
    "Photo: Jane Doe on Pexels",
  );
});
