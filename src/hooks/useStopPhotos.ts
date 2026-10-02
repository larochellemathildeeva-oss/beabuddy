import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** What one pick added, and what it left out. */
export type StopPhotosAdded = {
  added: number;
  /** Picked but not photos, or over STOP_PHOTOS_PER_PICK: never tried. */
  skipped: number;
  /** Photos not added because a failure stopped the batch, the failed one included. */
  failed: number;
  error?: unknown;
};

/** More than this at once is a camera-roll import, which the Photos page is for. */
export const STOP_PHOTOS_PER_PICK = 20;
const PAGE = 1000;

/**
 * Photos travellers added to a trip's stops: read once for the whole trip,
 * not per card. Each is also a photo memory of whoever added it, and the
 * database ties it to the stop's trip, so everyone on the trip sees it.
 *
 * `available` is false only while the stop_photos migration is not applied
 * (the columns do not exist); a failed read keeps what was shown and is
 * asked again when the app comes back to the screen.
 */
export function useStopPhotos(
  tripId: string,
  uid: string | null,
  trip?: { city?: string | null; country?: string | null },
) {
  const [photos, setPhotos] = useState<StopPhoto[]>([]);
  const [available, setAvailable] = useState(true);
  /** The latest read: an older one finishing late is dropped. */
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    const all: StopPhoto[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("photo_memories")
        .select("id, user_id, storage_path, itinerary_item_id, taken_at")
        .eq("trip_id", tripId)
        .not("itinerary_item_id", "is", null)
        .order("taken_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (mine !== generation.current) return;
      if (error) {
        // 42703: no such column, so the migration is not applied yet.
        if (error.code === "42703") setAvailable(false);
        return;
      }
      all.push(...((data ?? []) as StopPhoto[]));
      if ((data ?? []).length < PAGE) break;
    }
    setAvailable(true);
    setPhotos(all);
  }, [tripId]);

  useEffect(() => {
    setPhotos([]);
    void load();
    const onShow = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      // Whatever is still on its way belongs to a trip no longer shown.
      generation.current += 1;
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [load]);

  const byStop = useMemo(() => {
    const map = new Map<string, StopPhoto[]>();
    for (const p of photos) {
      map.set(p.itinerary_item_id, [...(map.get(p.itinerary_item_id) ?? []), p]);
    }
    return map;
  }, [photos]);

  /**
   * Upload photos to one stop, in order, stopping at the first failure. The
   * photos before it are kept, and the count says so, so a retry is of the
   * rest only.
   */
  const add = useCallback(
    async (item: ItineraryRow, files: File[]): Promise<StopPhotosAdded> => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      const picked = images.slice(0, STOP_PHOTOS_PER_PICK);
      const skipped = files.length - picked.length;
      if (!picked.length || !uid) return { added: 0, skipped, failed: 0 };
      // Photos added to a stop were taken there: pinned at the stop and
      // named after its town (asked once for the batch). A stop with no
      // place yet gives the trip's town and no pin, so the two never disagree.
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
            lat: placed ? item.lat : null,
            lon: placed ? item.lon : null,
            taken_at: exif.takenAt ?? new Date(file.lastModified).toISOString(),
          });
          if (error) {
            await supabase.storage.from("photo-memories").remove([path]);
            throw error;
          }
          added += 1;
        }
        return { added, skipped, failed: 0 };
      } catch (error) {
        return { added, skipped, failed: picked.length - added, error };
      } finally {
        if (added) await load();
      }
    },
    [uid, trip?.city, trip?.country, load],
  );

  /**
   * Delete one of your own photos: from the stop and from your Photo
   * memories. The file goes first, so a failure leaves the row there to try
   * again rather than a file nobody can reach.
   */
  const remove = useCallback(async (photo: StopPhoto) => {
    const { error: fileError } = await supabase.storage
      .from("photo-memories")
      .remove([photo.storage_path]);
    if (fileError) throw fileError;
    const { error } = await supabase.from("photo_memories").delete().eq("id", photo.id);
    if (error) throw error;
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
  }, []);

  return { available, byStop, add, remove };
}
