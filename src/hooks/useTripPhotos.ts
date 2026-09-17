import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [photos, setPhotos] = useState<TripPhotoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("photo_memories")
      .select("id, storage_path, city, country, taken_at")
      .eq("user_id", uid)
      .order("taken_at", { ascending: false })
      .limit(400);
    // A trip card without a photo is a fine trip card, so a failure here is
    // never surfaced — it just means monograms.
    setPhotos(error ? [] : ((data ?? []) as TripPhotoRow[]));
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { photos, loading };
}

/** Signed URLs expire, so they are fetched when a card needs one and cached. */
const signedCache = new Map<string, { url: string; until: number }>();

export function useSignedPhoto(storagePath: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!storagePath) return null;
    const hit = signedCache.get(storagePath);
    return hit && hit.until > Date.now() ? hit.url : null;
  });

  useEffect(() => {
    if (!storagePath) {
      setUrl(null);
      return;
    }
    const hit = signedCache.get(storagePath);
    if (hit && hit.until > Date.now()) {
      setUrl(hit.url);
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
      setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return url;
}
