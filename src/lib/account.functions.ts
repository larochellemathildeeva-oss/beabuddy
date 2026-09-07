import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REMOVE_BATCH = 100;

function uniquePaths(paths: string[]) {
  return [...new Set(paths.filter((p) => p && !p.startsWith("location-only:")))];
}

async function removeInBatches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  bucket: string,
  paths: string[],
) {
  const list = uniquePaths(paths);
  for (let i = 0; i < list.length; i += REMOVE_BATCH) {
    const { error } = await admin.storage.from(bucket).remove(list.slice(i, i + REMOVE_BATCH));
    if (error) throw new Error(`Could not remove files from ${bucket}: ${error.message}`);
  }
}

async function listPrefix(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const item of data) {
      if (item?.name) out.push(`${prefix}/${item.name}`);
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return out;
}

async function purgeUserStorage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
) {
  const { data: photos, error: photoErr } = await admin
    .from("photo_memories")
    .select("storage_path")
    .eq("user_id", userId);
  if (photoErr) throw new Error(photoErr.message);

  const { data: expenses, error: expenseErr } = await admin
    .from("expenses")
    .select("storage_path")
    .eq("user_id", userId);
  if (expenseErr) throw new Error(expenseErr.message);

  const photoFromRows = (photos ?? []).map((r: { storage_path: string }) => r.storage_path);
  const receiptFromRows = (expenses ?? []).map(
    (r: { storage_path: string | null }) => r.storage_path ?? "",
  );

  const listedPhotos = await listPrefix(admin, "photo-memories", userId);
  const listedReceipts = await listPrefix(admin, "receipts", userId);

  await removeInBatches(admin, "photo-memories", [...photoFromRows, ...listedPhotos]);
  await removeInBatches(admin, "receipts", [...receiptFromRows, ...listedReceipts]);
}

/**
 * Shared trips must outlive the deleting owner: hand ownership to another
 * member. Solo owned trips are left for the caller to delete (or Auth CASCADE).
 * Returns how many trips had ownership transferred (for partial-failure messaging).
 */
async function handOffOwnedSharedTrips(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
): Promise<{ transferred: number }> {
  const { data: owned, error: ownedErr } = await admin
    .from("trips")
    .select("id")
    .eq("owner_id", userId);
  if (ownedErr) throw new Error(ownedErr.message);

  let transferred = 0;
  try {
    for (const trip of owned ?? []) {
      const tripId = trip.id as string;
      const { data: members, error: memberErr } = await admin
        .from("trip_members")
        .select("user_id, role")
        .eq("trip_id", tripId);
      if (memberErr) throw new Error(memberErr.message);

      const successor = (members ?? []).find((m: { user_id: string }) => m.user_id !== userId) as
        { user_id: string; role: string } | undefined;

      if (!successor) continue;

      // Promote role first so a failed owner_id update stays retryable (trip still owned).
      const { error: roleErr } = await admin
        .from("trip_members")
        .update({ role: "owner" })
        .eq("trip_id", tripId)
        .eq("user_id", successor.user_id);
      if (roleErr) throw new Error(roleErr.message);

      const { error: ownerErr } = await admin
        .from("trips")
        .update({ owner_id: successor.user_id })
        .eq("id", tripId)
        .eq("owner_id", userId);
      if (ownerErr) throw new Error(ownerErr.message);
      transferred += 1;
    }
  } catch (e) {
    if (transferred > 0) {
      const detail = e instanceof Error ? e.message : "Unknown error";
      const err = new Error(detail) as Error & { transferred: number };
      err.transferred = transferred;
      throw err;
    }
    throw e;
  }
  return { transferred };
}

async function deleteWhere(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
  column: string,
  userId: string,
) {
  const { error } = await admin.from(table).delete().eq(column, userId);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function nullCreatedBy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
  columns: string[],
  userId: string,
) {
  for (const column of columns) {
    const { error } = await admin
      .from(table)
      .update({ [column]: null })
      .eq(column, userId);
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
  }
}

/**
 * Wipe travel content for a fresh start. Keeps Auth + profiles row (name/avatar).
 * Shared trips hand off; solo trips and memberships are removed.
 *
 * Ordered so private content goes first; trip handoff is last irreversible
 * ownership change. Steps are idempotent — a failed erase can be retried.
 */
async function wipeUserContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
) {
  // Storage + private rows before trip handoff, so a mid-wipe failure does not
  // strand the user without ownership of shared trips while their vault still exists.
  await purgeUserStorage(admin, userId);

  await deleteWhere(admin, "recommendations", "user_id", userId);
  await deleteWhere(admin, "future_notes", "user_id", userId);
  await deleteWhere(admin, "photo_memories", "user_id", userId);
  await deleteWhere(admin, "expenses", "user_id", userId);
  await deleteWhere(admin, "packing_lists", "user_id", userId);
  await deleteWhere(admin, "packing_items", "user_id", userId);
  await deleteWhere(admin, "vault_documents", "user_id", userId);
  await deleteWhere(admin, "vault_settings", "user_id", userId);
  await deleteWhere(admin, "app_reports", "user_id", userId);

  // Rate-limit log may be absent on older DBs; ignore missing-table errors.
  {
    const { error } = await admin.from("trip_invite_attempts").delete().eq("user_id", userId);
    if (error && !/relation|does not exist|schema cache/i.test(error.message)) {
      throw new Error(`trip_invite_attempts: ${error.message}`);
    }
  }

  let handedOffSharedTrips = false;
  let deletedSoloTrips = false;
  try {
    const { transferred } = await handOffOwnedSharedTrips(admin, userId);
    if (transferred > 0) handedOffSharedTrips = true;

    // Remaining owned trips are solo — cascade trip-scoped children.
    await deleteWhere(admin, "trips", "owner_id", userId);
    deletedSoloTrips = true;
    await deleteWhere(admin, "trip_members", "user_id", userId);
    await deleteWhere(admin, "trip_invites", "invited_by", userId);

    await nullCreatedBy(admin, "itinerary_items", ["created_by", "updated_by"], userId);
    await nullCreatedBy(admin, "trip_stops", ["created_by"], userId);
    await nullCreatedBy(admin, "trip_budget_items", ["created_by"], userId);

    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        home_city: null,
        preferences: [],
        travel_style: null,
        budget_level: null,
        trip_pace: null,
        preferred_countries: [],
        dietary_notes: null,
        avoid_notes: null,
        home_currency: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (profileErr) throw new Error(profileErr.message);
  } catch (e) {
    const transferredDuringFailure =
      typeof e === "object" &&
      e !== null &&
      "transferred" in e &&
      typeof (e as { transferred: unknown }).transferred === "number" &&
      (e as { transferred: number }).transferred > 0;
    const partial = handedOffSharedTrips || deletedSoloTrips || transferredDuringFailure;
    if (partial) {
      const detail = e instanceof Error ? e.message : "Unknown error";
      const stage = deletedSoloTrips
        ? "trips were removed"
        : handedOffSharedTrips || transferredDuringFailure
          ? "shared-trip handoff"
          : "trips were removed";
      throw new Error(
        `Erase was interrupted after ${stage} (${detail}). Tap Erase again to finish — the remaining steps are safe to retry.`,
      );
    }
    throw e;
  }
}

/**
 * Erase all travel data but keep the signed-in account (start fresh).
 */
export const eraseMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        confirm: z.literal("ERASE"),
      })
      .parse(data),
  )
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await wipeUserContent(supabaseAdmin, context.userId);
    return { ok: true as const };
  });

/**
 * Permanently delete the signed-in account: purge Storage, hand off shared
 * trips, then Auth user (remaining DB rows cascade from auth.users).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        confirm: z.literal("DELETE"),
      })
      .parse(data),
  )
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Reversible/idempotent cleanup before ownership handoff.
    await purgeUserStorage(supabaseAdmin, userId);

    let transferred = 0;
    try {
      transferred = (await handOffOwnedSharedTrips(supabaseAdmin, userId)).transferred;

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message || "Could not delete account");
    } catch (e) {
      const partial =
        transferred > 0 ||
        (typeof e === "object" &&
          e !== null &&
          "transferred" in e &&
          typeof (e as { transferred: unknown }).transferred === "number" &&
          (e as { transferred: number }).transferred > 0);
      if (partial) {
        const detail = e instanceof Error ? e.message : "Unknown error";
        throw new Error(
          `Account delete was interrupted after shared-trip handoff (${detail}). Tap Delete again to finish — remaining steps are safe to retry.`,
        );
      }
      throw e;
    }

    return { ok: true as const };
  });
