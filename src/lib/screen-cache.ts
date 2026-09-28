/**
 * What a screen last loaded, kept in memory so a tab you come back to opens
 * with it at once and refreshes in the background.
 *
 * Without it every tab switch started from nothing: Home drew an empty page,
 * then cards with half their facts (the trip's own city before its stops,
 * "nothing left to do" before its to-dos), then the real thing — a visible
 * stutter on each switch. Memory only: nothing here outlives the page, and
 * signing out forgets it all (`forgetScreens`).
 */
const store = new Map<string, unknown>();

export function lastLoaded<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function rememberLoaded<T>(key: string, value: T): void {
  store.set(key, value);
}

/** Signing out: the next person on this device must not see the last one's trips. */
export function forgetScreens(): void {
  store.clear();
}
