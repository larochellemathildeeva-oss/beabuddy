/**
 * Supabase's sign-in errors in Béa's words. Its messages are written for
 * developers ("AuthApiError: Invalid login credentials"); a traveller needs
 * to know what to do next. Matched on the error's `code` first, then on its
 * message for older servers that send none. Pure, so it is tested.
 */
const BY_CODE: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Check both, or reset your password.",
  email_not_confirmed: "Confirm your email first: tap the link we sent you, then sign in.",
  user_already_exists: "There's already an account with that email. Sign in instead.",
  email_exists: "There's already an account with that email. Sign in instead.",
  weak_password: "Choose a longer password that's harder to guess.",
  over_request_rate_limit: "Too many tries just now. Wait a minute, then try again.",
  over_email_send_rate_limit: "Too many emails sent just now. Wait a few minutes, then try again.",
  signup_disabled: "New accounts are paused right now. Please try again later.",
  email_address_invalid: "That email address doesn't look right.",
  validation_failed: "Check the email and password, then try again.",
};

const BY_MESSAGE: Array<[RegExp, string]> = [
  [/invalid login credentials/i, BY_CODE["invalid_credentials"]!],
  [/email not confirmed/i, BY_CODE["email_not_confirmed"]!],
  [/already registered|already exists/i, BY_CODE["user_already_exists"]!],
  [/rate limit|too many/i, BY_CODE["over_request_rate_limit"]!],
  [/failed to fetch|network|load failed/i, "No connection. Check your signal, then try again."],
];

const FALLBACK = "Something went wrong. Try again.";

export function friendlyAuthError(err: unknown): string {
  if (!err || typeof err !== "object") return FALLBACK;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && BY_CODE[code]) return BY_CODE[code];
  const message = (err as { message?: unknown }).message;
  if (typeof message !== "string" || !message) return FALLBACK;
  for (const [pattern, text] of BY_MESSAGE) if (pattern.test(message)) return text;
  // Béa's own checks (consent, breached password) already speak plainly.
  return message;
}
