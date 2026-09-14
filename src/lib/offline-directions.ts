/**
 * Keeping saved turn-by-turn honest.
 *
 * Directions were downloadable from one place (trip settings) and viewable from
 * another (the trip page), and the two built their route from *different* stop
 * lists — cities when the trip had two or more, the timeline otherwise. So the
 * legs you looked at were not necessarily the legs you saved, and the saved
 * legs were pinned under timeline rows by array index regardless of what they
 * were actually legs between.
 *
 * A signature travels with the saved copy so both screens can tell whether it
 * still describes the stops in front of you.
 */

export type SignatureStop = {
  title: string;
  address?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

function round(value: number | null | undefined): string {
  // ~11 m of precision: enough to notice a moved pin, not so much that a
  // re-geocode of the same place counts as a change.
  return value == null ? "" : value.toFixed(4);
}

/** A stable key for the stop list a set of directions was built from. */
export function directionsSignature(stops: SignatureStop[]): string {
  return stops
    .map((stop) =>
      [
        stop.title.trim().toLowerCase(),
        (stop.address ?? "").trim().toLowerCase(),
        round(stop.lat),
        round(stop.lon),
      ].join("|"),
    )
    .join("»");
}

/**
 * True when saved directions were built from exactly these stops. Directions
 * saved before signatures existed have none, so they are treated as unknown
 * rather than stale — no false alarms on an existing download.
 */
export function savedMatchesStops(
  savedSignature: string | undefined,
  stops: SignatureStop[],
): boolean {
  if (!savedSignature) return false;
  return savedSignature === directionsSignature(stops);
}

export function savedIsStale(savedSignature: string | undefined, stops: SignatureStop[]): boolean {
  if (!savedSignature) return false;
  return savedSignature !== directionsSignature(stops);
}

/** "Saved just now" / "Saved 3 days ago" — a bare date told you nothing useful. */
export function savedAgoLabel(savedAt: string, now: Date = new Date()): string {
  const then = new Date(savedAt);
  if (Number.isNaN(then.getTime())) return "Saved";
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 90) return "Saved just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Saved ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Saved ${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Saved yesterday";
  if (days < 30) return `Saved ${days} days ago`;
  return `Saved ${then.toLocaleDateString()}`;
}

/** localStorage is small and can be full; say which half of the job failed. */
export function storageFailureMessage(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  const message = error instanceof Error ? error.message : "";
  if (/quota|exceeded/i.test(`${name} ${message}`)) {
    return "The directions worked, but this phone has no room to keep them. Free some space, or delete another trip's saved directions.";
  }
  return "The directions worked, but they couldn't be saved on this phone. Private browsing blocks it.";
}
