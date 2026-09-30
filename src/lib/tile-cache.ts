export const TILE_CACHE_MAX_ENTRIES = 2_000;
export const TILE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
export const TILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type TileCacheValue = {
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
};

type CacheEntry = {
  value: TileCacheValue;
  bytes: number;
  expiresAt: number;
};

/** Bounded in-memory LRU for map responses. Pure; the running instance lives in server.ts. */
export class TileResponseCache {
  private readonly entries = new Map<string, CacheEntry>();
  private totalBytes = 0;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly ttlMs: number;

  constructor(
    maxEntries = TILE_CACHE_MAX_ENTRIES,
    maxBytes = TILE_CACHE_MAX_BYTES,
    ttlMs = TILE_CACHE_TTL_MS,
  ) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.ttlMs = ttlMs;
  }

  get(key: string, now: number): TileCacheValue | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.delete(key, entry);
      return null;
    }
    // Map insertion order is the LRU order: move every hit to the newest end.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: TileCacheValue, now: number): boolean {
    const bytes = value.body.byteLength;
    if (bytes === 0 || bytes > this.maxBytes || this.maxEntries <= 0 || this.maxBytes <= 0) {
      return false;
    }

    const existing = this.entries.get(key);
    if (existing) this.delete(key, existing);
    this.entries.set(key, { value, bytes, expiresAt: now + this.ttlMs });
    this.totalBytes += bytes;

    while (this.entries.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      const oldest = this.entries.get(oldestKey);
      if (oldest) this.delete(oldestKey, oldest);
    }
    return this.entries.has(key);
  }

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  private delete(key: string, entry: CacheEntry): void {
    if (!this.entries.delete(key)) return;
    this.totalBytes -= entry.bytes;
  }
}
