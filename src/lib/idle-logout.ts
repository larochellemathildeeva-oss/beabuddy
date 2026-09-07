/** Idle auto-logout — free session hygiene when Supabase Pro session controls aren't available. */

/** Signed-in users with no pointer/keyboard/scroll activity for this long are signed out. */
export const IDLE_LOGOUT_MS = 45 * 60 * 1000;

export function idleDeadline(lastActivityAt: number, now = Date.now(), idleMs = IDLE_LOGOUT_MS): number {
  return lastActivityAt + idleMs;
}

export function isIdleExpired(
  lastActivityAt: number,
  now = Date.now(),
  idleMs = IDLE_LOGOUT_MS,
): boolean {
  return now >= idleDeadline(lastActivityAt, now, idleMs);
}
