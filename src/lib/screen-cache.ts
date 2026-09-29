/**
 * What a screen last loaded, kept in memory so a tab you come back to opens
 * with it at once and refreshes in the background.
 *
 * Without it every tab switch started from nothing: Home drew an empty page,
 * then cards with half their facts (the trip's own city before its stops,
 * "nothing left to do" before its to-dos), then the real thing — a visible
 * stutter on each switch. Memory only: nothing here outlives the page.
 *
 * It belongs to one account at a time. A change of account empties it and
 * starts a new generation; a load begun under the old one passes the
 * generation it started in and is not kept, so a request still in flight at
 * sign-out cannot put the last person's trips back for the next.
 */
const store = new Map<string, unknown>();
let owner: string | null = null;
let generation = 0;

export function lastLoaded<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

/** Read before a load starts, and handed back to `rememberLoaded` with its result. */
export function screenGeneration(): number {
  return generation;
}

export function rememberLoaded<T>(key: string, value: T, since: number): void {
  if (since !== generation) return;
  store.set(key, value);
}

/** Signing out: the next person on this device must not see the last one's trips. */
export function forgetScreens(): void {
  store.clear();
  owner = null;
  generation += 1;
}

/** The signed-in account, from every auth event: a different one starts afresh. */
export function screensBelongTo(uid: string | null): void {
  if (uid === owner) return;
  forgetScreens();
  owner = uid;
}
