import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumn } from "@/lib/bookings";
import { sharedTripView, type ShareSourceItem, type SharedTrip } from "@/lib/trip-share";

/**
 * Open a share link: the token looked up with the service role, and the
 * fixed view of the plan built from exactly the columns it needs. Null for
 * a token that is unknown, revoked or expired — the page says the same
 * thing for all three, so a guess learns nothing.
 */
export async function readSharedTrip(token: string): Promise<SharedTrip | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as SupabaseClient;
  const link = await readLink(db, token);
  if (!link || link.revoked_at || Date.parse(link.expires_at) < Date.now()) return null;
  const following = link.follow_along === true;

  const [{ data: trip }, rows] = await Promise.all([
    db
      .from("trips")
      .select("title, city, country, start_date, end_date")
      .eq("id", link.trip_id)
      .maybeSingle(),
    readItems(db, link.trip_id, following),
  ]);
  if (!trip) return null;
  return sharedTripView(trip as Parameters<typeof sharedTripView>[0], rows, {
    following,
    now: Date.now(),
  });
}

type LinkRow = {
  trip_id: string;
  expires_at: string;
  revoked_at: string | null;
  follow_along?: boolean;
};

/** The link, with "follow along" when its migration is in; without it, never. */
async function readLink(db: SupabaseClient, token: string): Promise<LinkRow | null> {
  for (const columns of [
    "trip_id, expires_at, revoked_at, follow_along",
    "trip_id, expires_at, revoked_at",
  ]) {
    const { data, error } = await db
      .from("trip_share_links")
      .select(columns)
      .eq("token", token)
      .maybeSingle();
    if (!error) return data as LinkRow | null;
    if (!isMissingColumn(error, ["follow_along"])) return null;
  }
  return null;
}

/**
 * The plan's rows, asking for the least each older database has: progress
 * only for a link that follows along, and no parent_id or progress where
 * their migrations are not in.
 */
async function readItems(
  db: SupabaseClient,
  tripId: string,
  following: boolean,
): Promise<ShareSourceItem[]> {
  const base = "day_date, time_label, kind, title, address, position";
  const attempts = [
    ...(following ? [`${base}, parent_id, arrived_at, left_at`] : []),
    `${base}, parent_id`,
    base,
  ];
  for (const columns of attempts) {
    const { data, error } = await db
      .from("itinerary_items")
      .select(columns)
      .eq("trip_id", tripId)
      .limit(500);
    if (!error) return (data ?? []) as unknown as ShareSourceItem[];
  }
  return [];
}
