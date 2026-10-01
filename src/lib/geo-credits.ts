/**
 * What Béa spends on Geoapify in a day, and when to stop.
 *
 * The free plan is 3,000 credits a UTC day for the whole app, and Geoapify
 * does not refuse the call that goes over: one day of testing itineraries
 * counted 8,728. So Béa keeps its own count. Once the day's ceiling is
 * reached, or Geoapify refuses a call, it rests Geoapify and every lookup goes
 * to LocationIQ (or OpenStreetMap's public servers) until the next UTC day.
 *
 * Pure and tested; the one running guard lives in `geo-provider.server.ts`.
 */

/** Under the plan's 3,000, leaving room for what was spent before a restart. */
export const GEOAPIFY_DAILY_CREDITS = 2_700;

/**
 * How long a 429 rests Geoapify when it does not say: long enough for its
 * five-a-second limit to clear, short enough that one busy moment does not
 * cut short an offline map save. A `Retry-After` is honoured up to the cap.
 */
export const RATE_LIMIT_REST_MS = 60_000;
export const RATE_LIMIT_REST_MAX_MS = 10 * 60_000;

/**
 * What one request to `url` costs, from Geoapify's pricing and its own usage
 * report: a geocode, route or place search is one credit, Place Details two,
 * a map tile or font a quarter, and a static map one plus one per marker
 * (billed as the Marker Icon API). Zero for anything not Geoapify's.
 */
export function geoapifyCredits(url: string): number {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 0;
  }
  if (!/(^|\.)geoapify\.com$/.test(parsed.hostname)) return 0;
  const path = parsed.pathname;
  if (path.startsWith("/v2/place-details")) return 2;
  if (path.startsWith("/v1/staticmap")) {
    const markers = parsed.searchParams.get("marker");
    return 1 + (markers ? markers.split("|").length : 0);
  }
  if (path.startsWith("/v1/tile/") || path.includes("/fonts/")) return 0.25;
  return 1;
}

/** Milliseconds at the start of the next UTC day. */
export function nextUtcDay(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** Why Geoapify is resting, for the one line in the log. */
export type RestReason = "ceiling" | "refused" | "rate-limited" | "unverified";

/**
 * The day's count and whether Geoapify is resting.
 *
 * `spend` adds a request's credits and rests Geoapify for the rest of the day
 * once the ceiling is reached. `answered` reads Geoapify's status: 401, 402
 * and 403 (no credit left, or a key it will not take) rest it for the day,
 * a 429 for its `Retry-After` or a minute, then it is asked again.
 */
export class CreditGuard {
  private day = 0;
  private spent = 0;
  private until = 0;
  reason: RestReason | null = null;

  readonly ceiling: number;

  constructor(ceiling: number = GEOAPIFY_DAILY_CREDITS) {
    this.ceiling = ceiling;
  }

  private roll(now: number): void {
    const day = nextUtcDay(now);
    if (day !== this.day) {
      this.day = day;
      this.spent = 0;
    }
  }

  resting(now: number): boolean {
    if (this.until && now >= this.until) {
      this.until = 0;
      this.reason = null;
    }
    return this.until > now;
  }

  credits(now: number): number {
    this.roll(now);
    return this.spent;
  }

  /** True when this spend put Geoapify to rest. */
  spend(credits: number, now: number): boolean {
    this.roll(now);
    this.spent += credits;
    if (this.spent < this.ceiling || this.resting(now)) return false;
    this.rest(nextUtcDay(now), "ceiling");
    return true;
  }

  /** Rest Geoapify until the next UTC day without changing the local count. */
  restForDay(now: number): void {
    this.roll(now);
    this.rest(nextUtcDay(now), "ceiling");
  }

  /**
   * Rest Geoapify for `ms` (the database count could not be checked), so
   * lookups move to the fallback meanwhile. A longer rest already in place
   * is kept.
   */
  restFor(ms: number, now: number, reason: RestReason = "unverified"): void {
    if (this.resting(now) && this.until >= now + ms) return;
    this.rest(now + ms, reason);
  }

  /** True when this answer put Geoapify to rest. */
  answered(status: number, now: number, retryAfterS?: number): boolean {
    if (this.resting(now)) return false;
    if (status === 401 || status === 402 || status === 403) {
      this.rest(nextUtcDay(now), "refused");
      return true;
    }
    if (status === 429) {
      const asked = retryAfterS && retryAfterS > 0 ? retryAfterS * 1000 : RATE_LIMIT_REST_MS;
      this.rest(now + Math.min(asked, RATE_LIMIT_REST_MAX_MS), "rate-limited");
      return true;
    }
    return false;
  }

  private rest(until: number, reason: RestReason): void {
    this.until = until;
    this.reason = reason;
  }
}
