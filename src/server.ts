import "./lib/error-capture";

import { gunzipSync } from "node:zlib";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { geoFetch, geoapifyKey } from "./lib/geo-provider.server";
import { openFreeMapAsset, openFreeMapOn, openFreeMapUnreadable } from "./lib/open-free-map.server";
import { TILE_CACHE_CONTROL, parseTilePath, tileSourceUrl } from "./lib/tile-proxy";
import {
  glyphSourceUrl,
  parseGlyphPath,
  parseVectorTilePath,
  VECTOR_CACHE_CONTROL,
  vectorTileSourceUrl,
} from "./lib/vector-tiles";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Map tiles, fetched by Béa rather than by the browser.
 *
 * The one thing that could not move to LocationIQ with everything else: a
 * tile URL is visible to anyone who opens the network tab, and the free tier
 * grants a single token — the same one the server geocodes with. Proxying is
 * what lets the map use it without publishing it.
 *
 * Handled here rather than as a route because this file is already the
 * server's front door, and a tile should not pay for the router on its way
 * past. Unparseable paths fall through to the app, which 404s them properly.
 */
async function serveTile(request: Request): Promise<Response | null> {
  const coords = parseTilePath(new URL(request.url).pathname);
  if (!coords) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const token = (process.env["LOCATIONIQ_TOKEN"] ?? "").trim();
  try {
    // Geoapify's key only while it is not resting for the day (geo-credits.ts).
    const upstream = await geoFetch(tileSourceUrl(coords, token, geoapifyKey()), {
      headers: { "User-Agent": "BeaBot/1.0 (travel app)", Accept: "image/png,image/*" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok || !upstream.body) {
      // A missing tile is a blank square on a small map, not an error page.
      return new Response(null, { status: 204 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/png",
        "cache-control": TILE_CACHE_CONTROL,
      },
    });
  } catch {
    return new Response(null, { status: 204 });
  }
}

/**
 * The day map's vector tiles and label fonts, fetched by Béa like the image
 * tiles above.
 *
 * OpenFreeMap first (open-free-map.server.ts): free, keyless, and the same
 * schema and fonts. Geoapify when it does not answer, with the key kept on
 * the server. With neither — OpenFreeMap switched off and no Geoapify key, or
 * Geoapify resting for the day — a 404, which is how the day map knows to
 * draw the image tiles instead. An upstream failure is a 502, never a blank
 * 200, so the map falls back rather than drawing an empty page.
 */
async function serveVectorAsset(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const tile = parseVectorTilePath(pathname);
  const glyph = tile ? null : parseGlyphPath(pathname);
  if (!tile && !glyph) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const free = await openFreeMapAsset(tile ? { tile } : { glyph: glyph! });
  const fromFree = free && vectorResponse(free);
  if (fromFree) return fromFree;
  if (free) openFreeMapUnreadable();
  // Empty while Geoapify rests for the day (geo-credits.ts).
  const key = geoapifyKey();
  if (!key) return new Response(null, { status: openFreeMapOn() ? 502 : 404 });
  try {
    const upstream = await geoFetch(
      tile ? vectorTileSourceUrl(tile, key) : glyphSourceUrl(glyph!, key),
      {
        headers: { "User-Agent": "BeaBot/1.0 (travel app)", Accept: "application/x-protobuf,*/*" },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!upstream.ok) return new Response(null, { status: 502 });
    const body = new Uint8Array(await upstream.arrayBuffer());
    if (body.byteLength === 0 && !tile) return new Response(null, { status: 502 });
    return vectorResponse(body) ?? new Response(null, { status: 502 });
  } catch {
    return new Response(null, { status: 502 });
  }
}

/** The asset as the map reads it, or null when it cannot be read. */
function vectorResponse(bytes: Uint8Array<ArrayBuffer>): Response | null {
  let body = bytes;
  // Vector tiles are often stored gzipped and sometimes sent that way with
  // no Content-Encoding, which neither fetch nor MapLibre would undo. A
  // broken one is a failed answer, for the next provider to try.
  if (body[0] === 0x1f && body[1] === 0x8b) {
    try {
      body = new Uint8Array(gunzipSync(body));
    } catch {
      return null;
    }
  }
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/x-protobuf",
      "cache-control": VECTOR_CACHE_CONTROL,
    },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const tile = (await serveTile(request)) ?? (await serveVectorAsset(request));
      if (tile) return tile;
    } catch (error) {
      // Never let the map take the whole app down with it.
      console.error(error);
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
