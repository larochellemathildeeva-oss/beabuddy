/**
 * Whether this traveller follows any trip, as this phone last knew it. Only
 * a hint: when the Following list cannot be read, it is what keeps the
 * Following tab on Trips, with a way to try again, rather than the tab
 * vanishing as if nothing were followed. Never trusted for anything else.
 */

const KEY = "bea-follows";

export function rememberFollows(userId: string, follows: boolean): void {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
    if (follows) all[userId] = true;
    else delete all[userId];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // No storage: the tab simply follows the list.
  }
}

export function knownToFollow(userId: string): boolean {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
    return all[userId] === true;
  } catch {
    return false;
  }
}
