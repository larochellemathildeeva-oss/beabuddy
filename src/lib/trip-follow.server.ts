import type { SupabaseClient } from "@supabase/supabase-js";
import { readSharedTrip } from "@/lib/trip-share.server";
import { TileRateLimiter } from "@/lib/tile-rate-limit";
import { followedTripCard, type FollowedTrip, type FollowState } from "@/lib/trip-follow";

/**
 * "Following" a shared trip, kept in `trip_follows`. Rows are written only
 * here, after the link's token has been checked, so following never reaches
 * further than the link itself: the trip is read through the link, in its
 * fixed view, and leaves the list when the link is turned off or expires.
 */

/**
 * How many trips one traveller may follow. The whole list is read each time
 * Trips opens (each trip a read of its plan), so it is capped here rather
 * than paged: past the cap, following another asks to stop one first.
 */
export const FOLLOW_MAX = 20;

/** Plans read at once while building the list, so twenty do not land together. */
const READS_AT_ONCE = 4;

/**
 * Each list reads up to twenty plans without the shared page's own limits,
 * so it has one of its own: per traveller, generous for opening Trips, not
 * for hammering it. Per process, like the other request limits.
 */
const listLimiter = new TileRateLimiter(30, 10 * 60 * 1000, 5_000);

const LOAD_FAILED = "Following didn't load. Try again.";

type DbError = { message?: string; code?: string } | null;

/** The table arrives with a migration applied by hand; only that, not any error naming it. */
function isMissingTable(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /relation "(public\.)?trip_follows" does not exist|could not find the table '(public\.)?trip_follows'/i.test(
    error.message ?? "",
  );
}

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/**
 * The link a token opens, while it is on; null for unknown, turned off or
 * expired. A failed read throws, so a valid link is never reported as gone.
 */
async function activeLinkId(db: SupabaseClient, token: string): Promise<string | null> {
  const { data, error } = (await db
    .from("trip_share_links")
    .select("id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle()) as {
    data: { id: string; expires_at: string; revoked_at: string | null } | null;
    error: DbError;
  };
  if (error) throw new Error(LOAD_FAILED);
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
  if (error) throw new Error(LOAD_FAILED);
  return data ? "following" : "not-following";
}

/** Follow (or stop following) the trip a token opens; "full" past FOLLOW_MAX. */
export async function setFollowing(
  userId: string,
  token: string,
  on: boolean,
): Promise<FollowState> {
  const db = await admin();
  const linkId = await activeLinkId(db, token);
  if (!linkId) return "gone";
  if (!on) {
    const { error } = await db
      .from("trip_follows")
      .delete()
      .eq("user_id", userId)
      .eq("link_id", linkId);
    if (isMissingTable(error)) return "unavailable";
    if (error) throw new Error("That didn't save. Try again.");
    return "not-following";
  }
  const { count, error: countError } = await db
    .from("trip_follows")
    .select("link_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("link_id", linkId);
  if (isMissingTable(countError)) return "unavailable";
  if (countError) throw new Error("That didn't save. Try again.");
  if ((count ?? 0) >= FOLLOW_MAX) return "full";
  const { error } = await db
    .from("trip_follows")
    .upsert(
      { user_id: userId, link_id: linkId },
      { onConflict: "user_id,link_id", ignoreDuplicates: true },
    );
  if (isMissingTable(error)) return "unavailable";
  if (error) throw new Error("That didn't save. Try again.");
  return "following";
}

/** Read the plans a few at a time, in order. */
async function inBatches<T, R>(
  items: T[],
  size: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  }
  return out;
}

/**
 * The trips this traveller follows, newest first, each read through its
 * link. A link that is off or expired drops out, and its row is cleared;
 * any failed read throws, so a partial list is never shown as the whole.
 * Null when following is not set up yet.
 */
export async function listFollowed(userId: string): Promise<FollowedTrip[] | null> {
  if (!listLimiter.allow(userId, Date.now())) {
    throw new Error("Following was opened a lot just now. Try again in a few minutes.");
  }
  const db = await admin();
  const { data: rows, error } = (await db
    .from("trip_follows")
    .select("link_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(FOLLOW_MAX)) as { data: { link_id: string }[] | null; error: DbError };
  if (isMissingTable(error)) return null;
  if (error) throw new Error(LOAD_FAILED);
  if (!rows?.length) return [];

  const ids = rows.map((r) => r.link_id);
  const { data: links, error: linksError } = (await db
    .from("trip_share_links")
    .select("id, token, expires_at, revoked_at")
    .in("id", ids)) as {
    data: { id: string; token: string; expires_at: string; revoked_at: string | null }[] | null;
    error: DbError;
  };
  // Only a read that worked may say a link is gone: a failed one must not
  // clear the traveller's list.
  if (linksError || !links) throw new Error(LOAD_FAILED);
  const byId = new Map(links.map((l) => [l.id, l]));
  const gone: string[] = [];
  const live = ids.flatMap((id) => {
    const link = byId.get(id);
    if (!link || link.revoked_at || Date.parse(link.expires_at) < Date.now()) {
      gone.push(id);
      return [];
    }
    return [link];
  });
  const cards = await inBatches(live, READS_AT_ONCE, async (link) => {
    const trip = await readSharedTrip(link.token);
    return trip ? followedTripCard(link.token, trip) : null;
  });
  if (gone.length) {
    await db.from("trip_follows").delete().eq("user_id", userId).in("link_id", gone);
  }
  return cards.filter((c): c is FollowedTrip => c !== null);
}
