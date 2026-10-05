/**
 * "Auto-check stops when I arrive", kept on this phone per traveller and off
 * until chosen. Marking a stop as arrived is saved on the trip for everyone
 * on it, so the default is that Béa asks and the traveller taps. Keyed by
 * account so the next person on a shared phone does not inherit it.
 */
export function autoCheckKey(uid: string): string {
  return `bea.followalong.autocheck.${uid}`;
}

export function readAutoCheck(uid: string | null | undefined): boolean {
  if (typeof window === "undefined" || !uid) return false;
  try {
    return window.localStorage.getItem(autoCheckKey(uid)) === "1";
  } catch {
    return false;
  }
}

export function writeAutoCheck(uid: string | null | undefined, on: boolean): void {
  if (!uid) return;
  try {
    if (on) window.localStorage.setItem(autoCheckKey(uid), "1");
    else window.localStorage.removeItem(autoCheckKey(uid));
  } catch {
    // Not remembering it is fine.
  }
}
