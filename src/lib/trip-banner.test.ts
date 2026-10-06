import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { asTripBanner, bannerPhotos, nextBannerIndex } from "./trip-banner.ts";

const p = (id: string, extra: Record<string, string | null> = {}) => ({
  id,
  storage_path: `u/${id}.jpg`,
  city: null,
  country: null,
  taken_at: null,
  ...extra,
});

describe("asTripBanner", () => {
  it("keeps the four looks and defaults to own photos", () => {
    for (const v of ["mine", "stock", "illustration", "compact"]) assert.equal(asTripBanner(v), v);
    assert.equal(asTripBanner("photo"), "mine");
    assert.equal(asTripBanner(null), "mine");
  });
});

describe("bannerPhotos", () => {
  it("lists the trip's photos first, then ones placed in its cities", () => {
    const out = bannerPhotos(
      [p("a", { taken_at: "2026-01-01" }), p("b", { taken_at: "2026-02-01" })],
      [p("c", { city: "Kyoto" }), p("d", { city: "Paris" })],
      { city: "Kyoto" },
    );
    assert.deepEqual(
      out.map((x) => x.id),
      ["b", "a", "c"],
    );
  });

  it("skips location-only rows and repeats", () => {
    const out = bannerPhotos(
      [p("a"), { ...p("b"), storage_path: "location-only:1,2" }],
      [p("a", { country: "Japan" })],
      { country: "Japan" },
    );
    assert.deepEqual(
      out.map((x) => x.id),
      ["a"],
    );
  });

  it("stops at eight", () => {
    const many = Array.from({ length: 12 }, (_, i) => p(`p${i}`));
    assert.equal(bannerPhotos(many, [], {}).length, 8);
  });
});

describe("nextBannerIndex", () => {
  it("wraps round and stays put for one photo", () => {
    assert.equal(nextBannerIndex(1, 3), 2);
    assert.equal(nextBannerIndex(2, 3), 0);
    assert.equal(nextBannerIndex(0, 1), 0);
    assert.equal(nextBannerIndex(0, 0), 0);
  });
});
