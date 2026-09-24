import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseTilePath, tilePath, tileSourceUrl, TILE_URL_TEMPLATE } from "./tile-proxy.ts";

test("a real tile path parses", () => {
  assert.deepEqual(parseTilePath("/api/tile/14/4695/6053.png"), { z: 14, x: 4695, y: 6053 });
  assert.deepEqual(parseTilePath("/api/tile/1/0/0.png"), { z: 1, x: 0, y: 0 });
});

test("tilePath and parseTilePath agree", () => {
  const coords = { z: 12, x: 1183, y: 1512 };
  assert.deepEqual(parseTilePath(tilePath(coords)), coords);
});

test("the Leaflet template asks for paths the proxy accepts", () => {
  const filled = TILE_URL_TEMPLATE.replace("{z}", "15")
    .replace("{x}", "16372")
    .replace("{y}", "10895");
  assert.deepEqual(parseTilePath(filled), { z: 15, x: 16372, y: 10895 });
});

test("coordinates outside the world at that zoom are refused", () => {
  // At zoom 1 the world is 2 tiles across, so 2 is off the edge.
  assert.equal(parseTilePath("/api/tile/1/2/0.png"), null);
  assert.equal(parseTilePath("/api/tile/1/0/2.png"), null);
  assert.equal(parseTilePath("/api/tile/0/0/0.png"), null, "zoom below the range");
  assert.equal(parseTilePath("/api/tile/20/1/1.png"), null, "zoom above the range");
});

test("anything that is not three plain integers is refused", () => {
  // A proxy that fetches what it is told is a thing people aim at other things.
  for (const nasty of [
    "/api/tile/14/4695/../../etc/passwd.png",
    "/api/tile/14/4695/6053.png?key=stolen",
    "/api/tile/14/4695/https://example.com/x.png",
    "/api/tile/14/-1/6053.png",
    "/api/tile/14/4695.5/6053.png",
    "/api/tile/14/4695/6053.jpg",
    "/api/tile/14/4695.png",
    "/api/tile//4695/6053.png",
    "/api/tiles/14/4695/6053.png",
    "/api/tile/14/4695/6053.png/extra",
  ]) {
    assert.equal(parseTilePath(nasty), null, `should refuse ${nasty}`);
  }
});

test("the source is LocationIQ with a token and OpenStreetMap without", () => {
  const coords = { z: 14, x: 4695, y: 6053 };
  const free = tileSourceUrl(coords, "");
  assert.equal(free, "https://tile.openstreetmap.org/14/4695/6053.png");
  assert.ok(!free.includes("key="));

  const paid = tileSourceUrl(coords, "pk.abc123");
  assert.ok(paid.startsWith("https://tiles.locationiq.com/v3/streets/r/14/4695/6053.png"));
  assert.ok(paid.includes("key=pk.abc123"));
});

test("a token with URL-unsafe characters cannot break out of the query", () => {
  const url = tileSourceUrl({ z: 1, x: 0, y: 0 }, "a&b=c");
  assert.equal(new URL(url).searchParams.get("key"), "a&b=c");
});
