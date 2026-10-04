import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lastLoaded, rememberLoaded, screenGeneration } from "@/lib/screen-cache";

export type TripPhotoRow = {
  id: string;
  storage_path: string;
  city: string | null;
  country: string | null;
  taken_at: string | null;
};

/**
 * Every photo this account has placed, once, for the whole trips list.
 *
 * Loaded here rather than per card on purpose: a query per trip card is how
 * the recommendations hook once ended up mounted a dozen times on one screen.
 * Trip cards take their photo out of this one list.
 */
export function useTripPhotos(uid: string | null) {
  const [last] = useState(() => (uid ? lastLoaded<TripPhotoRow[]>(`photos:${uid}`) : undefined));
  const [photos, setPhotos] = useState<TripPhotoRow[]>(last ?? []);
  const [loading, setLoading] = useState(!last);

  const load = useCallback(async () => {
    if (!uid) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    const since = screenGeneration();
    const { data, error } = await supabase
      .from("photo_memories")
      .select("id, storage_path, city, country, taken_at")
      .eq("user_id", uid)
      .order("taken_at", { ascending: false })
      .limit(400);
    // A trip card without a photo is a fine trip card, so a failure here is
    // never surfaced — it just means monograms.
    const rows = error ? [] : ((data ?? []) as TripPhotoRow[]);
    setPhotos(rows);
    setLoading(false);
    if (!error) rememberLoaded(`photos:${uid}`, rows, since);
  }, [uid]);

  useEffect(() => {
    const hit = uid ? lastLoaded<TripPhotoRow[]>(`photos:${uid}`) : undefined;
    if (hit) setPhotos(hit);
    setLoading(!hit);
    void load();
  }, [uid, load]);

  return { photos, loading };
}

/** Signed URLs expire, so they are fetched when a card needs one and cached. */
const signedCache = new Map<string, { url: string; until: number }>();

export function useSignedPhoto(storagePath: string | null): string | null {
  // The URL is kept with the path it was signed for, so a change of path never
  // shows the previous photo while the new one is signed.
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(() => {
    if (!storagePath) return null;
    const hit = signedCache.get(storagePath);
    return hit && hit.until > Date.now() ? { path: storagePath, url: hit.url } : null;
  });

  useEffect(() => {
    if (!storagePath) {
      setSigned(null);
      return;
    }
    const hit = signedCache.get(storagePath);
    if (hit && hit.until > Date.now()) {
      setSigned({ path: storagePath, url: hit.url });
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.storage
        .from("photo-memories")
        .createSignedUrl(storagePath, 3600);
      if (cancelled || !data?.signedUrl) return;
      // Re-sign a little before the hour is up rather than at the edge.
      signedCache.set(storagePath, { url: data.signedUrl, until: Date.now() + 3_300_000 });
      setSigned({ path: storagePath, url: data.signedUrl });
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return signed && signed.path === storagePath ? signed.url : null;
}
