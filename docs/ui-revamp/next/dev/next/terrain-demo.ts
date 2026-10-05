/**
 * Preview-only (?terrain=demo): fills the terrain slot with pictures made by
 * make_terrain.py from NASA's public-domain Blue Marble shaded relief, to show
 * the slot working (keyed by a trip title and by countries). Not in src/: the
 * app's TERRAIN_ART stays empty until the owner approves art.
 */
import type { TerrainArt } from "@/lib/terrain-art";

const credit = "NASA Blue Marble (public domain)";
export const TERRAIN_DEMO: Record<string, TerrainArt> = {
  "alps-road-trip": {
    src: "./terrain/alps.webp",
    bounds: [5.625, 43.06889, 16.875, 50.73646],
    width: 2048,
    height: 2048,
    credit,
  },
  italy: {
    src: "./terrain/coastal-italy.webp",
    bounds: [5.625, 38.82259, 18.28125, 47.04018],
    width: 2304,
    height: 2048,
    credit,
  },
  japan: {
    src: "./terrain/japan-explorer.webp",
    bounds: [132.1875, 31.95216, 143.4375, 38.82259],
    width: 2048,
    height: 1536,
    credit,
  },
};
