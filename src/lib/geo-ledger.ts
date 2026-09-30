export type GeoReserveResult = "ok" | "denied" | "missing" | "error";
export type GeoSpendResult = "ok" | "denied" | "unmetered" | "error";

const RESERVATION_BLOCK = 25;
const ERROR_PAUSE_MS = 60_000;

function nextUtcDay(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/**
 * Keeps a small local balance from credits already reserved in the shared
 * database ledger. Pure apart from the injected reservation function.
 */
export class GeoLedger {
  private balance = 0;
  private day = 0;
  private denied = false;
  private unmetered = false;
  private errorUntil = 0;
  private inFlight: Promise<GeoReserveResult> | null = null;

  constructor(private readonly reserve: (credits: number) => Promise<GeoReserveResult>) {}

  async spend(credits: number, now: number): Promise<GeoSpendResult> {
    this.roll(now);
    if (this.unmetered) return "unmetered";
    if (credits <= 0) return "ok";
    if (this.denied) return "denied";
    if (this.errorUntil > now) return "error";

    for (;;) {
      if (this.balance >= credits) {
        this.balance -= credits;
        return "ok";
      }

      if (!this.inFlight) {
        this.startReservation(Math.max(RESERVATION_BLOCK, Math.ceil(credits)), now);
      }

      const result = await this.inFlight;
      if (result === "missing") return "unmetered";
      if (result === "error") return "error";
      if (result === "denied") return "denied";

      this.roll(now);
      if (this.unmetered) return "unmetered";
      if (this.denied) return "denied";
      if (this.errorUntil > now) return "error";
    }
  }

  private roll(now: number): void {
    const day = nextUtcDay(now);
    if (day !== this.day) {
      this.day = day;
      this.balance = 0;
      this.denied = false;
    }
  }

  private startReservation(credits: number, now: number): void {
    const reservationDay = this.day;
    let promise: Promise<GeoReserveResult>;
    promise = this.reserve(credits)
      .catch(() => "error" as const)
      .then((result) => {
        if (result === "ok") {
          if (this.day === reservationDay) this.balance += credits;
        } else if (result === "denied") {
          if (this.day === reservationDay) this.denied = true;
        } else if (result === "missing") {
          this.unmetered = true;
          this.balance = 0;
        } else {
          this.errorUntil = now + ERROR_PAUSE_MS;
        }
        return result;
      })
      .finally(() => {
        if (this.inFlight === promise) this.inFlight = null;
      });
    this.inFlight = promise;
  }
}
