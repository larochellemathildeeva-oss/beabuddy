import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ItineraryRow } from "@/hooks/useTrips";
import { readExif } from "@/lib/exif";
import { reverseGeocode } from "@/lib/geocode";
import { uploadPhotoFile } from "@/lib/photo-upload";

export type StopPhoto = {
  id: string;
  user_id: string;
  storage_path: string;
  itinerary_item_id: string;
  taken_at: string | null;
};

/** More than this at once is a camera-roll import, which the Photos page is for. */
export const STOP_PHOTOS_PER_PICK = 20;

/**
 * Photos travellers added to a trip's stops: read once for the whole trip,
 * not per card. Each is also a photo memory of whoever added it, and the
 * database ties it to the stop's trip, so everyone on the trip sees it.
 *
 * `ready` is false while the stop_photos migration is not applied: the
 * columns do not answer, so the stop sheet says photos are not set up yet.
 */
export function useStopPhotos(
  tripId: string,
  uid: string | null,
  trip?: { city?: string | null; country?: string | null },
) {
  const [photos, setPhotos] = useState<StopPhoto[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("photo_memories")
      .select("id, user_id, storage_path, itinerary_item_id, taken_at")
      .eq("trip_id", tripId)
      .not("itinerary_item_id", "is", null)
      .order("taken_at", { ascending: true })
      .limit(1000);
    if (error) {
      setReady(false);
      return;
    }
    setReady(true);
    setPhotos((data ?? []) as StopPhoto[]);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byStop = useMemo(() => {
    const map = new Map<string, StopPhoto[]>();
    for (const p of photos) {
      map.set(p.itinerary_item_id, [...(map.get(p.itinerary_item_id) ?? []), p]);
    }
    return map;
  }, [photos]);

  /** Upload photos to one stop. Returns how many were added; throws on the first failure. */
  const add = useCallback(
    async (item: ItineraryRow, files: File[]) => {
      const picked = files
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, STOP_PHOTOS_PER_PICK);
      if (!picked.length || !uid) return 0;
      // Where the photos were taken, for the Photos page and the globe: the
      // stop's town, asked once for the batch, else the trip's.
      const placed = item.lat != null && item.lon != null;
      const town = placed ? await reverseGeocode(item.lat!, item.lon!) : null;
      const city = town?.city || trip?.city || null;
      const country = town?.country || trip?.country || null;
      let added = 0;
      try {
        for (const file of picked) {
          const exif = await readExif(file);
          const path = await uploadPhotoFile(uid, file);
          const { error } = await supabase.from("photo_memories").insert({
            user_id: uid,
            storage_path: path,
            itinerary_item_id: item.id,
            // Set by the database from the stop as well; sent so the row
            // reads the same before the trigger is there to fill it.
            trip_id: item.trip_id,
            city,
            country,
            lat: exif.lat ?? item.lat ?? null,
            lon: exif.lon ?? item.lon ?? null,
            taken_at: exif.takenAt ?? new Date(file.lastModified).toISOString(),
          });
          if (error) {
            await supabase.storage.from("photo-memories").remove([path]);
            throw error;
          }
          added += 1;
        }
      } finally {
        if (added) await load();
      }
      return added;
    },
    [uid, trip?.city, trip?.country, load],
  );

  /** Delete one of your own photos: from the stop and from your Photo memories. */
  const remove = useCallback(async (photo: StopPhoto) => {
    const { error } = await supabase.from("photo_memories").delete().eq("id", photo.id);
    if (error) throw error;
    await supabase.storage.from("photo-memories").remove([photo.storage_path]);
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
  }, []);

  return { ready, byStop, add, remove };
}
