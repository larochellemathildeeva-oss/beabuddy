export type GeoReserveResult = "ok" | "denied" | "missing" | "error";
export type GeoSpendResult = "ok" | "denied" | "unmetered" | "error";

/** Credits reserved from the database at a time, so most spends need no round trip. */
export const RESERVATION_BLOCK = 25;
/** How long a failed reservation pauses Geoapify, counted from the failure. */
export const ERROR_PAUSE_MS = 60_000;
/** How long a missing migration is trusted before the database is asked again. */
export const MISSING_RETRY_MS = 60 * 60_000;

function nextUtcDay(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

type Flight = { day: number; promise: Promise<GeoReserveResult> };

/**
 * Keeps a small local balance from credits already reserved in the shared
 * database ledger. Pure apart from the injected reservation function and
 * clock.
 *
 * Everything is kept per UTC day and only ever moves forward: a reservation
 * or a denial made for one day never counts toward, or blocks, the next, and
 * a caller that waited across midnight asks again for the day it is now in.
 */
export class GeoLedger {
  private day = 0;
  private balance = 0;
  private deniedDay = 0;
  private missingUntil = 0;
  private errorUntil = 0;
  private inFlight: Flight | null = null;
  private readonly reserve: (credits: number) => Promise<GeoReserveResult>;
  private readonly clock: () => number;

  constructor(
    reserve: (credits: number) => Promise<GeoReserveResult>,
    clock: () => number = Date.now,
  ) {
    this.reserve = reserve;
    this.clock = clock;
  }

  async spend(credits: number): Promise<GeoSpendResult> {
    if (credits <= 0) return "ok";
    for (;;) {
      const now = this.clock();
      const day = nextUtcDay(now);
      this.advance(day);
      if (now < this.missingUntil) return "unmetered";
      if (this.deniedDay === day) return "denied";
      if (now < this.errorUntil) return "error";

      if (this.balance >= credits) {
        this.balance -= credits;
        return "ok";
      }

      const flight =
        this.inFlight && this.inFlight.day === day
          ? this.inFlight
          : this.start(day, Math.max(RESERVATION_BLOCK, Math.ceil(credits)));
      const result = await flight.promise;
      // Midnight passed while waiting: that answer was for yesterday.
      if (nextUtcDay(this.clock()) !== flight.day) continue;
      if (result === "missing") return "unmetered";
      if (result === "error") return "error";
      if (result === "denied") return "denied";
      // "ok": the block is in the balance; take from it on the next pass.
    }
  }

  /** Move to a later day; never back to an earlier one. */
  private advance(day: number): void {
    if (day <= this.day) return;
    this.day = day;
    this.balance = 0;
  }

  private start(day: number, credits: number): Flight {
    const flight: Flight = {
      day,
      promise: this.reserve(credits)
        .catch(() => "error" as const)
        .then((result) => {
          const at = this.clock();
          if (result === "ok") {
            // A block for a day already over is dropped, not carried forward.
            if (this.day === day) this.balance += credits;
          } else if (result === "denied") {
            this.deniedDay = Math.max(this.deniedDay, day);
          } else if (result === "missing") {
            this.missingUntil = at + MISSING_RETRY_MS;
          } else {
            this.errorUntil = at + ERROR_PAUSE_MS;
          }
          if (this.inFlight === flight) this.inFlight = null;
          return result;
        }),
    };
    this.inFlight = flight;
    return flight;
  }
}
