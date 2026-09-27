import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prepFacts, prepPlaceLine, type PrepFact } from "@/lib/trip-prep";

/**
 * What the To do and Packing sheet says about its trip: the place and dates
 * under the title, and the facts strip over the to-dos. Read once when the
 * sheet opens, so the sheet needs nothing more than the trip's id.
 */
export function useTripPrepFacts(tripId: string, enabled: boolean) {
  const [line, setLine] = useState("");
  const [facts, setFacts] = useState<PrepFact[]>([]);

  useEffect(() => {
    if (!enabled || !tripId) return;
    let live = true;
    void (async () => {
      const [trip, items] = await Promise.all([
        supabase
          .from("trips")
          .select("city, country, start_date, end_date")
          .eq("id", tripId)
          .limit(1),
        supabase.from("itinerary_items").select("kind, title").eq("trip_id", tripId),
      ]);
      if (!live) return;
      const row = trip.data?.[0] ?? {};
      setLine(prepPlaceLine(row));
      setFacts(prepFacts(row, items.error ? [] : (items.data ?? [])));
    })();
    return () => {
      live = false;
    };
  }, [tripId, enabled]);

  return { line, facts };
}
