import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { dayMapImage } from "@/lib/place-details.functions";
import { storageFailureMessage } from "@/lib/offline-directions";

export const DAY_MAPS_KEY_PREFIX = "bea.daymaps.";

type Stored = { savedAt: string; days: Record<string, string> };

/**
 * A picture of each day's map, kept on the phone beside the saved
 * directions, so the day can be followed with no signal. The pictures come
 * from Béa's server (the key never reaches the phone) as data URLs and live
 * in this browser's storage only.
 */
export function useOfflineDayMaps(tripId: string | null) {
  const [maps, setMaps] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fetchMap = useServerFn(dayMapImage);

  useEffect(() => {
    if (!tripId) {
      setMaps({});
      return;
    }
    try {
      const raw = localStorage.getItem(`${DAY_MAPS_KEY_PREFIX}${tripId}`);
      setMaps(raw ? (JSON.parse(raw) as Stored).days : {});
    } catch {
      setMaps({});
    }
  }, [tripId]);

  const save = useCallback(
    async (days: { day: string; points: { lat: number; lon: number }[] }[]) => {
      if (!tripId || days.length === 0) return;
      setBusy(true);
      setError("");
      const out: Record<string, string> = {};
      // One at a time: a trip is a handful of pictures, and the provider's
      // pace is a few a second.
      for (const { day, points } of days) {
        try {
          const url = await fetchMap({ data: { points } });
          if (url) out[day] = url;
        } catch {
          // One missing picture does not undo the others.
        }
      }
      try {
        const record: Stored = { savedAt: new Date().toISOString(), days: out };
        localStorage.setItem(`${DAY_MAPS_KEY_PREFIX}${tripId}`, JSON.stringify(record));
        setMaps(out);
        if (Object.keys(out).length < days.length) {
          setError("Some day maps couldn't be saved; the directions are kept either way.");
        }
      } catch (e) {
        setError(storageFailureMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [tripId, fetchMap],
  );

  const clear = useCallback(() => {
    if (!tripId) return;
    try {
      localStorage.removeItem(`${DAY_MAPS_KEY_PREFIX}${tripId}`);
    } catch {
      /* private mode */
    }
    setMaps({});
  }, [tripId]);

  return { maps, busy, error, save, clear };
}
