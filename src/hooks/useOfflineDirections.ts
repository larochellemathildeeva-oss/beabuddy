import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";

export type SavedDirections = {
  legs: RouteLeg[];
  unresolved: string[];
  deferred?: string[];
  savedAt: string;
};

const key = (tripId: string) => `bea.directions.${tripId}`;

export function useOfflineDirections(tripId: string | null) {
  const [saved, setSaved] = useState<SavedDirections | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = useServerFn(buildRoutes);

  useEffect(() => {
    if (!tripId) {
      setSaved(null);
      return;
    }
    try {
      const raw = localStorage.getItem(key(tripId));
      setSaved(raw ? (JSON.parse(raw) as SavedDirections) : null);
    } catch {
      setSaved(null);
    }
  }, [tripId]);

  const download = useCallback(
    async (
      stops: { title: string; address?: string | null; lat?: number | null; lon?: number | null }[],
      area?: string,
    ) => {
      if (!tripId) return;
      setBusy(true);
      setError("");
      try {
        const result = (await run({
          data: { stops, ...(area ? { area } : {}) },
        })) as SavedDirections;
        localStorage.setItem(key(tripId), JSON.stringify(result));
        setSaved(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        setError(
          /unauthorized/i.test(message)
            ? "Sign in again, then try downloading."
            : message || "Couldn't download the directions",
        );
      } finally {
        setBusy(false);
      }
    },
    [tripId, run],
  );

  const clear = useCallback(() => {
    if (!tripId) return;
    localStorage.removeItem(key(tripId));
    setSaved(null);
  }, [tripId]);

  return { saved, busy, error, download, clear };
}

export function prettyDistance(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export function prettyDuration(s: number) {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
