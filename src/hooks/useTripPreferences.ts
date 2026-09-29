import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumn } from "@/lib/bookings";
import { cleanTripPreferences } from "@/lib/trip-preferences";

const COLUMN = ["trip_preferences"];
const phoneKey = (tripId: string) => `bea:trip-preferences:${tripId}`;

function readPhone(tripId: string): string[] {
  try {
    const raw = window.localStorage.getItem(phoneKey(tripId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? cleanTripPreferences(parsed.map(String)) : [];
  } catch {
    return [];
  }
}

function writePhone(tripId: string, list: string[]) {
  try {
    window.localStorage.setItem(phoneKey(tripId), JSON.stringify(list));
  } catch {
    // A private window: the choice lasts as long as the page.
  }
}

/**
 * "Just for this trip" preferences: on the trip, shared with everyone on it.
 * The column arrives with a migration applied by hand; until it is, they are
 * kept on this phone, and `onPhone` says so.
 */
export function useTripPreferences(tripId: string) {
  const [list, setList] = useState<string[]>([]);
  const [onPhone, setOnPhone] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase
      .from("trips")
      .select("trip_preferences")
      .eq("id", tripId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error && isMissingColumn(error, COLUMN)) {
          setOnPhone(true);
          setList(readPhone(tripId));
          return;
        }
        setOnPhone(false);
        setList(cleanTripPreferences((data?.trip_preferences as string[] | null) ?? []));
      });
    return () => {
      active = false;
    };
  }, [tripId]);

  const save = useCallback(
    async (next: string[]) => {
      const clean = cleanTripPreferences(next);
      setList(clean);
      if (onPhone) {
        writePhone(tripId, clean);
        return;
      }
      const { error } = await supabase
        .from("trips")
        .update({ trip_preferences: clean })
        .eq("id", tripId);
      if (error && isMissingColumn(error, COLUMN)) {
        setOnPhone(true);
        writePhone(tripId, clean);
        return;
      }
      if (error) throw error;
    },
    [tripId, onPhone],
  );

  return { list, save, onPhone };
}
