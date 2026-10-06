import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumn } from "@/lib/bookings";
import {
  pickSharedPhotos,
  sharedTripView,
  type ShareSourceItem,
  type ShareSourcePhoto,
  type SharedPhoto,
  type SharedTrip,
} from "@/lib/trip-share";

/**
 * Open a share link: the token looked up with the service role, and the
 * fixed view of the plan built from exactly the columns it needs. Null for
 * a token that is unknown, revoked or expired — the page says the same
 * thing for all three, so a guess learns nothing.
 */
export async function readSharedTrip(
  token: string,
  options: { photos?: boolean } = {},
): Promise<SharedTrip | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as SupabaseClient;
  const link = await readLink(db, token);
  if (!link || link.revoked_at || Date.parse(link.expires_at) < Date.now()) return null;
  const following = link.follow_along === true;

  const [{ data: trip }, rows, photos] = await Promise.all([
    db
      .from("trips")
      .select("title, city, country, start_date, end_date")
      .eq("id", link.trip_id)
      .maybeSingle(),
    readItems(db, link.trip_id, following),
    link.include_photos === true && options.photos !== false
      ? readPhotos(db, link.trip_id, link.created_by)
      : Promise.resolve(undefined),
  ]);
  if (!trip) return null;
  const { default: tzlookup } = await import("@photostructure/tz-lookup");
  const zoneAt = (lat: number, lon: number): string | null => {
    try {
      return tzlookup(lat, lon);
    } catch {
      return null;
    }
  };
  return sharedTripView(
    trip as Parameters<typeof sharedTripView>[0],
    rows,
    { following, now: Date.now() },
    zoneAt,
    photos,
  );
}

type LinkRow = {
  trip_id: string;
  expires_at: string;
  revoked_at: string | null;
  follow_along?: boolean;
  include_photos?: boolean;
  created_by?: string;
};

/** The link, with "follow along" when its migration is in; without it, never. */
async function readLink(db: SupabaseClient, token: string): Promise<LinkRow | null> {
  for (const columns of [
    "trip_id, expires_at, revoked_at, follow_along, include_photos, created_by",
    "trip_id, expires_at, revoked_at, follow_along",
    "trip_id, expires_at, revoked_at",
  ]) {
    const { data, error } = await db
      .from("trip_share_links")
      .select(columns)
      .eq("token", token)
      .maybeSingle();
    if (!error) return data as LinkRow | null;
    if (!isMissingColumn(error, ["follow_along", "include_photos"])) return null;
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
  const base = "id, day_date, time_label, kind, title, address, position, lat, lon";
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

/** Signed URLs kept until shortly before they lapse, so a refresh hands back the same ones. */
const SIGN_SECONDS = 3600;
const KEEP_MS = 40 * 60 * 1000;
const SIGNED_MAX = 2_000;
const signedUrls = new Map<string, { url: string; until: number }>();

/**
 * The photos a link may show. Only the ones the link's own maker added (a
 * link made by one traveller never shows what the others on the trip took),
 * read by exact columns — no position, caption or name — and only those the
 * owner has not kept off links. Where the hide flag is not in the database
 * yet, nothing is shown: a photo is never shown without being able to tell
 * whether it was hidden. Never throws; a failure shows fewer photos and is
 * logged, without detail for the viewer.
 */
async function readPhotos(
  db: SupabaseClient,
  tripId: string,
  madeBy: string | undefined,
): Promise<{ itemId: string | null; photo: SharedPhoto }[]> {
  if (!madeBy) return [];
  const { data, error } = await db
    .from("photo_memories")
    .select("user_id, storage_path, itinerary_item_id, taken_at, hidden_from_links")
    .eq("trip_id", tripId)
    .eq("user_id", madeBy)
    .eq("hidden_from_links", false)
    .order("taken_at", { ascending: true })
    .limit(500);
  if (error || !data) {
    console.error("shared trip photos: read failed", {
      tripId,
      code: (error as { code?: string } | null)?.code,
    });
    return [];
  }
  const picked = pickSharedPhotos(data as unknown as ShareSourcePhoto[]);
  if (!picked.length) return [];
  const now = Date.now();
  const missing = picked
    .map((p) => p.storage_path)
    .filter((path) => {
      const hit = signedUrls.get(path);
      return !hit || hit.until <= now;
    });
  if (missing.length) {
    const { data: signed, error: signError } = await db.storage
      .from("photo-memories")
      .createSignedUrls(missing, SIGN_SECONDS);
    if (signError || !signed) {
      console.error("shared trip photos: signing failed", { tripId });
      return [];
    }
    for (const item of signed) {
      if (!item.path || !item.signedUrl) continue;
      signedUrls.set(item.path, { url: item.signedUrl, until: now + KEEP_MS });
    }
    while (signedUrls.size > SIGNED_MAX) {
      const oldest = signedUrls.keys().next().value;
      if (oldest === undefined) break;
      signedUrls.delete(oldest);
    }
  }
  return picked.flatMap((row) => {
    const url = signedUrls.get(row.storage_path)?.url;
    return url ? [{ itemId: row.itinerary_item_id, photo: { url, takenAt: row.taken_at } }] : [];
  });
}
