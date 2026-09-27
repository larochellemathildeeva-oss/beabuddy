/**
 * Does Geoapify answer the day map the way Béa expects?
 *
 * The vector day map was written against Geoapify's documented URLs and
 * OpenMapTiles' schema, from a sandbox that could not reach Geoapify. This
 * asks for one street-level tile of Lisbon and one block of each label font,
 * with the real key, and says what came back: that the tile decodes, which
 * of its layers the journal style reads, and whether the fonts exist.
 *
 *   GEOAPIFY_API_KEY=… npm run map:check
 *
 * Costs a quarter of a credit. Nothing is stored. If it fails, the day map is
 * still safe — it falls back to the image tiles — but it will never draw the
 * vector map, and "Keep offline" will save only the day pictures.
 */
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { OMT_LAYERS } from "../src/lib/journal-style.ts";
import {
  VECTOR_FONTS,
  glyphSourceUrl,
  tileFor,
  vectorTileSourceUrl,
} from "../src/lib/vector-tiles.ts";

const key = (process.env["GEOAPIFY_API_KEY"] ?? "").trim();
if (!key) {
  console.error("Set GEOAPIFY_API_KEY first: GEOAPIFY_API_KEY=… npm run map:check");
  process.exit(2);
}

let ok = true;
const hide = (url: string) => url.replace(encodeURIComponent(key), "…");

// Praça do Comércio, Lisbon, at the data's closest zoom.
const { x, y } = tileFor(38.7075, -9.1364, 14);
const tileUrl = vectorTileSourceUrl({ z: 14, x, y }, key);
const tileRes = await fetch(tileUrl);
const tileBody = new Uint8Array(await tileRes.arrayBuffer());
console.log(
  `tile  ${tileRes.status} ${tileRes.headers.get("content-type")} ${tileBody.byteLength} bytes  ${hide(tileUrl)}`,
);
if (!tileRes.ok || tileBody.byteLength === 0) {
  ok = false;
} else if (tileBody[0] === 0x1f && tileBody[1] === 0x8b) {
  // Gzip without a Content-Encoding header: fetch will not undo it, and
  // neither will MapLibre, so the proxy would have to.
  console.log("  ✗ the tile is still gzipped; the proxy would need to unzip it");
  ok = false;
} else {
  try {
    const layers = Object.keys(new VectorTile(new Pbf(tileBody)).layers);
    const read = OMT_LAYERS.filter((l) => layers.includes(l));
    const missing = OMT_LAYERS.filter((l) => !layers.includes(l));
    console.log(`  layers in the tile: ${layers.join(", ")}`);
    console.log(`  ✓ the style reads ${read.length} of ${OMT_LAYERS.length}: ${read.join(", ")}`);
    if (missing.length)
      console.log(`  (not in this tile, which can be normal: ${missing.join(", ")})`);
    if (!layers.includes("transportation") || !layers.includes("water")) {
      console.log("  ✗ no roads or water: this is not OpenMapTiles' schema");
      ok = false;
    }
  } catch (error) {
    console.log(`  ✗ the tile does not decode: ${String(error)}`);
    ok = false;
  }
}

for (const font of VECTOR_FONTS) {
  const url = glyphSourceUrl({ font, start: 0 }, key);
  const res = await fetch(url);
  const bytes = (await res.arrayBuffer()).byteLength;
  console.log(`font  ${res.status} ${bytes} bytes  ${hide(url)}`);
  if (!res.ok || bytes === 0) {
    console.log(`  ✗ no "${font}": the map draws, but its labels will be missing`);
    ok = false;
  }
}

console.log(
  ok
    ? "\nAll good: the day map can be drawn from vector tiles."
    : "\nSomething above needs fixing in src/lib/vector-tiles.ts.",
);
process.exit(ok ? 0 : 1);
