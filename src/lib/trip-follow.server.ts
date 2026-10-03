import type { SupabaseClient } from "@supabase/supabase-js";
import { readSharedTrip } from "@/lib/trip-share.server";
import { followedTripCard, type FollowedTrip, type FollowState } from "@/lib/trip-follow";

/**
 * "Following" a shared trip, kept in `trip_follows`. Rows are written only
 * here, after the link's token has been checked, so following never reaches
 * further than the link itself: the trip is read through the link, in its
 * fixed view, and leaves the list when the link is turned off or expires.
 */

/** How many followed trips one list asks for: each is a read of its plan. */
export const FOLLOW_LIST_MAX = 20;

type DbError = { message?: string; code?: string } | null;

/** The table arrives with a migration applied by hand. */
function isMissingTable(error: DbError): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /trip_follows|schema cache|does not exist/i.test(error.message ?? "")
  );
}

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/** The link a token opens, while it is on; null for unknown, turned off or expired. */
async function activeLinkId(db: SupabaseClient, token: string): Promise<string | null> {
  const { data } = (await db
    .from("trip_share_links")
    .select("id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle()) as {
    data: { id: string; expires_at: string; revoked_at: string | null } | null;
  };
  if (!data || data.revoked_at || Date.parse(data.expires_at) < Date.now()) return null;
  return data.id;
}

/** Whether this traveller follows the trip a token opens. */
export async function followState(userId: string, token: string): Promise<FollowState> {
  const db = await admin();
  const linkId = await activeLinkId(db, token);
  if (!linkId) return "gone";
  const { data, error } = await db
    .from("trip_follows")
    .select("link_id")
    .eq("user_id", userId)
    .eq("link_id", linkId)
    .maybeSingle();
  if (isMissingTable(error)) return "unavailable";
  if (error) throw new Error("Following didn't load. Try again.");
  return data ? "following" : "not-following";
}

/** Follow (or stop following) the trip a token opens. */
export async function setFollowing(
  userId: string,
  token: string,
  on: boolean,
): Promise<FollowState> {
  const db = await admin();
  const linkId = await activeLinkId(db, token);
  if (!linkId) return "gone";
  const { error } = on
    ? await db
        .from("trip_follows")
        .upsert(
          { user_id: userId, link_id: linkId },
          { onConflict: "user_id,link_id", ignoreDuplicates: true },
        )
    : await db.from("trip_follows").delete().eq("user_id", userId).eq("link_id", linkId);
  if (isMissingTable(error)) return "unavailable";
  if (error) throw new Error("That didn't save. Try again.");
  return on ? "following" : "not-following";
}

/**
 * The trips this traveller follows, newest first, each read through its
 * link. A link that is off or expired drops out, and its row is cleared.
 * Null when following is not set up yet.
 */
export async function listFollowed(userId: string): Promise<FollowedTrip[] | null> {
  const db = await admin();
  const { data: rows, error } = (await db
    .from("trip_follows")
    .select("link_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(FOLLOW_LIST_MAX)) as { data: { link_id: string }[] | null; error: DbError };
  if (isMissingTable(error)) return null;
  if (error) throw new Error("Following didn't load. Try again.");
  if (!rows?.length) return [];

  const ids = rows.map((r) => r.link_id);
  const { data: links } = (await db
    .from("trip_share_links")
    .select("id, token, expires_at, revoked_at")
    .in("id", ids)) as {
    data: { id: string; token: string; expires_at: string; revoked_at: string | null }[] | null;
  };
  const byId = new Map((links ?? []).map((l) => [l.id, l]));
  const gone: string[] = [];
  const cards = await Promise.all(
    ids.map(async (id) => {
      const link = byId.get(id);
      if (!link || link.revoked_at || Date.parse(link.expires_at) < Date.now()) {
        gone.push(id);
        return null;
      }
      const trip = await readSharedTrip(link.token).catch(() => null);
      return trip ? followedTripCard(link.token, trip) : null;
    }),
  );
  if (gone.length) {
    await db.from("trip_follows").delete().eq("user_id", userId).in("link_id", gone);
  }
  return cards.filter((c): c is FollowedTrip => c !== null);
}
