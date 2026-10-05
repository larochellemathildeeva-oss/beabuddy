import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOBE_LAYERS, GLOBE_PALETTES, globeStyle, type GlobeMood } from "./globe-style.ts";

const moods: GlobeMood[] = ["calm", "colorful", "dark"];

test("the globe style reads only source layers it lists, in every mood", () => {
  for (const mood of moods) {
    const style = globeStyle(mood, "fr");
    for (const layer of style.layers) {
      const source = (layer as { "source-layer"?: string })["source-layer"];
      if (source)
        assert.ok((GLOBE_LAYERS as readonly string[]).includes(source), `${mood}: ${source}`);
    }
  }
});

test("the globe style asks for the globe projection and Béa's own tile addresses", () => {
  const style = globeStyle("calm");
  assert.equal((style.projection as { type: string }).type, "globe");
  const source = style.sources["omt"] as { tiles: string[] };
  assert.match(source.tiles[0] ?? "", /^bea-tile:/);
  assert.match(style.glyphs ?? "", /^bea-glyph:/);
});

test("every mood has a full palette", () => {
  for (const mood of moods)
    for (const [key, value] of Object.entries(GLOBE_PALETTES[mood]))
      assert.match(value, /^#[0-9a-f]{6}$/i, `${mood}.${key}`);
});
