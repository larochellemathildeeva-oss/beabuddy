/**
 * Owner-approved terrain art for the aerial trip banners (Home and Trips):
 * one picture per destination, with the route and stops drawn over it in
 * code. Nothing ships here by default: a destination without art falls back
 * to the app's own pictures (the Natural Earth relief tiles the maps already
 * use, then the destination's `banner-art.ts` scene), so no generated
 * landscape reaches the app without the owner choosing it.
 *
 * To add art: put the file under `public/terrain/` and add an entry below,
 * keyed by `terrainKey()` of the trip's title, a city, or the country (the
 * first that matches wins, in that order). With `bounds` (and the picture's
 * size) the picture is read as a Web Mercator map of that box and every stop
 * is drawn exactly where it is; without them the route is fitted over the
 * picture as a drawing.
 */

/** West, south, east, north, in degrees. */
export type TerrainBounds = readonly [number, number, number, number];

export type TerrainArt = {
  /** Under `public/`, e.g. "/terrain/alps.webp". */
  src: string;
  /** Optional night version for the Dark theme. */
  darkSrc?: string;
  /** The picture's corners, when it is a Web Mercator map of that box. */
  bounds?: TerrainBounds;
  /** The picture's size in pixels; needed with `bounds`. */
  width?: number;
  height?: number;
  /** Shown small in the corner of the banner. */
  credit?: string;
};

export type TerrainRegistry = Readonly<Record<string, TerrainArt>>;

/**
 * The owner's terrain art. Empty until the owner approves pictures:
 * e.g. `"lake-como": { src: "/terrain/lake-como.webp", bounds: [...], width: 1200, height: 900 }`.
 */
export const TERRAIN_ART: TerrainRegistry = {};

/** "Lake Como, Italy" → "lake-como"; "Zürich" → "zurich". */
export function terrainKey(name: string | null | undefined): string {
  const first = (name ?? "").split(",")[0] ?? "";
  return first
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Whether every stop lies inside the art's box (always, for art without one). */
export function artCovers(
  art: TerrainArt,
  stops: readonly { lat: number; lon: number }[],
): boolean {
  if (!art.bounds) return true;
  if (!art.width || !art.height) return false;
  const [w, s, e, n] = art.bounds;
  return stops.every(
    (p) =>
      p.lat >= s && p.lat <= n && (w <= e ? p.lon >= w && p.lon <= e : p.lon >= w || p.lon <= e),
  );
}

/**
 * The art for a destination: the first of `places` (trip title, then cities,
 * then country) with an entry, as long as the art's map holds every stop.
 */
export function terrainFor(
  places: readonly (string | null | undefined)[],
  stops: readonly { lat: number; lon: number }[] = [],
  registry: TerrainRegistry = TERRAIN_ART,
): { key: string; art: TerrainArt } | null {
  for (const place of places) {
    const key = terrainKey(place);
    const art = key ? registry[key] : undefined;
    if (art && artCovers(art, stops)) return { key, art };
  }
  return null;
}

/** The picture for the theme: the night version in Dark, when there is one. */
export function terrainSrc(art: TerrainArt, dark: boolean): string {
  return dark && art.darkSrc ? art.darkSrc : art.src;
}
