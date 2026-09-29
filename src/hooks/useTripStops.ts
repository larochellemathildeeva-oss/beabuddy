import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { missingTripCity } from "@/lib/trip-cities";
import { lastLoaded, rememberLoaded, screenGeneration } from "@/lib/screen-cache";

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

/** The trip's own city and dates, which a one-city trip keeps on the trip rather than as a stop. */
export type TripHome = {
  city?: string | null;
  country?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export function useTripStops(tripId: string | null, uid: string | null, home?: TripHome) {
  // A card opens with the cities it last showed, not the trip's own city
  // until its stops arrive.
  const [last] = useState(() => (tripId ? lastLoaded<StopRow[]>(`stops:${tripId}`) : undefined));
  const [stops, setStops] = useState<StopRow[]>(last ?? []);
  const [loading, setLoading] = useState(!last);
  const [channelId] = useState(() => Math.random().toString(36).slice(2));

  const load = useCallback(async () => {
    if (!tripId) {
      setStops([]);
      setLoading(false);
      return;
    }
    const since = screenGeneration();
    // Same rule as the timeline: a failed read is not an empty trip, and
    // blanking the stops would take the map, the directions and the day
    // grouping with it.
    const { data, error } = await supabase
      .from("trip_stops")
      .select(COLS)
      .eq("trip_id", tripId)
      .order("position", { ascending: true });
    if (!error) {
      const rows = (data ?? []) as StopRow[];
      setStops(rows);
      rememberLoaded(`stops:${tripId}`, rows, since);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    const hit = tripId ? lastLoaded<StopRow[]>(`stops:${tripId}`) : undefined;
    if (hit) setStops(hit);
    setLoading(!hit);
    void load();
  }, [tripId, load]);

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

  /** Several at once, in order after the last: each gets its own position. */
  const addStops = useCallback(
    async (list: NewStop[]) => {
      if (!tripId) throw new Error("Open a trip first");
      if (list.length === 0) return;
      const { data: auth } = await supabase.auth.getUser();
      const authorId = auth.user?.id ?? uid;
      if (!authorId) throw new Error("Sign in first");
      // The first city added to a one-city trip is its second city. The one
      // the trip was made for goes in ahead of it, or the list — and every
      // city switcher built on it — forgets where the trip starts.
      // Checked against the new cities too: adding the trip's own city is not a second one.
      const first = stops.length === 0 && home ? missingTripCity(home, list, list[0]) : null;
      const rows = first ? [{ kind: "destination", ...first }, ...list] : list;
      // One past the highest, not stops.length: after a remove the list is
      // shorter than its highest position, so two removes and two undos gave
      // two rows the same position and left moveStop unable to separate them.
      const next = stops.reduce((max, stop) => Math.max(max, stop.position + 1), 0);
      const { error } = await supabase.from("trip_stops").insert(
        rows.map((s, i) => ({
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
          position: next + i,
          created_by: authorId,
        })),
      );
      if (error) throw error;
      await load();
    },
    [tripId, uid, stops, load, home],
  );

  const addStop = useCallback((s: NewStop) => addStops([s]), [addStops]);

  /**
   * A trip whose second city was added before the first was kept: the city
   * the trip was made for is missing from the list. Null when nothing is.
   */
  const missingHome = stops.length > 0 && home ? missingTripCity(home, stops) : null;

  /** Put the trip's own city back, at the front of the list. */
  const addHome = useCallback(async () => {
    if (!tripId || !missingHome) return;
    const { data: auth } = await supabase.auth.getUser();
    const authorId = auth.user?.id ?? uid;
    if (!authorId) throw new Error("Sign in first");
    const { error } = await supabase.from("trip_stops").insert({
      trip_id: tripId,
      kind: "destination",
      city: missingHome.city,
      country: missingHome.country || null,
      arrive_on: missingHome.arrive_on || null,
      depart_on: missingHome.depart_on || null,
      position: stops.reduce((min, stop) => Math.min(min, stop.position), 0) - 1,
      created_by: authorId,
    });
    if (error) throw error;
    await load();
  }, [tripId, uid, missingHome, stops, load]);

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
      const { error } = await supabase.from("trip_stops").delete().eq("id", id);
      if (error) throw error;
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

  return {
    stops,
    countries,
    loading,
    addStop,
    addStops,
    updateStop,
    removeStop,
    moveStop,
    missingHome,
    addHome,
    reload: load,
  };
}
