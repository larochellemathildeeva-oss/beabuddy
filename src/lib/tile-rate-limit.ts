export const TILE_RATE_LIMIT_CAPACITY = 600;
export const TILE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const TILE_RATE_LIMIT_MAX_KEYS = 10_000;
export const TILE_DAILY_CREDITS = 600;

type Bucket = { tokens: number; updatedAt: number };

/**
 * Canner's hosting proxy appends the real client address to x-forwarded-for.
 * The client can forge entries to its left, so only the LAST entry is trusted.
 */
export function tileClientKey(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  const last = forwarded.split(",").at(-1)?.trim();
  return last || "unknown";
}

/** Continuous-refill token buckets, bounded so arbitrary client keys cannot grow memory forever. */
export class TileRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(
    capacity = TILE_RATE_LIMIT_CAPACITY,
    windowMs = TILE_RATE_LIMIT_WINDOW_MS,
    maxKeys = TILE_RATE_LIMIT_MAX_KEYS,
  ) {
    this.capacity = capacity;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  allow(key: string, now: number): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.maxKeys <= 0) return false;
      while (this.buckets.size >= this.maxKeys) {
        const oldest = this.buckets.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        this.buckets.delete(oldest);
      }
      bucket = { tokens: this.capacity, updatedAt: now };
      this.buckets.set(key, bucket);
    } else if (now > bucket.updatedAt) {
      const refill = ((now - bucket.updatedAt) * this.capacity) / this.windowMs;
      bucket.tokens = Math.min(this.capacity, bucket.tokens + refill);
      bucket.updatedAt = now;
    }

    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  has(key: string): boolean {
    return this.buckets.has(key);
  }

  get size(): number {
    return this.buckets.size;
  }
}

/** UTC-day credit share reserved for map tiles/glyphs; server.ts keeps the running instance global. */
export class TileDailyCreditShare {
  private day = 0;
  private spent = 0;
  private announcedDay = 0;
  readonly ceiling: number;

  constructor(ceiling = TILE_DAILY_CREDITS) {
    this.ceiling = ceiling;
  }

  canSpend(credits: number, now: number): boolean {
    this.roll(now);
    return credits >= 0 && this.spent + credits <= this.ceiling;
  }

  trySpend(credits: number, now: number): boolean {
    if (!this.canSpend(credits, now)) return false;
    this.spent += credits;
    return true;
  }

  credits(now: number): number {
    this.roll(now);
    return this.spent;
  }

  /** True once per UTC day after the share reaches its ceiling. */
  takeExhaustedNotice(now: number): boolean {
    this.roll(now);
    if (this.spent < this.ceiling || this.announcedDay === this.day) return false;
    this.announcedDay = this.day;
    return true;
  }

  private roll(now: number): void {
    const d = new Date(now);
    const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    if (day === this.day) return;
    this.day = day;
    this.spent = 0;
  }
}
