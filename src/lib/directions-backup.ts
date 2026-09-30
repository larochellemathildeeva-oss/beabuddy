/**
 * Kept directions, in the account as well as on the phone.
 *
 * "Keep offline" saves a trip's directions on the phone; the account keeps a
 * copy (`trip_directions`), so a sign-out that cleans the phone, a new phone,
 * or a browser that clears its storage never costs the traveller their
 * directions. These are the rules for which copy wins and what sign-out may
 * remove. Pure, so they are tested; the reading and writing is in
 * `directions-account.ts`.
 */

/** What both copies carry, at the least. */
export type KeptDirections = {
  legs: unknown[];
  unresolved: string[];
  savedAt: string;
};

/**
 * The account's copy as the phone stores it, or null when it is not one:
 * legs and unresolved lists, and a real date.
 */
export function readKeptDirections<T extends KeptDirections = KeptDirections>(
  value: unknown,
): T | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<KeptDirections>;
  if (!Array.isArray(v.legs) || !Array.isArray(v.unresolved)) return null;
  if (!v.unresolved.every((u) => typeof u === "string")) return null;
  if (typeof v.savedAt !== "string" || Number.isNaN(Date.parse(v.savedAt))) return null;
  return value as T;
}

function time(savedAt: string | undefined | null): number {
  const t = savedAt ? Date.parse(savedAt) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Whether the account's copy should be written onto the phone: when the
 * phone has none, or an older one. A phone copy as new as the account's, or
 * newer (kept while the account could not be reached), stays.
 */
export function accountCopyWins(
  phone: { savedAt?: string | null } | null,
  account: { savedAt?: string | null } | null,
): boolean {
  if (!account) return false;
  if (!phone) return true;
  return time(account.savedAt) > time(phone.savedAt);
}

/**
 * Whether the account holds this phone copy, or a newer one: only then may
 * sign-out remove it from the phone, because signing in brings it back.
 */
export function backedUp(
  phone: { savedAt?: string | null },
  account: { savedAt?: string | null } | null | undefined,
): boolean {
  if (!account) return false;
  const a = time(account.savedAt);
  return a !== -Infinity && a >= time(phone.savedAt);
}

/**
 * What a sign-out may clear from the phone: the trips whose directions the
 * account holds. Anything else stays, however the account answered. With no
 * answer at all (no signal, or the table not there yet) nothing is removed.
 */
export function signOutClears(
  phone: ReadonlyMap<string, { savedAt?: string | null }>,
  account: ReadonlyMap<string, { savedAt?: string | null }> | null,
): { clear: string[]; keep: string[] } {
  const clear: string[] = [];
  const keep: string[] = [];
  for (const [tripId, copy] of phone) {
    if (account && backedUp(copy, account.get(tripId))) clear.push(tripId);
    else keep.push(tripId);
  }
  return { clear, keep };
}

/** Supabase's answer when the table has not been created yet. */
export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /relation .* does not exist|could not find the table|schema cache/i.test(
    error.message ?? "",
  );
}
