/**
 * The day map's tiles on the phone: read first from what was saved, then
 * from Béa's server, and saved per trip for a day with no signal.
 *
 * Kept in the browser's Cache Storage, one cache per trip (a fresh one for
 * each save, swapped in when it succeeds), so deleting a trip's map cannot
 * take another trip's with it. Nothing
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

export type SavedMap = {
  savedAt: string;
  tiles: number;
  bytes: number;
  /** The cache holding this copy; each save writes a fresh one. */
  cache: string;
};

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

/** Béa's server answered with an error this many times: stop drawing vectors. */
const TROUBLE_AFTER = 3;
let troubles = 0;
const troubleListeners = new Set<() => void>();

/**
 * Be told when the vector map has stopped working on this page — tiles or
 * fonts the server refuses after the first check passed — so the day map can
 * put the image tiles back rather than leave squares or labels missing.
 */
export function onVectorTrouble(listener: () => void): () => void {
  troubleListeners.add(listener);
  return () => troubleListeners.delete(listener);
}

function reportTrouble(): void {
  troubles++;
  if (troubles !== TROUBLE_AFTER) return;
  // Later maps on this page go straight to the image tiles.
  available = Promise.resolve(false);
  for (const listener of [...troubleListeners]) listener();
}

/**
 * Teach MapLibre Béa's `bea-tile://` and `bea-glyph://` addresses: the saved
 * copy first, then Béa's server.
 *
 * Two kinds of failure, treated differently. No signal (the fetch itself
 * fails) is drawn empty and nothing more: past the saved area that is simply
 * what there is, and the image tiles would not load either. Béa's server
 * answering with an error is a map that has stopped working, so it is
 * reported, and the day map falls back to the image tiles.
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
    let res: Response;
    try {
      res = await fetch(path, { signal: abort.signal });
    } catch {
      return { data: new ArrayBuffer(0) };
    }
    if (!res.ok) {
      if (!abort.signal.aborted) reportTrouble();
      return { data: new ArrayBuffer(0) };
    }
    return { data: await res.arrayBuffer() };
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
 * Each save and each delete takes the next number for its trip. A save
 * writes only while its number is still the latest, so deleting the map (or
 * starting another save) stops one already under way from bringing it back.
 */
const generations = new Map<string, number>();
function nextGeneration(tripId: string): number {
  const next = (generations.get(tripId) ?? 0) + 1;
  generations.set(tripId, next);
  return next;
}
const isCurrent = (tripId: string, generation: number) => generations.get(tripId) === generation;

/** `bea-map-<trip>@<stamp>`: every copy of this trip's map, old or in progress. */
const tripCachePrefix = (tripId: string) => `${OFFLINE_MAP_CACHE_PREFIX}${tripId}@`;

async function tripCaches(tripId: string): Promise<string[]> {
  try {
    return (await caches.keys()).filter((n) => n.startsWith(tripCachePrefix(tripId)));
  } catch {
    return [];
  }
}

/**
 * Save the map around each day's stops for this trip.
 *
 * Downloaded into a fresh cache, which replaces the trip's old one only when
 * it succeeds: a save that fails part-way leaves yesterday's map as it was.
 * Tiles already on the phone are copied across rather than fetched again.
 * Resolves with what was kept, or null when there was nothing to save or the
 * save was overtaken (the map deleted, or saved again, meanwhile); throws
 * only when nearly nothing could be fetched.
 */
export async function saveOfflineMap(
  tripId: string,
  days: readonly (readonly { lat: number; lon: number }[])[],
  onProgress?: (done: number, total: number) => void,
): Promise<SavedMap | null> {
  if (!hasCaches()) throw new Error("This browser can't keep a map offline.");
  const generation = nextGeneration(tripId);
  const tiles = offlineTilePlan(days);
  if (!tiles.length) return null;
  const paths = [...tiles.map(vectorTilePath), ...offlineGlyphPaths()];
  const name = `${tripCachePrefix(tripId)}${Date.now()}`;
  const cache = await caches.open(name);

  let done = 0;
  let kept = 0;
  let bytes = 0;
  const queue = [...paths];
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      if (!isCurrent(tripId, generation)) return;
      try {
        const res = (await cached(path))?.clone() ?? (await fetch(path));
        if (res.ok) {
          const body = await res.arrayBuffer();
          if (!isCurrent(tripId, generation)) return;
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

  if (!isCurrent(tripId, generation)) {
    await caches.delete(name).catch(() => false);
    return null;
  }
  if (kept < paths.length * 0.8) {
    await caches.delete(name).catch(() => false);
    throw new Error("Couldn't save the map. Check your connection and try again.");
  }
  const saved: SavedMap = { savedAt: new Date().toISOString(), tiles: kept, bytes, cache: name };
  try {
    localStorage.setItem(`${OFFLINE_MAP_KEY_PREFIX}${tripId}`, JSON.stringify(saved));
  } catch {
    /* private mode: the tiles are kept, only the note of them is not */
  }
  // The new copy is in; the old ones can go.
  for (const old of await tripCaches(tripId)) {
    if (old !== name) await caches.delete(old).catch(() => false);
  }
  // Ask the browser not to clear it when space runs low. Safari may still
  // clear a site it has not seen for a while; the saved date says when.
  void navigator.storage?.persist?.().catch(() => false);
  return saved;
}

/**
 * Whether the saved copy is still on the phone. The browser may clear it
 * under pressure without telling anyone, so the note alone is not proof.
 */
export async function savedMapStillThere(tripId: string): Promise<boolean> {
  const note = readSavedMap(tripId);
  if (!hasCaches() || !note?.cache) return false;
  try {
    if (!(await caches.has(note.cache))) return false;
    const cache = await caches.open(note.cache);
    return Boolean(await cache.match(vectorTilePath({ z: 0, x: 0, y: 0 })));
  } catch {
    return false;
  }
}

/** Delete this trip's saved map, and stop any save of it under way. */
export async function clearOfflineMap(tripId: string): Promise<void> {
  nextGeneration(tripId);
  try {
    localStorage.removeItem(`${OFFLINE_MAP_KEY_PREFIX}${tripId}`);
  } catch {
    /* private mode */
  }
  if (!hasCaches()) return;
  for (const name of await tripCaches(tripId)) await caches.delete(name).catch(() => false);
}

/** Every trip's saved map, for signing out or erasing the account. */
export async function clearAllOfflineMaps(): Promise<void> {
  // Stop any save under way, so none writes a map back after the erase.
  for (const tripId of [...generations.keys()]) nextGeneration(tripId);
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
