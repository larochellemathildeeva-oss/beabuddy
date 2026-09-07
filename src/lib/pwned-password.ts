/**
 * Free leaked-password check via Have I Been Pwned k-anonymity range API.
 * Only the first 5 hex chars of SHA-1(password) leave the device — never the
 * full password. Used on sign-up and password reset (not on sign-in).
 *
 * Supabase Auth "Leaked password protection" is a Pro feature; this is the
 * free substitute for Pack B.
 */

export const MIN_NEW_PASSWORD_LENGTH = 10;

const RANGE_URL = "https://api.pwnedpasswords.com/range/";

export class PasswordRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordRejectedError";
  }
}

/** SHA-1 hex uppercase — HIBP range responses use uppercase suffixes. */
export async function sha1HexUpper(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Returns true if the password's hash appears in HIBP.
 * Returns null if the API is unreachable (caller should fail open).
 */
export async function isPasswordPwned(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean | null> {
  const hash = await sha1HexUpper(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  let res: Response;
  try {
    res = await fetchImpl(`${RANGE_URL}${prefix}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "Bea-Travel-App-Password-Check",
      },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const body = await res.text();
  for (const line of body.split("\n")) {
    const [lineSuffix] = line.trim().split(":");
    if (lineSuffix && lineSuffix.toUpperCase() === suffix) return true;
  }
  return false;
}

/**
 * Enforce minimum length + HIBP for newly chosen passwords.
 * Network/API failure does not block (fail open) so outages don't lock sign-up.
 */
export async function assertNewPasswordAllowed(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (password.length < MIN_NEW_PASSWORD_LENGTH) {
    throw new PasswordRejectedError(
      `Use at least ${MIN_NEW_PASSWORD_LENGTH} characters for your password.`,
    );
  }

  const pwned = await isPasswordPwned(password, fetchImpl);
  if (pwned === true) {
    throw new PasswordRejectedError(
      "That password appears in known data breaches. Please choose a different one.",
    );
  }
}
