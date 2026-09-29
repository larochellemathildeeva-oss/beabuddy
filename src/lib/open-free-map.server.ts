/**
 * OpenFreeMap, asked by Béa's server for the day map's vector tiles and label
 * fonts before Geoapify is.
 *
 * Same OpenMapTiles schema and the same Noto Sans fonts, so the journal style
 * draws either unchanged; free, keyless, no limit on requests, commercial use
 * and offline copies allowed. It promises no uptime, so anything it does not
 * answer goes to Geoapify as before, and after a failure it rests a few
 * minutes rather than make every tile wait for a timeout.
 *
 * `OPENFREEMAP=off` leaves the map on Geoapify alone.
 */
import {
  OPENFREEMAP_TILEJSON,
  openFreeMapGlyphUrl,
  openFreeMapTileUrl,
  readOpenFreeMapTemplate,
  type GlyphRequest,
  type TileCoords,
} from "./vector-tiles";

/** A new build comes out each week; old ones stay served for a while. */
const TEMPLATE_TTL_MS = 12 * 60 * 60 * 1000;
const REST_MS = 5 * 60 * 1000;
const HEADERS = { "User-Agent": "BeaBot/1.0 (travel app)", Accept: "application/x-protobuf,*/*" };

let template: string | null = null;
let templateCheckAt = 0;
/** One read at a time: a fresh map asks for a dozen tiles at once. */
let templateRead: Promise<string | null> | null = null;
let restUntil = 0;

export function openFreeMapOn(): boolean {
  return (process.env["OPENFREEMAP"] ?? "").trim().toLowerCase() !== "off";
}

function rest(): void {
  restUntil = Date.now() + REST_MS;
}

/** The week's tile URL template, re-read twice a day; last known one if the read fails. */
function tileTemplate(): Promise<string | null> {
  if (Date.now() < templateCheckAt) return Promise.resolve(template);
  templateRead ??= readTemplate().finally(() => {
    templateRead = null;
  });
  return templateRead;
}

async function readTemplate(): Promise<string | null> {
  const now = Date.now();
  // Whatever happens, not again for a while: a failed read keeps the old build.
  templateCheckAt = now + (template ? REST_MS : 0);
  try {
    const res = await fetch(OPENFREEMAP_TILEJSON, {
      headers: { ...HEADERS, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    const read = res.ok ? readOpenFreeMapTemplate(await res.json()) : null;
    if (read) {
      template = read;
      templateCheckAt = now + TEMPLATE_TTL_MS;
    }
  } catch {
    // Kept below: the last template, or none.
  }
  return template;
}

/**
 * A tile or a block of a font from OpenFreeMap, or null for Geoapify to
 * answer instead. Tiles may be empty (open sea); fonts may not.
 */
export async function openFreeMapAsset(
  asset: { tile: TileCoords } | { glyph: GlyphRequest },
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!openFreeMapOn() || Date.now() < restUntil) return null;
  try {
    let url: string;
    if ("tile" in asset) {
      const t = await tileTemplate();
      if (!t) {
        rest();
        return null;
      }
      url = openFreeMapTileUrl(t, asset.tile);
    } else {
      url = openFreeMapGlyphUrl(asset.glyph);
    }
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6_000) });
    if (!res.ok) {
      // A missing tile or font is that one asset; a server in trouble is all of them.
      if (res.status >= 500 || res.status === 429) rest();
      return null;
    }
    const body = new Uint8Array(await res.arrayBuffer());
    if (body.byteLength === 0 && !("tile" in asset)) return null;
    return body;
  } catch {
    rest();
    return null;
  }
}
