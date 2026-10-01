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

/** Pages that must never be the place sign-in returns to. */
const NO_RETURN = ["/auth", "/forgot-password", "/reset-password"];

/**
 * Where to go after signing in, from an untrusted `?redirect=` value: a path
 * on this site only (never `//other.host` or `https://…`, which would make
 * the sign-in page an open redirect), and never back to a sign-in page.
 * Anything else answers null, and the caller goes Home.
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  // No control characters: a newline or tab can split a path into a host.
  for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) < 0x20) return null;
  const path = value.split(/[?#]/)[0] ?? "";
  if (NO_RETURN.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return value;
}

/**
 * Google returns to the site's origin, not to `/auth?redirect=…`, so the
 * return address waits in this tab's sessionStorage until the shell sees the
 * signed-in user and takes it, once.
 */
const PENDING_KEY = "bea-after-sign-in";

export function rememberReturnPath(path: string | null): void {
  try {
    if (path) window.sessionStorage.setItem(PENDING_KEY, path);
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage blocked: sign-in still works and lands on Home.
  }
}

export function takeReturnPath(): string | null {
  try {
    const value = window.sessionStorage.getItem(PENDING_KEY);
    window.sessionStorage.removeItem(PENDING_KEY);
    return safeRedirectPath(value);
  } catch {
    return null;
  }
}
