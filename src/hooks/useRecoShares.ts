import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateInviteCode } from "@/lib/trip-invite";
import {
  sharedListFromRows,
  toShareItems,
  type ShareableReco,
  type SharedList,
} from "@/lib/reco-share";

export type ShareRow = {
  id: string;
  code: string;
  title: string | null;
  note: string | null;
  use_count: number;
  max_uses: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

const SHARE_COLS = "id, code, title, note, use_count, max_uses, expires_at, revoked_at, created_at";

/** True when the live database has not had the reco share migration run yet. */
function isMissingShareTable(error: { message?: string; code?: string } | null): boolean {
  const text = `${error?.message ?? ""}`.toLowerCase();
  return (
    error?.code === "42P01" ||
    (text.includes("reco_share") &&
      (text.includes("does not exist") || text.includes("schema cache")))
  );
}

/** Shares this account has handed out, and the making of new ones. */
export function useRecoShares(uid: string | null) {
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!uid) {
      setShares([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("reco_shares")
      .select(SHARE_COLS)
      .eq("owner_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      setUnavailable(isMissingShareTable(error));
      setShares([]);
    } else {
      setUnavailable(false);
      setShares((data ?? []) as ShareRow[]);
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  /**
   * Snapshot the picked places behind a fresh code.
   *
   * The items are written after the share row, so a failure halfway leaves an
   * empty share rather than a share of somebody else's rows. An empty share
   * reads as "nothing here" and can be stopped; there is no state where a code
   * points at more than what was ticked.
   */
  const createShare = useCallback(
    async (input: {
      recos: ShareableReco[];
      title: string;
      note?: string;
      includeNotes?: boolean;
      sharedByName?: string;
    }): Promise<ShareRow> => {
      if (!uid) throw new Error("Sign in to share places");
      if (input.recos.length === 0) throw new Error("Pick at least one place to share");

      const code = generateInviteCode();
      const { data, error } = await supabase
        .from("reco_shares")
        .insert({
          owner_id: uid,
          code,
          title: input.title.trim() || null,
          note: input.note?.trim() || null,
          shared_by_name: input.sharedByName?.trim() || null,
        })
        .select(SHARE_COLS)
        .single();
      if (error) throw error;

      const share = data as ShareRow;
      const items = toShareItems(share.id, input.recos, {
        ...(input.includeNotes === undefined ? {} : { includeNotes: input.includeNotes }),
      });
      const { error: itemsError } = await supabase.from("reco_share_items").insert(items);
      if (itemsError) {
        // Leave nothing half-shared behind.
        await supabase.from("reco_shares").delete().eq("id", share.id);
        throw itemsError;
      }

      await load();
      return share;
    },
    [uid, load],
  );

  /** Stop a share. The places already kept by others stay theirs. */
  const stopShare = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("reco_shares")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const deleteShare = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("reco_shares").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  return { shares, loading, unavailable, createShare, stopShare, deleteShare, reload: load };
}

/**
 * Open someone else's share by code.
 *
 * The attempt is logged first and separately: `read_reco_share` is STABLE so it
 * cannot write, and counting the try before the lookup is what makes the rate
 * limit mean anything — a wrong code has to cost the same as a right one.
 */
export async function readSharedList(code: string): Promise<SharedList | null> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) throw new Error("Paste the code you were sent");

  const { error: logError } = await supabase.rpc("log_reco_share_attempt");
  if (logError) throw logError;

  const { data, error } = await supabase.rpc("read_reco_share", { _code: cleaned });
  if (error) throw error;
  return sharedListFromRows((data ?? []) as Parameters<typeof sharedListFromRows>[0]);
}

/** Mark a share as taken, once the recipient has actually kept something. */
export async function claimSharedList(code: string): Promise<void> {
  const { error } = await supabase.rpc("claim_reco_share", { _code: code.trim().toUpperCase() });
  if (error) throw error;
}
