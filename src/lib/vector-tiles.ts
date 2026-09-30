/**
 * The day map drawn from vector tiles, and the part of it kept offline.
 *
 * Vector tiles are the map's data rather than a picture of it: Béa styles
 * them in the browser, so the map stays sharp at any zoom, and a whole city
 * is a few hundred small tiles rather than thousands of images. They come
 * through Béa's own `/api/vtile` path, like the image tiles, and the path is
 * parsed rather than trusted. OpenFreeMap answers first: the same
 * OpenMapTiles schema as Geoapify's, free, keyless, with no limit on requests
 * and commercial use and offline copies allowed. Geoapify (whose terms also
 * allow storing its tiles) answers when OpenFreeMap does not, at a quarter
 * credit a tile, and its key stays on the server.
 *
 * Label fonts come the same way, through `/api/glyphs`. Pure, so the paths,
 * the upstream URLs and the offline plan are tested.
 */

/** OpenMapTiles stops at 14; the map draws closer by stretching those tiles. */
export const VTILE_ZOOM_MAX = 14;

/**
 * A day, in the browser and in any shared cache. Unlike an image tile, the
 * same path is answered from OpenFreeMap's weekly build, so a week-long
 * shared copy could draw last week's streets beside this week's.
 */
export const VECTOR_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";

/** The path template the map's style asks for, through Béa's own protocol. */
export const VTILE_PROTOCOL_TEMPLATE = "bea-tile://{z}/{x}/{y}";
export const GLYPH_PROTOCOL_TEMPLATE = "bea-glyph://{fontstack}/{range}";

/** The fonts the journal style sets labels in. Nothing else is fetched. */
export const VECTOR_FONTS = ["Noto Sans Regular", "Noto Sans Italic"] as const;

/**
 * Geoapify serves the OpenMapTiles data under any of its styles' names; this
 * is the one asked for. The fonts come from the same style.
 */
const GEOAPIFY_STYLE = "osm-bright";

export type TileCoords = { z: number; x: number; y: number };

/** Read `/api/vtile/14/8000/6000.pbf` into numbers, or refuse. */
export function parseVectorTilePath(pathname: string): TileCoords | null {
  const match = /^\/api\/vtile\/(\d{1,2})\/(\d{1,5})\/(\d{1,5})\.pbf$/.exec(pathname);
  if (!match) return null;
  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (z > VTILE_ZOOM_MAX) return null;
  const span = 2 ** z;
  if (x >= span || y >= span) return null;
  return { z, x, y };
}

export function vectorTilePath({ z, x, y }: TileCoords): string {
  return `/api/vtile/${z}/${x}/${y}.pbf`;
}

export function vectorTileSourceUrl({ z, x, y }: TileCoords, geoapifyKey: string): string {
  return `https://maps.geoapify.com/v1/tile/${GEOAPIFY_STYLE}/${z}/${x}/${y}.pbf?apiKey=${encodeURIComponent(geoapifyKey)}`;
}

/**
 * OpenFreeMap's TileJSON. Its tile URLs carry the week's build
 * ("planet/20260927_080001_pt/{z}/{x}/{y}.pbf"), so the current one is read
 * from here rather than written down.
 */
export const OPENFREEMAP_TILEJSON = "https://tiles.openfreemap.org/planet";
const OPENFREEMAP_ORIGIN = "https://tiles.openfreemap.org/";

/**
 * The tile URL template in OpenFreeMap's TileJSON, or null when the answer is
 * not one: only an https URL on OpenFreeMap's own host with all three
 * placeholders, so nothing else can be made to reach the server's fetch.
 */
export function readOpenFreeMapTemplate(tilejson: unknown): string | null {
  const tiles = (tilejson as { tiles?: unknown } | null)?.tiles;
  const first = Array.isArray(tiles) ? tiles[0] : undefined;
  if (typeof first !== "string" || !first.startsWith(OPENFREEMAP_ORIGIN)) return null;
  if (!["{z}", "{x}", "{y}"].every((p) => first.includes(p))) return null;
  return first;
}

export function openFreeMapTileUrl(template: string, { z, x, y }: TileCoords): string {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

export type GlyphRequest = { font: (typeof VECTOR_FONTS)[number]; start: number };

/**
 * Read `/api/glyphs/Noto%20Sans%20Regular/0-255.pbf`, or refuse.
 *
 * Only the fonts the style names, and only a real 256-character block, so
 * nothing else reaches the upstream URL.
 */
export function parseGlyphPath(pathname: string): GlyphRequest | null {
  const match = /^\/api\/glyphs\/([^/]{1,80})\/(\d{1,5})-(\d{1,5})\.pbf$/.exec(pathname);
  if (!match) return null;
  let font: string;
  try {
    font = decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
  const known = VECTOR_FONTS.find((f) => f === font);
  if (!known) return null;
  const start = Number(match[2]);
  const end = Number(match[3]);
  if (start % 256 !== 0 || end !== start + 255 || end > 65535) return null;
  return { font: known, start };
}

export function glyphPath({ font, start }: GlyphRequest): string {
  return `/api/glyphs/${encodeURIComponent(font)}/${start}-${start + 255}.pbf`;
}

export function glyphSourceUrl({ font, start }: GlyphRequest, geoapifyKey: string): string {
  return `https://maps.geoapify.com/v1/styles/${GEOAPIFY_STYLE}/fonts/${encodeURIComponent(font)}/${start}-${start + 255}.pbf?apiKey=${encodeURIComponent(geoapifyKey)}`;
}

/** OpenFreeMap serves the same Noto Sans fonts, block for block. */
export function openFreeMapGlyphUrl({ font, start }: GlyphRequest): string {
  return `${OPENFREEMAP_ORIGIN}fonts/${encodeURIComponent(font)}/${start}-${start + 255}.pbf`;
}

/**
 * The protocol URLs MapLibre asks for, as Béa paths. MapLibre fills the
 * templates above; anything that does not come back in that shape is refused
 * by the same parsers the server uses.
 */
export function protocolToPath(url: string): string | null {
  const tile = /^bea-tile:\/\/(\d+)\/(\d+)\/(\d+)$/.exec(url);
  if (tile) {
    const path = `/api/vtile/${tile[1]}/${tile[2]}/${tile[3]}.pbf`;
    return parseVectorTilePath(path) ? path : null;
  }
  const glyph = /^bea-glyph:\/\/([^/]+)\/(\d+-\d+)$/.exec(url);
  if (glyph) {
    // MapLibre joins a font stack with commas and encodes nothing itself.
    let font: string;
    try {
      font = decodeURIComponent(glyph[1]!).split(",")[0]!.trim();
    } catch {
      return null;
    }
    const path = `/api/glyphs/${encodeURIComponent(font)}/${glyph[2]}.pbf`;
    return parseGlyphPath(path) ? path : null;
  }
  return null;
}

/**
 * The character blocks kept offline for each font: Latin and its accents,
 * Greek, Cyrillic, and punctuation. Chinese, Japanese and Korean labels are
 * drawn from the phone's own fonts, so they need nothing saved.
 */
export const OFFLINE_GLYPH_STARTS = [0, 256, 768, 1024, 8192] as const;

const ARABIC = [1536, 64256, 64512, 64768, 65024];
/**
 * Labels ask for the traveller's language first, so a saved map keeps that
 * script's blocks too: without them its labels would vanish offline rather
 * than fall back to Latin. Arabic is also kept in the joined letter forms the
 * right-to-left plugin draws it with.
 */
export const LANGUAGE_GLYPH_STARTS: Readonly<Record<string, readonly number[]>> = {
  ar: ARABIC,
  fa: ARABIC,
  ur: ARABIC,
  ps: ARABIC,
  he: [1280, 64256],
  yi: [1280, 64256],
  hy: [1280, 64256],
  ka: [4096],
  hi: [2304],
  mr: [2304],
  ne: [2304],
  bn: [2304],
  th: [3584],
  lo: [3584],
};

/** `lang` as `labelLanguage` gives it; the day map's labels ask for it first. */
export function offlineGlyphPaths(lang?: string): string[] {
  const starts = [
    ...new Set([...OFFLINE_GLYPH_STARTS, ...(LANGUAGE_GLYPH_STARTS[lang ?? ""] ?? [])]),
  ];
  return VECTOR_FONTS.flatMap((font) => starts.map((start) => glyphPath({ font, start })));
}

// ---------------------------------------------------------------------------
// What to keep for a trip.

export type Box = { south: number; west: number; north: number; east: number };

/** The tile at a zoom that holds a point (Web Mercator, as every map uses). */
export function tileFor(lat: number, lon: number, z: number): { x: number; y: number } {
  const span = 2 ** z;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clampedLat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * span);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * span);
  return { x: Math.min(span - 1, Math.max(0, x)), y: Math.min(span - 1, Math.max(0, y)) };
}

/**
 * A box around some pins, with `padKm` of streets around the outermost.
 *
 * Stops either side of the date line (Fiji, Chukotka, the Aleutians) are a
 * few kilometres apart, not the width of the world: when the pins span more
 * than half the globe the western ones are counted past 180°, so `east` can
 * exceed 180 and `tilesInBox` wraps it round.
 */
export function boxAround(
  pins: readonly { lat: number; lon: number }[],
  padKm: number,
): Box | null {
  const real = pins.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && !(p.lat === 0 && p.lon === 0),
  );
  if (!real.length) return null;
  const lats = real.map((p) => p.lat);
  let lons = real.map((p) => p.lon);
  if (Math.max(...lons) - Math.min(...lons) > 180) {
    lons = lons.map((lon) => (lon < 0 ? lon + 360 : lon));
  }
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const padLat = padKm / 111;
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const padLon = padKm / (111 * Math.max(0.1, Math.cos(midLat)));
  return {
    south: Math.max(-85, south - padLat),
    north: Math.min(85, north + padLat),
    west: Math.min(...lons) - padLon,
    east: Math.max(...lons) + padLon,
  };
}

/**
 * Every tile at zoom `z` that touches the box. Columns past either edge of
 * the world wrap round to the other side, so a box across the date line
 * keeps both of its halves.
 */
export function tilesInBox(box: Box, z: number): TileCoords[] {
  const span = 2 ** z;
  const top = tileFor(box.north, 0, z).y;
  const bottom = tileFor(box.south, 0, z).y;
  let first = Math.floor(((box.west + 180) / 360) * span);
  // The column the east edge falls in; an edge exactly on a boundary is the
  // tile to its left, not the next one.
  let last = Math.ceil(((box.east + 180) / 360) * span) - 1;
  if (last < first) last = first;
  if (last - first + 1 >= span) {
    first = 0;
    last = span - 1;
  }
  const out: TileCoords[] = [];
  for (let col = first; col <= last; col++) {
    const x = ((col % span) + span) % span;
    for (let y = top; y <= bottom; y++) out.push({ z, x, y });
  }
  return out;
}

/** Streets around each day's stops: enough to find the way between them. */
export const OFFLINE_PAD_KM = 2;
/**
 * The lowest zoom kept, as low as the day map lets anyone zoom out. Below a
 * city's own zoom the area is a tile or two, so this costs almost nothing,
 * and zooming out with no signal still shows where the day is.
 */
export const OFFLINE_ZOOM_MIN = 1;
/**
 * At most this many tiles per trip. OpenFreeMap's cost nothing; each one
 * Geoapify serves instead costs a quarter credit, so this is 150 credits at
 * worst; an ordinary city trip needs well under half.
 */
export const OFFLINE_TILE_MAX = 600;

/**
 * The tiles to keep for a trip: each day's stops with streets around them,
 * at every zoom from a region down to street level, without repeats.
 *
 * Days in different cities keep their own areas rather than one box spanning
 * the country between them. When a trip would need more than the cap, the
 * closest zoom goes first — its tiles are the most numerous, and the next
 * zoom out still draws every street, only less sharply.
 */
export function offlineTilePlan(
  days: readonly (readonly { lat: number; lon: number }[])[],
  max = OFFLINE_TILE_MAX,
): TileCoords[] {
  const boxes = days.map((pins) => boxAround(pins, OFFLINE_PAD_KM)).filter((b): b is Box => !!b);
  if (!boxes.length) return [];
  for (let top = VTILE_ZOOM_MAX; top >= OFFLINE_ZOOM_MIN; top--) {
    const seen = new Map<string, TileCoords>();
    // The whole world at zoom 0, so the map has something at every zoom and
    // can tell, offline, that a map was kept at all.
    seen.set("0/0/0", { z: 0, x: 0, y: 0 });
    for (let z = OFFLINE_ZOOM_MIN; z <= top; z++) {
      for (const box of boxes) {
        for (const t of tilesInBox(box, z)) seen.set(`${t.z}/${t.x}/${t.y}`, t);
      }
    }
    if (seen.size <= max) return [...seen.values()];
  }
  return [];
}

/** "1.8 MB": how much room a saved map takes, for the line that says it was kept. */
export function prettyMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return "under 0.1 MB";
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
