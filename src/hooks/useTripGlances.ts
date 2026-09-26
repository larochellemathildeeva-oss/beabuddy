import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumn } from "@/lib/bookings";
import { packingReadiness, tripHighlights } from "@/lib/home-trip";
import { firstStop, plansConfirmed } from "@/lib/trip-glance";

export type GlanceItem = {
  id: string;
  trip_id: string;
  day_date: string | null;
  time_label: string | null;
  title: string;
  kind: string;
  detail: string | null;
  address: string | null;
  booked?: boolean;
};

export type TripGlance = {
  items: GlanceItem[];
  flight: GlanceItem | null;
  lodging: GlanceItem | null;
  firstStop: GlanceItem | null;
  packing: ReturnType<typeof packingReadiness>;
  plans: ReturnType<typeof plansConfirmed>;
};

const COLS = "id, trip_id, day_date, time_label, title, kind, detail, address";

/** Kept after the first miss: the bookings migration is applied by hand. */
let bookedColumn: boolean | null = null;

async function selectItems(ids: string[]): Promise<GlanceItem[]> {
  const query = (cols: string) =>
    supabase
      .from("itinerary_items")
      .select(cols)
      .in("trip_id", ids)
      .order("day_date", { ascending: true })
      .order("position", { ascending: true });
  if (bookedColumn !== false) {
    const first = await query(`${COLS}, booked`);
    if (!first.error) {
      bookedColumn = true;
      return (first.data ?? []) as unknown as GlanceItem[];
    }
    if (!isMissingColumn(first.error, ["booked"])) return [];
    bookedColumn = false;
  }
  const retry = await query(COLS);
  return retry.error ? [] : ((retry.data ?? []) as unknown as GlanceItem[]);
}

/**
 * The flight out, the stay, how packed and how booked — for every trip card on
 * a screen at once.
 *
 * Three queries for the whole list rather than three per card: a hook per
 * card is how a list of ten trips turns into thirty requests.
 */
export function useTripGlances(tripIds: readonly string[]) {
  const key = [...tripIds].sort().join(",");
  const [items, setItems] = useState<GlanceItem[]>([]);
  const [packed, setPacked] = useState<{ trip_id: string; packed: boolean }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setItems([]);
      setPacked([]);
      setLoaded(true);
      return;
    }
    let active = true;
    void (async () => {
      const [rows, lists] = await Promise.all([
        selectItems(ids),
        supabase.from("packing_lists").select("id, trip_id").in("trip_id", ids),
      ]);
      const listTrip = new Map<string, string>();
      for (const l of lists.data ?? []) if (l.trip_id) listTrip.set(l.id, l.trip_id);
      let packing: { trip_id: string; packed: boolean }[] = [];
      if (listTrip.size > 0) {
        const { data } = await supabase
          .from("packing_items")
          .select("list_id, packed")
          .in("list_id", [...listTrip.keys()]);
        packing = (data ?? []).map((p) => ({
          trip_id: listTrip.get(p.list_id) ?? "",
          packed: Boolean(p.packed),
        }));
      }
      if (!active) return;
      setItems(rows);
      setPacked(packing);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [key]);

  const glances = useMemo(() => {
    const out: Record<string, TripGlance> = {};
    for (const id of key ? key.split(",") : []) {
      const mine = items.filter((i) => i.trip_id === id);
      const { flight, lodging } = tripHighlights(mine);
      out[id] = {
        items: mine,
        flight,
        lodging,
        firstStop: firstStop(mine),
        packing: packingReadiness(packed.filter((p) => p.trip_id === id)),
        plans: plansConfirmed(mine),
      };
    }
    return out;
  }, [key, items, packed]);

  return { glances, loaded };
}
