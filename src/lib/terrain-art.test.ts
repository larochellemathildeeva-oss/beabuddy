import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  artCovers,
  terrainFor,
  terrainKey,
  terrainSrc,
  TERRAIN_ART,
  type TerrainRegistry,
} from "./terrain-art.ts";

const como = { lat: 45.99, lon: 9.26 };
const munich = { lat: 48.14, lon: 11.58 };
const tokyo = { lat: 35.68, lon: 139.69 };

const registry: TerrainRegistry = {
  "alps-road-trip": {
    src: "/terrain/alps.webp",
    darkSrc: "/terrain/alps-night.webp",
    bounds: [7, 44.5, 13.5, 49.5],
    width: 1200,
    height: 1100,
  },
  japan: { src: "/terrain/japan.webp" },
};

describe("terrainKey", () => {
  it("keeps the place before the comma, without accents, as a slug", () => {
    assert.equal(terrainKey("Lake Como, Italy"), "lake-como");
    assert.equal(terrainKey("Zürich"), "zurich");
    assert.equal(terrainKey("  Alps Road Trip! "), "alps-road-trip");
    assert.equal(terrainKey(null), "");
  });
});

describe("terrainFor", () => {
  it("ships with no art: every destination falls back", () => {
    assert.deepEqual(Object.keys(TERRAIN_ART), []);
    assert.equal(terrainFor(["Alps Road Trip", "Lake Como", "Italy"], [como]), null);
  });
  it("takes the first place with art, the trip's title before its cities and country", () => {
    const hit = terrainFor(["Alps Road Trip", "Lake Como", "Italy"], [como, munich], registry);
    assert.equal(hit?.key, "alps-road-trip");
    assert.equal(terrainFor(["Japan Explorer", "Kyoto", "Japan"], [tokyo], registry)?.key, "japan");
  });
  it("skips a map whose box does not hold every stop", () => {
    assert.equal(terrainFor(["Alps Road Trip"], [como, tokyo], registry), null);
  });
});

describe("artCovers", () => {
  it("needs the picture's size to read its box", () => {
    assert.equal(artCovers({ src: "x", bounds: [0, 0, 10, 10] }, [{ lat: 5, lon: 5 }]), false);
    assert.equal(artCovers({ src: "x" }, [tokyo]), true);
  });
  it("reads a box across the 180° line", () => {
    const art = { src: "x", bounds: [170, -20, -170, 0] as const, width: 10, height: 10 };
    assert.equal(
      artCovers(art, [
        { lat: -10, lon: 178 },
        { lat: -12, lon: -175 },
      ]),
      true,
    );
    assert.equal(artCovers(art, [{ lat: -10, lon: 160 }]), false);
  });
});

describe("terrainSrc", () => {
  it("uses the night picture in Dark when there is one", () => {
    const art = registry["alps-road-trip"]!;
    assert.equal(terrainSrc(art, true), "/terrain/alps-night.webp");
    assert.equal(terrainSrc(art, false), "/terrain/alps.webp");
    assert.equal(terrainSrc(registry["japan"]!, true), "/terrain/japan.webp");
  });
});
