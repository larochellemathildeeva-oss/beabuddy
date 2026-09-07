/** Unambiguous alphabet — no 0/O/1/I. */
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INVITE_CODE_LENGTH = 10;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Cryptographically random invite code (default 10 chars). */
export function generateInviteCode(length = INVITE_CODE_LENGTH): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
  return out;
}

export function inviteExpiresAt(from = Date.now()): string {
  return new Date(from + INVITE_TTL_MS).toISOString();
}
