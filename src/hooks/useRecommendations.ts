import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pin, PinType } from "@/data/atlas";

export type RecoRowDB = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  category: string | null;
  notes: string | null;
  recommended_by: string | null;
  source: string | null;
  url: string | null;
  lat: number | null;
  lon: number | null;
  visited: boolean;
  pin_type: string | null;
  created_at: string;
};

export type NewReco = {
  name: string;
  city?: string | undefined;
  country?: string | undefined;
  address?: string | undefined;
  category?: string | undefined;
  notes?: string | undefined;
  recommended_by?: string | undefined;
  source?: string | undefined;
  url?: string | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  pin_type?: PinType | undefined;
};

export function recoToPin(r: RecoRowDB): Pin | null {
  if (r.lat == null || r.lon == null) return null;
  return {
    id: `reco-${r.id}`,
    type: (r.pin_type ?? "reco") as PinType,
    name: r.name,
    city: r.city ?? "",
    country: r.country ?? "",
    lat: r.lat,
    lon: r.lon,
    ...(r.category ? { category: r.category } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    ...(r.recommended_by ? { recommendedBy: r.recommended_by } : {}),
    ...(r.source ? { source: r.source } : {}),
    dateAdded: r.created_at.slice(0, 10),
  };
}

export function useRecommendations() {
  const [rows, setRows] = useState<RecoRowDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  const reload = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    setSignedIn(!!session.session);
    if (!session.session) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("recommendations")
      .select(
        "id, name, city, country, address, category, notes, recommended_by, source, url, lat, lon, visited, pin_type, created_at",
      )
      .order("created_at", { ascending: false });
    setRows((data ?? []) as RecoRowDB[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void reload());
    return () => sub.subscription.unsubscribe();
  }, [reload]);

  const add = useCallback(
    async (reco: NewReco) => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error("Sign in to save recommendations");
      const { error } = await supabase.from("recommendations").insert({
        user_id: uid,
        name: reco.name,
        city: reco.city ?? null,
        country: reco.country ?? null,
        address: reco.address ?? null,
        category: reco.category ?? null,
        notes: reco.notes ?? null,
        recommended_by: reco.recommended_by ?? null,
        source: reco.source ?? null,
        url: reco.url ?? null,
        lat: reco.lat ?? null,
        lon: reco.lon ?? null,
        pin_type: reco.pin_type ?? "reco",
      });
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("recommendations").delete().eq("id", id);
      await reload();
    },
    [reload],
  );

  return { rows, loading, signedIn, add, remove, reload, pins: rows.map(recoToPin).filter(Boolean) as Pin[] };
}
