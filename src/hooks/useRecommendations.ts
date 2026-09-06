import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Pin, PinType } from "@/data/atlas";
import { isMissingTravelTagsColumn, tagsForSave } from "@/lib/reco-tags";

type RecoInsert = Database["public"]["Tables"]["recommendations"]["Insert"];

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
  travel_tags?: string[] | null;
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
  travel_tags?: string[] | undefined;
};

/** Cached after the first select/insert: the live DB may not have this column yet. */
let travelTagsColumnAvailable: boolean | null = null;

const RECO_COLS =
  "id, name, city, country, address, category, notes, recommended_by, source, url, lat, lon, visited, pin_type, created_at";
const RECO_COLS_WITH_TAGS = `${RECO_COLS}, travel_tags`;

function markTravelTagsUnavailable(error: { message?: string; code?: string } | null | undefined) {
  if (isMissingTravelTagsColumn(error)) {
    travelTagsColumnAvailable = false;
    return true;
  }
  return false;
}

function recoFields(r: RecoRowDB): Omit<Pin, "lat" | "lon"> & { lat: number; lon: number } {
  const travelTags = tagsForSave(r);
  return {
    id: `reco-${r.id}`,
    type: (r.pin_type ?? "reco") as PinType,
    name: r.name,
    city: r.city ?? "",
    country: r.country ?? "",
    lat: r.lat ?? Number.NaN,
    lon: r.lon ?? Number.NaN,
    ...(r.category ? { category: r.category } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    ...(r.recommended_by ? { recommendedBy: r.recommended_by } : {}),
    ...(r.source ? { source: r.source } : {}),
    ...(r.visited ? { visited: true } : {}),
    ...(travelTags.length ? { travelTags } : {}),
    dateAdded: r.created_at.slice(0, 10),
  };
}

/** Map pin — only when the place has coordinates. */
export function recoToPin(r: RecoRowDB): Pin | null {
  if (r.lat == null || r.lon == null) return null;
  return recoFields(r);
}

/** Compare / score — includes places that were saved without a point on the map. */
export function recoToComparePin(r: RecoRowDB): Pin {
  return recoFields(r);
}

function toInsert(uid: string, reco: NewReco, includeTags: boolean): RecoInsert {
  const row: RecoInsert = {
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
  };
  if (includeTags) row.travel_tags = tagsForSave(reco);
  return row;
}

async function selectRecos(): Promise<RecoRowDB[]> {
  if (travelTagsColumnAvailable !== false) {
    const first = await supabase
      .from("recommendations")
      .select(RECO_COLS_WITH_TAGS)
      .order("created_at", { ascending: false });
    if (!first.error) {
      travelTagsColumnAvailable = true;
      return (first.data ?? []) as RecoRowDB[];
    }
    if (!markTravelTagsUnavailable(first.error)) throw first.error;
  }
  const { data, error } = await supabase
    .from("recommendations")
    .select(RECO_COLS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RecoRowDB[];
}

async function insertRecos(uid: string, recos: NewReco[]) {
  if (travelTagsColumnAvailable !== false) {
    const first = await supabase
      .from("recommendations")
      .insert(recos.map((reco) => toInsert(uid, reco, true)));
    if (!first.error) {
      travelTagsColumnAvailable = true;
      return;
    }
    if (!markTravelTagsUnavailable(first.error)) throw first.error;
  }
  const { error } = await supabase
    .from("recommendations")
    .insert(recos.map((reco) => toInsert(uid, reco, false)));
  if (error) throw error;
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
    try {
      setRows(await selectRecos());
    } catch {
      setRows([]);
    }
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
      await insertRecos(uid, [reco]);
      await reload();
    },
    [reload],
  );

  const addMany = useCallback(
    async (recos: NewReco[]) => {
      if (recos.length === 0) return;
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error("Sign in to save recommendations");
      await insertRecos(uid, recos);
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

  return {
    rows,
    loading,
    signedIn,
    add,
    addMany,
    remove,
    reload,
    pins: rows.map(recoToPin).filter(Boolean) as Pin[],
    comparePins: rows.map(recoToComparePin),
  };
}
