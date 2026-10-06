/**
 * What a traveller sees when a call fails. Béa's own server errors are written
 * in plain words and pass through; the ones that come from the database, the
 * network stack or the runtime ("JWT expired", "violates row-level security
 * policy", "TypeError: …") are written for developers and are replaced by the
 * caller's own fallback. Pure, so it is tested.
 */
const TECHNICAL: RegExp[] = [
  /\bjwt\b/i,
  /row-level security|violates|duplicate key|foreign key|constraint/i,
  /\bPGRST\d+|\bpostgres|\bsupabase\b|\brelation\b.*\bdoes not exist/i,
  /\b(TypeError|ReferenceError|SyntaxError|RangeError)\b/,
  /\bundefined\b|\bnull\b|\[object /i,
  /failed to fetch|load failed|networkerror|fetch failed|ECONN|ETIMEDOUT/i,
  /\b(5\d\d|4\d\d)\b.*\b(error|status)\b|\bstatus (code )?\d{3}\b/i,
  /^\s*[\w.]*(Error|Exception)\s*:/,
  /[{}]|\bat \S+ \(/,
];

const MAX_PLAIN_LENGTH = 200;

export function friendlyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const text = message.trim();
  if (!text || text.length > MAX_PLAIN_LENGTH) return fallback;
  if (TECHNICAL.some((pattern) => pattern.test(text))) return fallback;
  return text;
}
