/**
 * Sample data is opt-in only (Home empty CTA / You → Load sample).
 * These guards stay so any leftover auto-seed hook cannot bury real data
 * or undo "Remove sample".
 *
 * After "Remove sample", the Home empty CTA must stay gone — otherwise the
 * traveller just opted out and immediately gets asked to load sample again.
 */

import type { TourStorage } from "./tour-state.ts";

/** One marker per account: a shared device must not seed the second person. */
export function autoSeedKey(userId: string): string {
  return `bea-autoseed:${userId}`;
}

/** Home empty "Load sample" banner dismissed after Remove sample (per account). */
export function sampleCtaDismissKey(userId: string): string {
  return `bea-sample-cta-dismissed:${userId}`;
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

export function hasDismissedSampleCta(storage: TourStorage, userId: string): boolean {
  return storage.getItem(sampleCtaDismissKey(userId)) === "yes";
}

/** Called when Remove sample succeeds so Home does not re-prompt. */
export function dismissSampleCta(storage: TourStorage, userId: string): void {
  storage.setItem(sampleCtaDismissKey(userId), "yes");
}

export function clearSampleCtaDismiss(storage: TourStorage, userId: string): void {
  storage.removeItem(sampleCtaDismissKey(userId));
}

/**
 * Always false — sample travel data must be loaded by the traveller.
 * Kept as a function so older hooks cannot accidentally re-enable seeding.
 */
export function shouldAutoSeed(
  _storage: TourStorage,
  userId: string | null | undefined,
  _counts: AccountCounts,
): boolean {
  if (!userId) return false;
  return false;
}
