/** Invite code search-space helpers — security backlog item 8.
 * Keep alphabet size / length in sync with `trip-invite.ts`.
 */

/** Must match `INVITE_ALPHABET.length` in trip-invite.ts (32). */
export const INVITE_ALPHABET_SIZE = 32;

/** Must match `INVITE_CODE_LENGTH` in trip-invite.ts (10). */
export const INVITE_GUESS_LENGTH = 10;

/** From accept_trip_invite: count attempts in rolling 10 minutes. */
export const INVITE_ATTEMPT_LIMIT = 20;
export const INVITE_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

export function inviteCodeSpace(
  length = INVITE_GUESS_LENGTH,
  alphabet = INVITE_ALPHABET_SIZE,
): number {
  return alphabet ** length;
}

/** Max attempts per user per hour at the current throttle. */
export function inviteAttemptsPerHour(
  limit = INVITE_ATTEMPT_LIMIT,
  windowMs = INVITE_ATTEMPT_WINDOW_MS,
): number {
  return limit * (3_600_000 / windowMs);
}

/**
 * Rough hours for one account to try `fraction` of the code space at throttle.
 * For documentation — not a cryptanalytic bound.
 */
export function hoursToScanFraction(
  fraction: number,
  length = INVITE_GUESS_LENGTH,
  alphabet = INVITE_ALPHABET_SIZE,
): number {
  const need = inviteCodeSpace(length, alphabet) * fraction;
  return need / inviteAttemptsPerHour();
}
