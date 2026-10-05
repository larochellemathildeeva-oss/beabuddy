/**
 * "Auto-check stops when I arrive", kept on this phone and off until chosen.
 * Marking a stop as arrived is saved on the trip for everyone on it, so the
 * default is that Béa asks and the traveller taps.
 */
export const AUTO_CHECK_KEY = "bea.followalong.autocheck";

export function readAutoCheck(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTO_CHECK_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAutoCheck(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(AUTO_CHECK_KEY, "1");
    else window.localStorage.removeItem(AUTO_CHECK_KEY);
  } catch {
    // Not remembering it is fine.
  }
}
