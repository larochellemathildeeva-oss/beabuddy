import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import {
  GLYPH_PROTOCOL_TEMPLATE,
  VTILE_PROTOCOL_TEMPLATE,
  VTILE_ZOOM_MAX,
} from "./vector-tiles.ts";

/**
 * The day map's own style, in the journal palette.
 *
 * The same colours `.journal-map` sets in styles.css — paper, stone roads,
 * pale water and park — drawn from the data rather than tinted onto a
 * picture with a CSS filter. Like the image map it stays light in dark mode:
 * a printed map on the table. Roads nearly disappear; water, parks and place
 * names carry it, so the day's pins are what the eye finds first.
 *
 * Layers read OpenMapTiles' schema, which is what Geoapify serves. Pure, so
 * the test can hold every layer to a source layer that exists.
 */

export const JOURNAL = {
  paper: "#f8f5f1",
  building: "#efe9e1",
  road: "#d9d2c7",
  roadMajor: "#cfc6b8",
  rail: "#d3cbbf",
  water: "#dcebf2",
  waterInk: "#7d9aa8",
  park: "#dce6d3",
  ink: "#443d36",
  inkSoft: "#8a8076",
  halo: "#f8f5f1",
} as const;

/** OpenMapTiles' layers this style reads; the test checks it reads no others. */
export const OMT_LAYERS = [
  "water",
  "waterway",
  "landcover",
  "landuse",
  "park",
  "building",
  "transportation",
  "transportation_name",
  "water_name",
  "place",
] as const;

const SOURCE = "omt";
const FONT = ["Noto Sans Regular"];
const FONT_ITALIC = ["Noto Sans Italic"];
/**
 * The language a label is asked for in: the first part of a browser locale
 * ("fr-CA" → "fr"), or none when it is not a plain language code.
 * OpenMapTiles keys its translated names `name:fr`, `name:ja` and so on.
 */
export function labelLanguage(locale: string | null | undefined): string | undefined {
  const lang = locale?.trim().split(/[-_]/)[0]?.toLowerCase();
  return lang && /^[a-z]{2,3}$/.test(lang) ? lang : undefined;
}

/**
 * The traveller's own language where the data has it; otherwise Latin, so
 * the map can still be read; otherwise the local name.
 */
export function labelName(lang?: string): ExpressionSpecification {
  const names: ExpressionSpecification[] = [
    ["get", "name:latin"],
    ["get", "name"],
  ];
  if (lang) names.unshift(["get", `name:${lang}`]);
  return ["coalesce", ...names];
}

const minorRoads = ["minor", "service", "track"];
const majorRoads = ["motorway", "trunk", "primary", "secondary", "tertiary"];

/** `lang` from `labelLanguage`; without one, labels read as before. */
export function journalStyle(lang?: string): StyleSpecification {
  const NAME = labelName(lang);
  const layers: LayerSpecification[] = [
    { id: "paper", type: "background", paint: { "background-color": JOURNAL.paper } },
    {
      id: "park",
      type: "fill",
      source: SOURCE,
      "source-layer": "park",
      paint: { "fill-color": JOURNAL.park, "fill-opacity": 0.8 },
    },
    {
      id: "green",
      type: "fill",
      source: SOURCE,
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "wood", "farmland"]]],
      paint: { "fill-color": JOURNAL.park, "fill-opacity": 0.55 },
    },
    {
      id: "green-landuse",
      type: "fill",
      source: SOURCE,
      "source-layer": "landuse",
      filter: ["in", ["get", "class"], ["literal", ["cemetery", "pitch", "stadium", "grass"]]],
      paint: { "fill-color": JOURNAL.park, "fill-opacity": 0.55 },
    },
    {
      id: "water",
      type: "fill",
      source: SOURCE,
      "source-layer": "water",
      paint: { "fill-color": JOURNAL.water },
    },
    {
      id: "waterway",
      type: "line",
      source: SOURCE,
      "source-layer": "waterway",
      paint: {
        "line-color": JOURNAL.water,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 16, 3],
      },
    },
    {
      id: "building",
      type: "fill",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 14,
      paint: { "fill-color": JOURNAL.building, "fill-opacity": 0.9 },
    },
    {
      id: "path",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["==", ["get", "class"], "path"],
      paint: {
        "line-color": JOURNAL.road,
        "line-width": 1,
        "line-dasharray": [2, 2],
      },
    },
    {
      id: "road-minor",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["in", ["get", "class"], ["literal", minorRoads]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": JOURNAL.road,
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0.5, 18, 9],
      },
    },
    {
      id: "road-major",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", majorRoads]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": JOURNAL.roadMajor,
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 8, 0.5, 18, 14],
      },
    },
    {
      id: "rail",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 11,
      filter: ["in", ["get", "class"], ["literal", ["rail", "transit"]]],
      paint: { "line-color": JOURNAL.rail, "line-width": 1, "line-dasharray": [3, 3] },
    },
    {
      id: "water-name",
      type: "symbol",
      source: SOURCE,
      "source-layer": "water_name",
      layout: {
        "text-field": NAME,
        "text-font": FONT_ITALIC,
        "text-size": 12,
        "symbol-placement": "point",
      },
      paint: {
        "text-color": JOURNAL.waterInk,
        "text-halo-color": JOURNAL.halo,
        "text-halo-width": 1,
      },
    },
    {
      id: "road-name",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 14,
      layout: {
        "text-field": NAME,
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 18, 13],
        "symbol-placement": "line",
        "text-max-angle": 30,
      },
      paint: {
        "text-color": JOURNAL.inkSoft,
        "text-halo-color": JOURNAL.halo,
        "text-halo-width": 1.2,
      },
    },
    {
      id: "place-small",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 12,
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["suburb", "neighbourhood", "quarter", "village", "hamlet"]],
      ],
      layout: {
        "text-field": NAME,
        "text-font": FONT,
        "text-size": 11,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.08,
        "text-max-width": 8,
      },
      paint: {
        "text-color": JOURNAL.inkSoft,
        "text-halo-color": JOURNAL.halo,
        "text-halo-width": 1.2,
      },
    },
    {
      id: "place-town",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: {
        "text-field": NAME,
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 12, 12, 17],
        "text-max-width": 8,
      },
      paint: { "text-color": JOURNAL.ink, "text-halo-color": JOURNAL.halo, "text-halo-width": 1.5 },
    },
  ];

  return {
    version: 8,
    // Through Béa's protocol: the phone's saved copy first, then Béa's server.
    glyphs: GLYPH_PROTOCOL_TEMPLATE,
    sources: {
      [SOURCE]: {
        type: "vector",
        tiles: [VTILE_PROTOCOL_TEMPLATE],
        minzoom: 0,
        maxzoom: VTILE_ZOOM_MAX,
        // Shown by the day map's own credit line, beside the other map credits.
        attribution: "",
      },
    },
    layers,
  };
}
