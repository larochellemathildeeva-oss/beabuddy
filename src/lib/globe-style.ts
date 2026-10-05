import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import {
  GLYPH_PROTOCOL_TEMPLATE,
  VTILE_PROTOCOL_TEMPLATE,
  VTILE_ZOOM_MAX,
} from "./vector-tiles.ts";
import { labelName } from "./journal-style.ts";

/**
 * The World globe on MapLibre's globe projection, in Béa's three moods.
 *
 * Same vector tiles as the day map (`bea-tile://`, OpenFreeMap first), drawn
 * for a whole planet rather than a street: sea, land, country borders, a few
 * place names, and a sky that makes the rim glow. Pure, so the test can hold
 * every layer to a source layer that exists.
 */
export type GlobeMood = "calm" | "colorful" | "dark";

export type GlobePalette = {
  sea: string;
  land: string;
  green: string;
  ice: string;
  border: string;
  ink: string;
  halo: string;
  /** Atmosphere: the haze on the globe, the glow at its rim, the space behind. */
  /** Visited countries and provinces. */
  shade: string;
  skyHaze: string;
  skyRim: string;
  space: string;
};

export const GLOBE_PALETTES: Record<GlobeMood, GlobePalette> = {
  calm: {
    sea: "#7fb4c8",
    land: "#efe6d4",
    green: "#cfd9b4",
    ice: "#fbf8f2",
    border: "#b9ab94",
    ink: "#4a3f35",
    halo: "#f8f5f1",
    shade: "#f24a70",
    skyHaze: "#cfe4ee",
    skyRim: "#fbe9d6",
    space: "#fbf2e6",
  },
  colorful: {
    sea: "#4fb8d6",
    land: "#f6e3b4",
    green: "#a9d98e",
    ice: "#ffffff",
    border: "#d79a6a",
    ink: "#4a3248",
    halo: "#fff8ef",
    shade: "#e8559a",
    skyHaze: "#b9e3f2",
    skyRim: "#f7c3b4",
    space: "#e7defa",
  },
  dark: {
    sea: "#16243a",
    land: "#2b2f3b",
    green: "#2f3a3a",
    ice: "#3a3f4d",
    border: "#566079",
    ink: "#e8e2d6",
    halo: "#14171f",
    shade: "#ffb454",
    skyHaze: "#2a4a7a",
    skyRim: "#5a7be0",
    space: "#0b0d14",
  },
};

/** OpenMapTiles' layers this style reads. */
export const GLOBE_LAYERS = ["water", "landcover", "boundary", "place"] as const;

const SOURCE = "omt";
const FONT = ["Noto Sans Regular"];

/** The sky settings `map.setSky` takes, from the mood's palette. */
export function globeSky(mood: GlobeMood) {
  const p = GLOBE_PALETTES[mood];
  return {
    "sky-color": p.space,
    "horizon-color": p.skyRim,
    "fog-color": p.skyHaze,
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.8,
    "fog-ground-blend": 0.9,
    "atmosphere-blend": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      1,
      5,
      1,
      7,
      0,
    ] as ExpressionSpecification,
  };
}

export function globeStyle(mood: GlobeMood, lang?: string): StyleSpecification {
  const p = GLOBE_PALETTES[mood];
  const NAME = labelName(lang);
  return {
    version: 8,
    projection: { type: "globe" },
    sky: globeSky(mood) as never,
    glyphs: GLYPH_PROTOCOL_TEMPLATE,
    sources: {
      [SOURCE]: {
        type: "vector",
        tiles: [VTILE_PROTOCOL_TEMPLATE],
        minzoom: 0,
        maxzoom: VTILE_ZOOM_MAX,
      },
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": p.land } },
      {
        id: "green",
        type: "fill",
        source: SOURCE,
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["grass", "wood", "farmland"]]],
        paint: { "fill-color": p.green, "fill-opacity": 0.7 },
      },
      {
        id: "ice",
        type: "fill",
        source: SOURCE,
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "ice"],
        paint: { "fill-color": p.ice },
      },
      {
        id: "water",
        type: "fill",
        source: SOURCE,
        "source-layer": "water",
        paint: { "fill-color": p.sea },
      },
      {
        id: "country-border",
        type: "line",
        source: SOURCE,
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        layout: { "line-join": "round" },
        paint: {
          "line-color": p.border,
          "line-opacity": 0.9,
          "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 6, 1.4],
        },
      },
      {
        id: "country-name",
        type: "symbol",
        source: SOURCE,
        "source-layer": "place",
        filter: ["==", ["get", "class"], "country"],
        maxzoom: 6,
        layout: {
          "text-field": NAME,
          "text-font": FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 5, 14],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
          "text-max-width": 7,
        },
        paint: { "text-color": p.ink, "text-halo-color": p.halo, "text-halo-width": 1.2 },
      },
      {
        id: "city-name",
        type: "symbol",
        source: SOURCE,
        "source-layer": "place",
        filter: ["==", ["get", "class"], "city"],
        minzoom: 4,
        layout: { "text-field": NAME, "text-font": FONT, "text-size": 12, "text-max-width": 7 },
        paint: { "text-color": p.ink, "text-halo-color": p.halo, "text-halo-width": 1.2 },
      },
    ],
  };
}
