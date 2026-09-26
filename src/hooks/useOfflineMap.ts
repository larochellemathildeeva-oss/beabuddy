import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearOfflineMap,
  readSavedMap,
  saveOfflineMap,
  savedMapStillThere,
  vectorMapAvailable,
  type SavedMap,
} from "@/lib/offline-map";

/**
 * The trip's map, kept on the phone so the day map still pans and zooms with
 * no signal.
 *
 * Saved beside the directions and the day pictures when "Keep offline" is
 * pressed, and only where the day map is drawn from vector tiles; elsewhere
 * the pictures are what there is. The browser may clear it without saying,
 * so on opening the trip the note is checked against what is really there.
 *
 * A save answers only the trip it was started for: switching trips, or
 * deleting the map, while one is under way leaves this screen alone.
 */
export function useOfflineMap(tripId: string | null) {
  const [saved, setSaved] = useState<SavedMap | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  // Bumped on every trip change, delete and new save; an answer from an
  // older one is dropped.
  const run = useRef(0);

  useEffect(() => {
    const mine = ++run.current;
    setProgress(null);
    setError("");
    if (!tripId) {
      setSaved(null);
      return;
    }
    const note = readSavedMap(tripId);
    setSaved(note);
    if (!note) return;
    let active = true;
    void savedMapStillThere(tripId).then((there) => {
      if (!active || run.current !== mine || there) return;
      // Cleared by the browser: say so rather than promise a map that is gone.
      void clearOfflineMap(tripId);
      setSaved(null);
      setError("The saved map was cleared by the browser. Keep it offline again to bring it back.");
    });
    return () => {
      active = false;
    };
  }, [tripId]);

  const save = useCallback(
    async (days: readonly { points: readonly { lat: number; lon: number }[] }[]) => {
      if (!tripId || days.length === 0) return;
      const mine = ++run.current;
      if (!(await vectorMapAvailable()) || run.current !== mine) return;
      setError("");
      setProgress({ done: 0, total: 0 });
      try {
        const kept = await saveOfflineMap(
          tripId,
          days.map((d) => d.points),
          (done, total) => {
            if (run.current === mine) setProgress({ done, total });
          },
        );
        if (run.current === mine && kept) setSaved(kept);
      } catch (e) {
        if (run.current === mine) {
          setError(e instanceof Error ? e.message : "Couldn't save the map.");
        }
      } finally {
        if (run.current === mine) setProgress(null);
      }
    },
    [tripId],
  );

  const clear = useCallback(() => {
    if (!tripId) return;
    run.current++;
    void clearOfflineMap(tripId);
    setSaved(null);
    setProgress(null);
    setError("");
  }, [tripId]);

  return { saved, busy: progress !== null, progress, error, save, clear };
}
