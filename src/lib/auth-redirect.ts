/**
 * Whether the current URL is still carrying an OAuth result that Supabase has
 * not redeemed yet.
 *
 * Google sends the traveller back to a gated page with the result in the URL —
 * `?code=…` under PKCE, `#access_token=…` under the implicit flow. Supabase
 * redeems it asynchronously after the client boots, so for a moment
 * `getSession()` answers null even though the sign-in succeeded. Redirecting
 * during that moment rewrites the URL and throws the code away, and the code
 * is single-use: the traveller lands back on the sign-in form having just
 * signed in, with nothing on screen explaining why.
 *
 * Kept as a pure function of the two URL parts so the rule can be tested
 * without a browser.
 */
export function hasPendingOAuthResult(search: string, hash: string): boolean {
  return isOAuthPayload(search) || isOAuthPayload(hash);
}

const OAUTH_KEYS = [
  // PKCE: redeemed by exchangeCodeForSession.
  "code",
  // Implicit flow.
  "access_token",
  "refresh_token",
  // Supabase reports provider failures the same way; let its own handling run
  // rather than bouncing to a sign-in page that cannot explain what happened.
  "error",
  "error_description",
  "error_code",
] as const;

function isOAuthPayload(part: string): boolean {
  if (!part) return false;
  const trimmed = part.replace(/^[?#]/, "");
  if (!trimmed) return false;
  const params = new URLSearchParams(trimmed);
  return OAUTH_KEYS.some((key) => {
    const value = params.get(key);
    return value !== null && value !== "";
  });
}

/** Reads the live URL; returns false during SSR, where there is nothing to redeem. */
export function hasPendingOAuthResultInWindow(): boolean {
  if (typeof window === "undefined") return false;
  return hasPendingOAuthResult(window.location.search, window.location.hash);
}
