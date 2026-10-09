/**
 * Kept directions in the traveller's account (`trip_directions`), beside the
 * phone's copy, so they are never lost with the phone's storage.
 *
 * - "Keep offline" writes both; deleting the directions deletes both.
 * - After sign-in, `restoreKeptOffline` writes back every copy the phone is
 *   missing, with the trip's plan, its map and its day pictures, so each
 *   trip kept offline opens with no signal again, without opening it first.
 * - Signing out from the profile runs `clearKeptOfflineOnSignOut`: it removes
 *   from the phone only what the account holds, so a shared phone keeps
 *   nothing and the traveller loses nothing.
 *
 * Until the migration is applied, every call answers "not kept" with one
 * warning, and the phone's copies stay where they are. Which copy wins is in
 * `directions-backup.ts` (pure, tested).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { keepTripPlanOffline } from "@/hooks/useTrips";
import { daysForMaps } from "./day-maps";
import {
  accountCopyWins,
  backedUp,
  isMissingTable,
  readKeptDirections,
  signOutClears,
  type KeptDirections,
} from "./directions-backup";
import { clearOfflineMap, saveOfflineMap, vectorMapAvailable } from "./offline-map";
import { forgetOfflineTrip, offlineTripKey } from "./offline-trip";
import { dayMapImage } from "./place-details.functions";
import { splitDirectionRows } from "./timeline-directions";

/** Same prefix as `DIRECTIONS_KEY_PREFIX` in useOfflineDirections. */
const DIRECTIONS_KEY_PREFIX = "bea.directions.";
/** Same prefix as `DAY_MAPS_KEY_PREFIX` in useOfflineDayMaps. */
const DAY_MAPS_KEY_PREFIX = "bea.daymaps.";

let warned = false;
function note(error: { code?: string; message?: string }): void {
  if (!isMissingTable(error) || warned) return;
  warned = true;
  console.warn(
    "trip_directions is not in the database yet (supabase/migrations/20260930150000_trip_directions.sql): kept directions stay on the phone only.",
  );
}

/** The account's copy of one trip's directions. False when it could not be written. */
export async function backupDirections(
  uid: string,
  tripId: string,
  copy: KeptDirections,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("trip_directions").upsert(
      {
        user_id: uid,
        trip_id: tripId,
        directions: copy as unknown as Json,
        saved_at: copy.savedAt,
      },
      { onConflict: "user_id,trip_id" },
    );
    if (error) note(error);
    return !error;
  } catch {
    return false;
  }
}

/** The traveller deleted the directions: the account's copy goes too. */
export async function forgetDirectionsBackup(uid: string, tripId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("trip_directions")
      .delete()
      .eq("user_id", uid)
      .eq("trip_id", tripId);
    if (error) note(error);
  } catch {
    // No signal: the row stays, and comes back only if the directions are kept again.
  }
}

/** The signed-in traveller's id, or null. */
export async function signedInUid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** The account's copy of one trip's directions, or null. */
export async function accountCopyOf(uid: string, tripId: string): Promise<KeptDirections | null> {
  try {
    const { data, error } = await supabase
      .from("trip_directions")
      .select("directions")
      .eq("user_id", uid)
      .eq("trip_id", tripId)
      .maybeSingle();
    if (error) {
      note(error);
      return null;
    }
    return data ? readKeptDirections(data.directions) : null;
  } catch {
    return null;
  }
}

/** Every copy the account holds, or null when it did not answer. */
async function accountCopies(uid: string): Promise<Map<string, KeptDirections> | null> {
  try {
    const { data, error } = await supabase
      .from("trip_directions")
      .select("trip_id, directions")
      .eq("user_id", uid);
    if (error) {
      note(error);
      return null;
    }
    const out = new Map<string, KeptDirections>();
    for (const row of data ?? []) {
      const copy = readKeptDirections(row.directions);
      if (copy) out.set(row.trip_id, copy);
    }
    return out;
  } catch {
    return null;
  }
}

/** The phone's copies by trip; one that cannot be read has no date, so it is never removed. */
function phoneCopies(): Map<string, { copy: KeptDirections | null; savedAt?: string }> {
  const out = new Map<string, { copy: KeptDirections | null; savedAt?: string }>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(DIRECTIONS_KEY_PREFIX)) continue;
      let copy: KeptDirections | null = null;
      try {
        copy = readKeptDirections(JSON.parse(localStorage.getItem(key) ?? "null"));
      } catch {
        copy = null;
      }
      out.set(key.slice(DIRECTIONS_KEY_PREFIX.length), {
        copy,
        ...(copy ? { savedAt: copy.savedAt } : {}),
      });
    }
  } catch {
    // Storage blocked: nothing on the phone to compare.
  }
  return out;
}

/**
 * The plan, map and day pictures that go with a trip's kept directions, as
 * "Keep offline" saves them. Best effort: the directions themselves are
 * already back, and the trip page fills in anything missed.
 */
async function restoreTripExtras(uid: string, tripId: string): Promise<void> {
  const items = await keepTripPlanOffline(uid, tripId);
  if (!items) return;
  const { stops } = splitDirectionRows(items);
  try {
    if (await vectorMapAvailable()) {
      await saveOfflineMap(
        tripId,
        daysForMaps(stops, Infinity).map((d) => d.points),
      );
    }
  } catch {
    // No room, or no signal: the trip page asks again when it opens.
  }
  const days = daysForMaps(stops);
  if (!days.length) return;
  const pictures: Record<string, string> = {};
  for (const { day, points } of days) {
    try {
      const url = await dayMapImage({ data: { points } });
      if (url) pictures[day] = url;
    } catch {
      // One missing picture does not undo the others.
    }
  }
  try {
    localStorage.setItem(
      `${DAY_MAPS_KEY_PREFIX}${tripId}`,
      JSON.stringify({ savedAt: new Date().toISOString(), days: pictures }),
    );
  } catch {
    // Full: the vector map, where there is one, still works.
  }
}

/**
 * After sign-in: bring back every trip kept offline that the phone is
 * missing (signed out, a new phone, storage the browser cleared), and send
 * the account any phone copy it does not hold yet (kept before the account
 * copy existed, or with no signal). Returns the trips brought back.
 */
export async function restoreKeptOffline(uid: string): Promise<string[]> {
  const account = await accountCopies(uid);
  if (!account) return [];
  const phone = phoneCopies();
  const restored: string[] = [];
  for (const [tripId, copy] of account) {
    const mine = phone.get(tripId);
    if (!accountCopyWins(mine?.copy ?? null, copy)) continue;
    try {
      localStorage.setItem(`${DIRECTIONS_KEY_PREFIX}${tripId}`, JSON.stringify(copy));
    } catch {
      continue;
    }
    restored.push(tripId);
  }
  for (const [tripId, { copy }] of phone) {
    if (copy && !backedUp(copy, account.get(tripId))) void backupDirections(uid, tripId, copy);
  }
  // A trip whose directions came back also needs its plan to open offline.
  for (const tripId of restored) {
    let hasPlan = false;
    try {
      hasPlan = localStorage.getItem(offlineTripKey(tripId)) !== null;
    } catch {
      hasPlan = false;
    }
    if (!hasPlan) await restoreTripExtras(uid, tripId);
  }
  return restored;
}

/**
 * Signing out from the profile: remove from this phone every trip kept
 * offline that the account holds (directions, plan, map, day pictures), after
 * sending the account any copy it is missing. A copy the account could not
 * take, or any copy at all with no signal, stays on the phone. Once `signal`
 * is aborted (sign-out gave up waiting), nothing more is removed.
 */
export async function clearKeptOfflineOnSignOut(
  uid: string,
  signal?: AbortSignal,
): Promise<{ cleared: number; kept: number }> {
  const phone = phoneCopies();
  if (!phone.size) return { cleared: 0, kept: 0 };
  const account = await accountCopies(uid);
  if (account) {
    for (const [tripId, { copy }] of phone) {
      if (!copy || backedUp(copy, account.get(tripId))) continue;
      if (await backupDirections(uid, tripId, copy)) account.set(tripId, copy);
    }
  }
  const dated = new Map<string, { savedAt?: string | null }>(
    [...phone].map(([tripId, p]) => [tripId, { savedAt: p.savedAt ?? null }]),
  );
  if (signal?.aborted) return { cleared: 0, kept: phone.size };
  const { clear, keep } = signOutClears(dated, account);
  for (const tripId of clear) {
    if (signal?.aborted) break;
    try {
      localStorage.removeItem(`${DIRECTIONS_KEY_PREFIX}${tripId}`);
      localStorage.removeItem(`${DAY_MAPS_KEY_PREFIX}${tripId}`);
    } catch {
      /* private mode */
    }
    forgetOfflineTrip(localStorage, tripId);
    await clearOfflineMap(tripId);
  }
  return { cleared: clear.length, kept: keep.length };
}
