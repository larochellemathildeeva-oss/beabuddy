import type { SupabaseClient } from "@supabase/supabase-js";
import { sharedTripView, type SharedTrip } from "@/lib/trip-share";

/**
 * Open a share link: the token looked up with the service role, and the
 * fixed view of the plan built from exactly the columns it needs. Null for
 * a token that is unknown, revoked or expired — the page says the same
 * thing for all three, so a guess learns nothing.
 */
export async function readSharedTrip(token: string): Promise<SharedTrip | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as SupabaseClient;
  const { data: link } = await db
    .from("trip_share_links")
    .select("trip_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  const row = link as { trip_id: string; expires_at: string; revoked_at: string | null } | null;
  if (!row || row.revoked_at || Date.parse(row.expires_at) < Date.now()) return null;

  const [{ data: trip }, { data: items }] = await Promise.all([
    db
      .from("trips")
      .select("title, city, country, start_date, end_date")
      .eq("id", row.trip_id)
      .maybeSingle(),
    db
      .from("itinerary_items")
      .select("day_date, time_label, kind, title, address, position, parent_id")
      .eq("trip_id", row.trip_id)
      .limit(500),
  ]);
  if (!trip) return null;
  // Without the nesting migration there is no parent_id: ask again without it.
  const rows =
    items ??
    (
      await db
        .from("itinerary_items")
        .select("day_date, time_label, kind, title, address, position")
        .eq("trip_id", row.trip_id)
        .limit(500)
    ).data ??
    [];
  return sharedTripView(trip as Parameters<typeof sharedTripView>[0], rows as never);
}
