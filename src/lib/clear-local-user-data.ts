import { tripDraftKey } from "./trip-draft.ts";
import { sampleCtaDismissKey } from "./auto-seed.ts";
import { clearAllOfflineMaps, OFFLINE_MAP_KEY_PREFIX } from "./offline-map.ts";
import { OFFLINE_TRIP_KEY_PREFIX } from "./offline-trip.ts";
import { autoCheckKey } from "./auto-check-store.ts";
import { TRAVEL_KEY_PREFIX } from "./travel-choice-store.ts";
import { clearStoredVaultKeys } from "./vaultCrypto.ts";
import { passkeyStorageKey } from "./vault-passkey.ts";

/** Same prefix as `DIRECTIONS_KEY_PREFIX` in useOfflineDirections. */
const DIRECTIONS_KEY_PREFIX = "bea.directions.";
/** Same prefix as `DAY_MAPS_KEY_PREFIX` in useOfflineDayMaps. */
const DAY_MAPS_KEY_PREFIX = "bea.daymaps.";

/**
 * Drop this-device leftovers after a cloud erase / account delete.
 * Theme and tour flags stay — those are device prefs, not account data.
 */
export function clearLocalUserData(uid: string) {
  if (typeof window === "undefined") return;

  clearStoredVaultKeys(uid);

  const exact = [
    tripDraftKey(uid),
    `bea-home-layout-${uid}`,
    `bea-stats-layout-${uid}`,
    `bea-world-layout-${uid}`,
    sampleCtaDismissKey(uid),
    // The Face ID / fingerprint copy of the Protected key.
    passkeyStorageKey(uid),
    "bea.trips.open",
    "bea-photo-consent-skip",
    "bea-location-consent",
    "bea-expense-disclaimer",
    autoCheckKey(uid),
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
      if (
        key?.startsWith(DIRECTIONS_KEY_PREFIX) ||
        key?.startsWith(DAY_MAPS_KEY_PREFIX) ||
        key?.startsWith(OFFLINE_MAP_KEY_PREFIX) ||
        key?.startsWith(OFFLINE_TRIP_KEY_PREFIX) ||
        key?.startsWith(TRAVEL_KEY_PREFIX)
      ) {
        doomed.push(key);
      }
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    /* private mode */
  }

  // The trips' saved maps: street tiles, but of where this account went.
  void clearAllOfflineMaps();
}
