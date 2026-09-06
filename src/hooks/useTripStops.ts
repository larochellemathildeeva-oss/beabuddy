import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StopRow = {
  id: string;
  trip_id: string;
  kind: string;
  city: string;
  country: string | null;
  place_name: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  arrive_on: string | null;
  depart_on: string | null;
  notes: string | null;
  position: number;
};

export type NewStop = {
  kind?: string;
  city: string;
  country?: string;
  place_name?: string;
  address?: string;
  lat?: number;
  lon?: number;
  arrive_on?: string;
  depart_on?: string;
  notes?: string;
};

const COLS =
  "id, trip_id, kind, city, country, place_name, address, lat, lon, arrive_on, depart_on, notes, position";

export function useTripStops(tripId: string | null, uid: string | null) {
  const [stops, setStops] = useState<StopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelId] = useState(() => Math.random().toString(36).slice(2));

  const load = useCallback(async () => {
    if (!tripId) {
      setStops([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("trip_stops")
      .select(COLS)
      .eq("trip_id", tripId)
      .order("position", { ascending: true });
    setStops((data ?? []) as StopRow[]);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`trip-stops:${tripId}:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_stops", filter: `trip_id=eq.${tripId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tripId, channelId, load]);

  const addStop = useCallback(
    async (s: NewStop) => {
      if (!tripId) throw new Error("Open a trip first");
      const { data: auth } = await supabase.auth.getUser();
      const authorId = auth.user?.id ?? uid;
      if (!authorId) throw new Error("Sign in first");
      const { error } = await supabase.from("trip_stops").insert({
        trip_id: tripId,
        kind: s.kind ?? "destination",
        city: s.city,
        country: s.country || null,
        place_name: s.place_name || null,
        address: s.address || null,
        lat: s.lat ?? null,
        lon: s.lon ?? null,
        arrive_on: s.arrive_on || null,
        depart_on: s.depart_on || null,
        notes: s.notes || null,
        position: stops.length,
        created_by: authorId,
      });
      if (error) throw error;
      await load();
    },
    [tripId, uid, stops.length, load],
  );

  const updateStop = useCallback(
    async (id: string, patch: Partial<Omit<StopRow, "id" | "trip_id">>) => {
      const clean = Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, v === "" ? null : v]),
      ) as Partial<Omit<StopRow, "id" | "trip_id">>;
      const { error } = await supabase.from("trip_stops").update(clean).eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const removeStop = useCallback(
    async (id: string) => {
      await supabase.from("trip_stops").delete().eq("id", id);
      await load();
    },
    [load],
  );

  const moveStop = useCallback(
    async (id: string, dir: -1 | 1) => {
      const index = stops.findIndex((s) => s.id === id);
      const swapWith = stops[index + dir];
      const current = stops[index];
      if (!current || !swapWith) return;
      await Promise.all([
        supabase.from("trip_stops").update({ position: swapWith.position }).eq("id", current.id),
        supabase.from("trip_stops").update({ position: current.position }).eq("id", swapWith.id),
      ]);
      await load();
    },
    [stops, load],
  );

  const countries = Array.from(
    new Set(stops.map((s) => s.country).filter((c): c is string => !!c)),
  );

  return { stops, countries, loading, addStop, updateStop, removeStop, moveStop, reload: load };
}
