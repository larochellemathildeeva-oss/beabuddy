import { strict as assert } from "node:assert";
import { test } from "node:test";
import { JOURNAL, OMT_LAYERS, journalStyle } from "./journal-style.ts";
import { VECTOR_FONTS, protocolToPath } from "./vector-tiles.ts";

test("every layer reads a layer OpenMapTiles has, from the one source", () => {
  const style = journalStyle();
  assert.equal(style.version, 8);
  assert.deepEqual(Object.keys(style.sources), ["omt"]);
  const ids = new Set<string>();
  for (const layer of style.layers) {
    assert.ok(!ids.has(layer.id), `duplicate ${layer.id}`);
    ids.add(layer.id);
    if (layer.type === "background") continue;
    assert.equal(layer.source, "omt", layer.id);
    const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
    assert.ok(
      OMT_LAYERS.includes(sourceLayer as (typeof OMT_LAYERS)[number]),
      `${layer.id}: ${sourceLayer}`,
    );
  }
});

test("labels use only the fonts Béa serves, and tiles come through Béa", () => {
  const style = journalStyle();
  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    const fonts = (layer.layout as { "text-font"?: string[] })["text-font"] ?? [];
    for (const font of fonts) assert.ok((VECTOR_FONTS as readonly string[]).includes(font), font);
  }
  const source = style.sources["omt"] as { tiles: string[]; maxzoom: number };
  assert.equal(
    protocolToPath(source.tiles[0]!.replace("{z}/{x}/{y}", "14/1/1")),
    "/api/vtile/14/1/1.pbf",
  );
  assert.equal(source.maxzoom, 14);
  assert.ok(style.glyphs?.startsWith("bea-glyph://"));
});

test("the palette is the journal's, as styles.css sets it", () => {
  assert.equal(JOURNAL.paper, "#f8f5f1");
  assert.equal(JOURNAL.road, "#d9d2c7");
  assert.equal(JOURNAL.water, "#dcebf2");
  assert.equal(JOURNAL.park, "#dce6d3");
  assert.equal(JOURNAL.ink, "#443d36");
});
