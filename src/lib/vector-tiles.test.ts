import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  OFFLINE_TILE_MAX,
  boxAround,
  glyphPath,
  glyphSourceUrl,
  LANGUAGE_GLYPH_STARTS,
  offlineGlyphPaths,
  offlineTilePlan,
  openFreeMapGlyphUrl,
  openFreeMapTileUrl,
  parseGlyphPath,
  prettyMegabytes,
  parseVectorTilePath,
  protocolToPath,
  readOpenFreeMapTemplate,
  tileFor,
  tilesInBox,
  vectorTilePath,
  vectorTileSourceUrl,
} from "./vector-tiles.ts";

test("vector tile paths are parsed, not trusted", () => {
  assert.deepEqual(parseVectorTilePath("/api/vtile/14/7780/6230.pbf"), { z: 14, x: 7780, y: 6230 });
  assert.deepEqual(parseVectorTilePath("/api/vtile/0/0/0.pbf"), { z: 0, x: 0, y: 0 });
  assert.equal(parseVectorTilePath("/api/vtile/15/1/1.pbf"), null, "past the data's zoom");
  assert.equal(parseVectorTilePath("/api/vtile/1/2/0.pbf"), null, "outside the world");
  assert.equal(parseVectorTilePath("/api/vtile/1/0/0.png"), null);
  assert.equal(parseVectorTilePath("/api/vtile/1/0/../0.pbf"), null);
  assert.equal(parseVectorTilePath("/api/vtile/-1/0/0.pbf"), null);
  assert.equal(vectorTilePath({ z: 3, x: 4, y: 2 }), "/api/vtile/3/4/2.pbf");
});

test("the upstream tile URL carries the key only on the server side", () => {
  const url = new URL(vectorTileSourceUrl({ z: 3, x: 4, y: 2 }, "k&y"));
  assert.equal(url.host, "maps.geoapify.com");
  assert.ok(url.pathname.endsWith("/3/4/2.pbf"));
  assert.equal(url.searchParams.get("apiKey"), "k&y");
});

test("OpenFreeMap's weekly tile template is read from its TileJSON, and only its own", () => {
  const template = "https://tiles.openfreemap.org/planet/20260927_080001_pt/{z}/{x}/{y}.pbf";
  assert.equal(readOpenFreeMapTemplate({ tilejson: "3.0.0", tiles: [template] }), template);
  assert.equal(
    openFreeMapTileUrl(template, { z: 14, x: 8185, y: 5448 }),
    "https://tiles.openfreemap.org/planet/20260927_080001_pt/14/8185/5448.pbf",
  );
  assert.equal(readOpenFreeMapTemplate({ tiles: ["https://evil.example/{z}/{x}/{y}.pbf"] }), null);
  assert.equal(
    readOpenFreeMapTemplate({ tiles: ["https://tiles.openfreemap.org.evil.example/{z}/{x}/{y}"] }),
    null,
  );
  assert.equal(
    readOpenFreeMapTemplate({ tiles: ["http://tiles.openfreemap.org/{z}/{x}/{y}"] }),
    null,
  );
  assert.equal(
    readOpenFreeMapTemplate({ tiles: ["https://tiles.openfreemap.org/planet/{z}/{x}"] }),
    null,
  );
  assert.equal(readOpenFreeMapTemplate({ tiles: [] }), null);
  assert.equal(readOpenFreeMapTemplate(null), null);
  assert.equal(readOpenFreeMapTemplate("nope"), null);
});

test("OpenFreeMap's fonts are asked for by the same names and blocks", () => {
  assert.equal(
    openFreeMapGlyphUrl({ font: "Noto Sans Italic", start: 256 }),
    "https://tiles.openfreemap.org/fonts/Noto%20Sans%20Italic/256-511.pbf",
  );
});

test("glyph paths accept only the style's fonts and real blocks", () => {
  assert.deepEqual(parseGlyphPath("/api/glyphs/Noto%20Sans%20Regular/0-255.pbf"), {
    font: "Noto Sans Regular",
    start: 0,
  });
  assert.equal(parseGlyphPath("/api/glyphs/Comic%20Sans/0-255.pbf"), null);
  assert.equal(parseGlyphPath("/api/glyphs/Noto%20Sans%20Regular/1-256.pbf"), null);
  assert.equal(parseGlyphPath("/api/glyphs/Noto%20Sans%20Regular/0-511.pbf"), null);
  assert.equal(parseGlyphPath("/api/glyphs/Noto%20Sans%20Regular/65536-65791.pbf"), null);
  assert.equal(parseGlyphPath("/api/glyphs/%E0%A4%A/0-255.pbf"), null, "broken escape");
  const path = glyphPath({ font: "Noto Sans Italic", start: 256 });
  assert.deepEqual(parseGlyphPath(path), { font: "Noto Sans Italic", start: 256 });
  assert.ok(
    glyphSourceUrl({ font: "Noto Sans Italic", start: 256 }, "k").includes(
      "/Noto%20Sans%20Italic/256-511.pbf",
    ),
  );
});

test("the map's protocol URLs become the same Béa paths the server accepts", () => {
  assert.equal(protocolToPath("bea-tile://12/2040/1360"), "/api/vtile/12/2040/1360.pbf");
  assert.equal(protocolToPath("bea-tile://15/0/0"), null);
  assert.equal(
    protocolToPath("bea-glyph://Noto Sans Regular,Arial Unicode MS Regular/0-255"),
    "/api/glyphs/Noto%20Sans%20Regular/0-255.pbf",
  );
  assert.equal(
    protocolToPath("bea-glyph://Noto%20Sans%20Italic/256-511"),
    "/api/glyphs/Noto%20Sans%20Italic/256-511.pbf",
  );
  assert.equal(protocolToPath("bea-glyph://Other/0-255"), null);
  assert.equal(protocolToPath("https://example.com/0/0/0"), null);
  // Every glyph kept offline is one the server will serve.
  for (const p of offlineGlyphPaths()) assert.ok(parseGlyphPath(p), p);
  for (const lang of Object.keys(LANGUAGE_GLYPH_STARTS)) {
    for (const p of offlineGlyphPaths(lang)) assert.ok(parseGlyphPath(p), `${lang}: ${p}`);
  }
});

test("tileFor matches the usual slippy-map numbering", () => {
  // Lisbon's Praça do Comércio.
  assert.deepEqual(tileFor(38.7075, -9.1364, 14), { x: 7776, y: 6278 });
  assert.deepEqual(tileFor(0, 0, 0), { x: 0, y: 0 });
  assert.deepEqual(tileFor(89, 179.9999, 2), { x: 3, y: 0 }, "clamped at the poles");
});

test("boxAround pads the stops and ignores missing pins", () => {
  assert.equal(boxAround([], 2), null);
  assert.equal(boxAround([{ lat: 0, lon: 0 }], 2), null);
  const box = boxAround(
    [
      { lat: 38.7, lon: -9.14 },
      { lat: 38.72, lon: -9.12 },
    ],
    2,
  )!;
  assert.ok(box.south < 38.7 - 0.017 && box.north > 38.72 + 0.017);
  assert.ok(
    box.west < -9.14 - 0.02 && box.east > -9.12 + 0.02,
    "longitude padded more away from the equator",
  );
});

test("tilesInBox covers the box at a zoom", () => {
  const tiles = tilesInBox({ south: 38.69, west: -9.16, north: 38.73, east: -9.1 }, 14);
  assert.ok(tiles.length >= 4 && tiles.length <= 12, String(tiles.length));
  assert.ok(tiles.every((t) => t.z === 14));
});

test("offlineTilePlan keeps a city day well under the cap, with no repeats", () => {
  const lisbon = [
    { lat: 38.7075, lon: -9.1364 },
    { lat: 38.7139, lon: -9.1334 },
    { lat: 38.6979, lon: -9.2066 },
  ];
  const plan = offlineTilePlan([lisbon, lisbon.slice(0, 2)]);
  assert.ok(plan.length > 20 && plan.length < OFFLINE_TILE_MAX / 2, String(plan.length));
  assert.ok(
    plan.some((t) => t.z === 14),
    "down to street level",
  );
  assert.ok(
    plan.some((t) => t.z === 0),
    "the world tile, so offline can tell a map was kept",
  );
  assert.equal(new Set(plan.map((t) => `${t.z}/${t.x}/${t.y}`)).size, plan.length);
  assert.deepEqual(offlineTilePlan([]), []);
  assert.deepEqual(offlineTilePlan([[{ lat: 0, lon: 0 }]]), []);
});

test("offlineTilePlan drops the closest zoom first when a trip is too big", () => {
  // Two cities a country apart keep their own areas, not the land between.
  const lisbon = [{ lat: 38.7075, lon: -9.1364 }];
  const porto = [{ lat: 41.1496, lon: -8.611 }];
  const both = offlineTilePlan([lisbon, porto]);
  assert.ok(both.length < 200, String(both.length));
  // A day spread across a whole region blows the cap at zoom 14.
  const sprawl = [
    { lat: 38.5, lon: -9.4 },
    { lat: 39.2, lon: -8.6 },
  ];
  const capped = offlineTilePlan([sprawl], 300);
  assert.ok(capped.length <= 300 && capped.length > 0);
  assert.ok(Math.max(...capped.map((t) => t.z)) < 14);
});

test("prettyMegabytes says how much room a map takes", () => {
  assert.equal(prettyMegabytes(20_000), "under 0.1 MB");
  assert.equal(prettyMegabytes(1.84 * 1024 * 1024), "1.8 MB");
  assert.equal(prettyMegabytes(23.6 * 1024 * 1024), "24 MB");
});

test("a day across the date line keeps a few tiles either side, not the world", () => {
  // Taveuni, Fiji: stops a few kilometres apart, either side of 180°.
  const day = [
    { lat: -16.79, lon: 179.98 },
    { lat: -16.82, lon: -179.97 },
  ];
  const box = boxAround(day, 2)!;
  assert.ok(box.east - box.west < 1, `${box.west}..${box.east}`);
  const z14 = tilesInBox(box, 14);
  assert.ok(z14.length > 0 && z14.length <= 30, String(z14.length));
  const xs = z14.map((t) => t.x);
  assert.ok(xs.includes(0) && xs.includes(2 ** 14 - 1), "both halves");
  const plan = offlineTilePlan([day]);
  assert.ok(plan.length > 0 && plan.some((t) => t.z === 14));
});

test("every zoom the day map allows is kept, so zooming out offline still shows the day", () => {
  const plan = offlineTilePlan([[{ lat: 38.7075, lon: -9.1364 }]]);
  for (let z = 0; z <= 14; z++)
    assert.ok(
      plan.some((t) => t.z === z),
      `zoom ${z}`,
    );
});

test("a box edge exactly on a tile boundary does not pull in the next column", () => {
  assert.deepEqual(
    tilesInBox({ south: 1, west: 1, north: 2, east: 180 }, 1).map((t) => t.x),
    [1],
  );
});

test("a saved map keeps the traveller's own script, so its labels do not vanish offline", () => {
  const base = offlineGlyphPaths();
  assert.equal(base.length, 10, "five blocks, two fonts");
  assert.deepEqual(offlineGlyphPaths("fr"), base, "Latin needs nothing more");
  assert.deepEqual(offlineGlyphPaths("ru"), base, "Cyrillic is already kept");

  const arabic = offlineGlyphPaths("ar");
  assert.ok(arabic.includes("/api/glyphs/Noto%20Sans%20Regular/1536-1791.pbf"), "Arabic letters");
  assert.ok(
    arabic.includes("/api/glyphs/Noto%20Sans%20Regular/65024-65279.pbf"),
    "the joined forms the right-to-left plugin draws",
  );
  assert.ok(offlineGlyphPaths("he").includes("/api/glyphs/Noto%20Sans%20Italic/1280-1535.pbf"));
  assert.equal(new Set(offlineGlyphPaths("he")).size, offlineGlyphPaths("he").length, "no repeats");
});
