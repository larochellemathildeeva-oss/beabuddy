import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pin } from "@/data/atlas";

export type PhotoRow = {
  id: string;
  storage_path: string;
  city: string | null;
  country: string | null;
  caption: string | null;
  taken_at: string | null;
  lat: number | null;
  lon: number | null;
};

export type PhotoStats = {
  photos: number;
  cities: number;
  countries: number;
  days: number;
};

function dayKey(iso: string | null) {
  return iso ? iso.slice(0, 10) : null;
}

export function derivePhotoStats(rows: PhotoRow[]): PhotoStats {
  const cities = new Set<string>();
  const countries = new Set<string>();
  const days = new Set<string>();
  for (const r of rows) {
    if (r.city) cities.add(`${r.city}|${r.country ?? ""}`.toLowerCase());
    if (r.country) countries.add(r.country.toLowerCase());
    const d = dayKey(r.taken_at);
    if (d) days.add(d);
  }
  return { photos: rows.length, cities: cities.size, countries: countries.size, days: days.size };
}

/** One "visited" pin per photographed city, placed at the average of its photo coordinates. */
export function derivePhotoPins(rows: PhotoRow[]): Pin[] {
  const groups = new Map<string, { rows: PhotoRow[]; lat: number; lon: number; n: number }>();
  for (const r of rows) {
    if (r.lat == null || r.lon == null) continue;
    const key = (r.city || `${r.lat.toFixed(1)},${r.lon.toFixed(1)}`).toLowerCase();
    const g = groups.get(key) ?? { rows: [], lat: 0, lon: 0, n: 0 };
    g.rows.push(r);
    g.lat += r.lat;
    g.lon += r.lon;
    g.n += 1;
    groups.set(key, g);
  }
  return Array.from(groups.entries()).map(([key, g]) => {
    const first = g.rows[0]!;
    const dates = g.rows.map((r) => r.taken_at).filter(Boolean).sort() as string[];
    return {
      id: `photo-${key}`,
      type: "visited" as const,
      name: first.city ? `${first.city} photos` : "Photo location",
      city: first.city ?? "Unknown",
      country: first.country ?? "",
      lat: g.lat / g.n,
      lon: g.lon / g.n,
      ...(dates[0] ? { dateVisited: dates[0].slice(0, 10) } : {}),
      notes: `${g.rows.length} photo${g.rows.length > 1 ? "s" : ""} imported from your camera roll.`,
    };
  });
}

export function usePhotoMemories() {
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const { data } = await supabase
      .from("photo_memories")
      .select("id, storage_path, city, country, caption, taken_at, lat, lon")
      .order("taken_at", { ascending: false });
    setRows((data ?? []) as PhotoRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  return { rows, loading, reload, stats: derivePhotoStats(rows), pins: derivePhotoPins(rows) };
}
