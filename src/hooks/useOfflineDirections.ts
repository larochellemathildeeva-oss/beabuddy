import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import {
  directionsSignature,
  storageFailureMessage,
  type SignatureStop,
} from "@/lib/offline-directions";

export type SavedDirections = {
  legs: RouteLeg[];
  unresolved: string[];
  deferred?: string[];
  savedAt: string;
  /** The stop list these were built from; absent on downloads predating it. */
  signature?: string;
};

export const DIRECTIONS_KEY_PREFIX = "bea.directions.";

export const directionsStorageKey = (tripId: string) => `${DIRECTIONS_KEY_PREFIX}${tripId}`;

/** Trip ids that have turn-by-turn saved on this phone. */
export function listSavedDirectionTripIds(): string[] {
  if (typeof window === "undefined") return [];
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const stored = localStorage.key(i);
    if (stored?.startsWith(DIRECTIONS_KEY_PREFIX)) {
      ids.push(stored.slice(DIRECTIONS_KEY_PREFIX.length));
    }
  }
  return ids;
}

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
      const raw = localStorage.getItem(directionsStorageKey(tripId));
      setSaved(raw ? (JSON.parse(raw) as SavedDirections) : null);
    } catch {
      setSaved(null);
    }
  }, [tripId]);

  /**
   * Persist directions that have already been worked out. Routing and storing
   * are reported separately — a full phone used to read as a failed download.
   */
  const keep = useCallback(
    (
      result: { legs: RouteLeg[]; unresolved: string[]; deferred?: string[] },
      stops: SignatureStop[],
    ) => {
      if (!tripId) return false;
      const record: SavedDirections = {
        legs: result.legs,
        unresolved: result.unresolved,
        ...(result.deferred ? { deferred: result.deferred } : {}),
        savedAt: new Date().toISOString(),
        signature: directionsSignature(stops),
      };
      try {
        localStorage.setItem(directionsStorageKey(tripId), JSON.stringify(record));
      } catch (e) {
        setError(storageFailureMessage(e));
        return false;
      }
      setSaved(record);
      setError("");
      return true;
    },
    [tripId],
  );

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
        })) as { legs: RouteLeg[]; unresolved: string[]; deferred?: string[] };
        keep(result, stops);
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
    [tripId, run, keep],
  );

  const clear = useCallback(() => {
    if (!tripId) return;
    localStorage.removeItem(directionsStorageKey(tripId));
    setSaved(null);
  }, [tripId]);

  return { saved, busy, error, download, keep, clear };
}

export function prettyDistance(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export function prettyDuration(s: number) {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
