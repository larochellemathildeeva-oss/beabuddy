/**
 * The day map's tiles on the phone: read first from what was saved, then
 * from Béa's server, and saved per trip for a day with no signal.
 *
 * Kept in the browser's Cache Storage, one cache per trip, so deleting a
 * trip's map is one call and cannot take another trip's with it. Nothing
 * here needs a service worker: MapLibre asks for every tile and font through
 * Béa's own protocol, and the protocol looks in the cache before the network.
 *
 * Browser-only; everything that can be pure lives in `vector-tiles.ts`.
 */
import type * as MapLibre from "maplibre-gl";
import {
  offlineGlyphPaths,
  offlineTilePlan,
  protocolToPath,
  vectorTilePath,
} from "./vector-tiles.ts";

export const OFFLINE_MAP_CACHE_PREFIX = "bea-map-";
export const OFFLINE_MAP_KEY_PREFIX = "bea.offlinemap.";

export type SavedMap = { savedAt: string; tiles: number; bytes: number };

const hasCaches = () => typeof caches !== "undefined";

async function cached(path: string): Promise<Response | undefined> {
  if (!hasCaches()) return undefined;
  try {
    return await caches.match(path);
  } catch {
    return undefined;
  }
}

let registered = false;

/**
 * Teach MapLibre Béa's `bea-tile://` and `bea-glyph://` addresses. A tile it
 * cannot get is drawn empty rather than raising an error per square: offline,
 * past the saved area, that is simply what there is.
 */
export function registerBeaProtocols(mod: typeof MapLibre | { default: typeof MapLibre }): void {
  if (registered) return;
  // maplibre-gl is a CommonJS bundle: a dynamic import may wrap it in `default`.
  const maplibregl = "default" in mod && mod.default ? mod.default : (mod as typeof MapLibre);
  const load = async (
    params: { url: string },
    abort: AbortController,
  ): Promise<{ data: ArrayBuffer }> => {
    const path = protocolToPath(params.url);
    if (!path) return { data: new ArrayBuffer(0) };
    const hit = await cached(path);
    if (hit) return { data: await hit.arrayBuffer() };
    try {
      const res = await fetch(path, { signal: abort.signal });
      return { data: res.ok ? await res.arrayBuffer() : new ArrayBuffer(0) };
    } catch {
      return { data: new ArrayBuffer(0) };
    }
  };
  maplibregl.addProtocol("bea-tile", load);
  maplibregl.addProtocol("bea-glyph", load);
  registered = true;
}

function webglWorks(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

let available: Promise<boolean> | null = null;

/**
 * Whether the day map can be drawn from vector tiles here: the phone can draw
 * them, and either a map was saved on it or Béa's server hands one out (it
 * does only with a Geoapify key). Asked once per page load; the world tile it
 * asks for is cached by the browser for a day.
 */
export function vectorMapAvailable(): Promise<boolean> {
  if (!available) {
    available = (async () => {
      if (typeof window === "undefined" || !webglWorks()) return false;
      // A tile and a block of the label font: a vector map without its
      // labels would be worse than the image map, so both must answer.
      const probes = [vectorTilePath({ z: 0, x: 0, y: 0 }), offlineGlyphPaths()[0]!];
      const answers = await Promise.all(
        probes.map(async (path) => {
          if (await cached(path)) return true;
          try {
            const res = await fetch(path, { signal: AbortSignal.timeout(6_000) });
            return res.ok && (await res.arrayBuffer()).byteLength > 0;
          } catch {
            return false;
          }
        }),
      );
      return answers.every(Boolean);
    })();
  }
  return available;
}

export function readSavedMap(tripId: string): SavedMap | null {
  try {
    const raw = localStorage.getItem(`${OFFLINE_MAP_KEY_PREFIX}${tripId}`);
    return raw ? (JSON.parse(raw) as SavedMap) : null;
  } catch {
    return null;
  }
}

/** Three at a time: Béa's server asks Geoapify at five a second at most. */
const SAVE_CONCURRENCY = 3;

/**
 * Save the map around each day's stops for this trip.
 *
 * Tiles another trip already saved are copied across rather than fetched
 * again. Resolves with what was kept; throws only when nearly nothing could
 * be, so a few missing squares at the edge do not undo the rest.
 */
export async function saveOfflineMap(
  tripId: string,
  days: readonly (readonly { lat: number; lon: number }[])[],
  onProgress?: (done: number, total: number) => void,
): Promise<SavedMap | null> {
  if (!hasCaches()) throw new Error("This browser can't keep a map offline.");
  const tiles = offlineTilePlan(days);
  if (!tiles.length) return null;
  const paths = [...tiles.map(vectorTilePath), ...offlineGlyphPaths()];
  const name = `${OFFLINE_MAP_CACHE_PREFIX}${tripId}`;
  // A fresh copy each time, so a changed trip does not keep yesterday's area.
  await caches.delete(name);
  const cache = await caches.open(name);

  let done = 0;
  let kept = 0;
  let bytes = 0;
  const queue = [...paths];
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        const res = (await cached(path))?.clone() ?? (await fetch(path));
        if (res.ok) {
          const body = await res.arrayBuffer();
          await cache.put(
            path,
            new Response(body, { headers: { "content-type": "application/x-protobuf" } }),
          );
          kept++;
          bytes += body.byteLength;
        }
      } catch {
        /* one missing square; the rest still count */
      }
      done++;
      onProgress?.(done, paths.length);
    }
  };
  await Promise.all(Array.from({ length: SAVE_CONCURRENCY }, worker));

  if (kept < paths.length * 0.8) {
    await caches.delete(name);
    throw new Error("Couldn't save the map. Check your connection and try again.");
  }
  // Ask the browser not to clear it when space runs low. Safari may still
  // clear a site it has not seen for a while; the saved date says when.
  void navigator.storage?.persist?.().catch(() => false);
  const saved: SavedMap = { savedAt: new Date().toISOString(), tiles: kept, bytes };
  try {
    localStorage.setItem(`${OFFLINE_MAP_KEY_PREFIX}${tripId}`, JSON.stringify(saved));
  } catch {
    /* private mode: the tiles are kept, only the note of them is not */
  }
  return saved;
}

/**
 * Whether the saved copy is still on the phone. The browser may clear it
 * under pressure without telling anyone, so the note alone is not proof.
 */
export async function savedMapStillThere(tripId: string): Promise<boolean> {
  if (!hasCaches()) return false;
  try {
    if (!(await caches.has(`${OFFLINE_MAP_CACHE_PREFIX}${tripId}`))) return false;
    const cache = await caches.open(`${OFFLINE_MAP_CACHE_PREFIX}${tripId}`);
    return Boolean(await cache.match(vectorTilePath({ z: 0, x: 0, y: 0 })));
  } catch {
    return false;
  }
}

export async function clearOfflineMap(tripId: string): Promise<void> {
  try {
    localStorage.removeItem(`${OFFLINE_MAP_KEY_PREFIX}${tripId}`);
  } catch {
    /* private mode */
  }
  if (hasCaches()) await caches.delete(`${OFFLINE_MAP_CACHE_PREFIX}${tripId}`).catch(() => false);
}

/** Every trip's saved map, for signing out or erasing the account. */
export async function clearAllOfflineMaps(): Promise<void> {
  if (!hasCaches()) return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith(OFFLINE_MAP_CACHE_PREFIX)).map((n) => caches.delete(n)),
    );
  } catch {
    /* nothing to clear */
  }
}
