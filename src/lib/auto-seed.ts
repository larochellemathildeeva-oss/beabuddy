/**
 * Whether to fill a brand-new account with sample travel data on first login.
 *
 * The first five minutes decide whether Béa reads as a travel vault or an empty
 * form: the globe, Near, travel stats and the guided walk all describe data the
 * account does not have yet. Seeding once, up front, is what makes the rest of
 * the app tell the truth.
 *
 * Two guards, because getting this wrong is worse than not doing it:
 *
 *  - only ever for an account with nothing in it, so this cannot bury data
 *    someone already added;
 *  - only once per account, so "Remove sample" on You is not undone by the
 *    next page load.
 *
 * Kept pure so both guards are unit tested rather than argued about.
 */

import type { TourStorage } from "./tour-state.ts";

/** One marker per account: a shared device must not seed the second person. */
export function autoSeedKey(userId: string): string {
  return `bea-autoseed:${userId}`;
}

export type AccountCounts = {
  recommendations: number;
  trips: number;
  notes: number;
};

export function accountIsEmpty(counts: AccountCounts): boolean {
  return counts.recommendations === 0 && counts.trips === 0 && counts.notes === 0;
}

export function hasAutoSeeded(storage: TourStorage, userId: string): boolean {
  return storage.getItem(autoSeedKey(userId)) === "yes";
}

/**
 * Recorded whether the seed succeeded or failed. A failing seed that retried on
 * every page load would hammer the database and could half-fill the account.
 */
export function markAutoSeedAttempted(storage: TourStorage, userId: string): void {
  storage.setItem(autoSeedKey(userId), "yes");
}

export function shouldAutoSeed(
  storage: TourStorage,
  userId: string | null | undefined,
  counts: AccountCounts,
): boolean {
  if (!userId) return false;
  if (hasAutoSeeded(storage, userId)) return false;
  return accountIsEmpty(counts);
}
