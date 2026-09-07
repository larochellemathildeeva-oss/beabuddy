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
 * Permanently delete the signed-in account: Storage objects for this user,
 * then Auth user (DB rows cascade from auth.users).
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

    await purgeUserStorage(supabaseAdmin, userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message || "Could not delete account");

    return { ok: true as const };
  });
