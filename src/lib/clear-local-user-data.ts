import { sampleCtaDismissKey } from "./auto-seed.ts";
import { clearStoredVaultKeys } from "./vaultCrypto.ts";

/** Same prefix as `DIRECTIONS_KEY_PREFIX` in useOfflineDirections. */
const DIRECTIONS_KEY_PREFIX = "bea.directions.";

/**
 * Drop this-device leftovers after a cloud erase / account delete.
 * Theme and tour flags stay — those are device prefs, not account data.
 */
export function clearLocalUserData(uid: string) {
  if (typeof window === "undefined") return;

  clearStoredVaultKeys(uid);

  const exact = [
    `bea-home-layout-${uid}`,
    `bea-stats-layout-${uid}`,
    sampleCtaDismissKey(uid),
    "bea.trips.open",
    "bea-photo-consent-skip",
    "bea-location-consent",
    "bea-expense-disclaimer",
  ];
  for (const key of exact) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* private mode */
    }
  }

  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(DIRECTIONS_KEY_PREFIX)) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}
