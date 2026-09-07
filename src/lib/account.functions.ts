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
 * member. Solo owned trips are left for auth.users CASCADE to remove.
 */
async function handOffOwnedSharedTrips(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
) {
  const { data: owned, error: ownedErr } = await admin
    .from("trips")
    .select("id")
    .eq("owner_id", userId);
  if (ownedErr) throw new Error(ownedErr.message);

  for (const trip of owned ?? []) {
    const tripId = trip.id as string;
    const { data: members, error: memberErr } = await admin
      .from("trip_members")
      .select("user_id, role")
      .eq("trip_id", tripId);
    if (memberErr) throw new Error(memberErr.message);

    const successor = (members ?? []).find(
      (m: { user_id: string }) => m.user_id !== userId,
    ) as { user_id: string; role: string } | undefined;

    if (!successor) continue;

    const { error: ownerErr } = await admin
      .from("trips")
      .update({ owner_id: successor.user_id })
      .eq("id", tripId)
      .eq("owner_id", userId);
    if (ownerErr) throw new Error(ownerErr.message);

    const { error: roleErr } = await admin
      .from("trip_members")
      .update({ role: "owner" })
      .eq("trip_id", tripId)
      .eq("user_id", successor.user_id);
    if (roleErr) throw new Error(roleErr.message);
  }
}

/**
 * Permanently delete the signed-in account: hand off shared trips, purge
 * Storage, then Auth user (remaining DB rows cascade from auth.users).
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

    await handOffOwnedSharedTrips(supabaseAdmin, userId);
    await purgeUserStorage(supabaseAdmin, userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message || "Could not delete account");

    return { ok: true as const };
  });
