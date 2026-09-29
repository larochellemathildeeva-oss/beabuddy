import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { placeDetails, type PlaceDetails } from "@/lib/place-details.functions";

/** One lookup per place per session, whichever card or picture asked first. */
const cache = new Map<string, Promise<PlaceDetails | null>>();

/**
 * Place Details for a named pin — hours, website, a Commons photo — shared by
 * the stop card and the real-photo pictures, so a place is asked about once.
 */
export function usePlaceDetails(
  name: string | null | undefined,
  lat: number | null | undefined,
  lon: number | null | undefined,
  enabled: boolean,
) {
  const ask = useServerFn(placeDetails);
  // Kept with the place it answers, so a card moving on to the next stop
  // never shows the last stop's hours or photo while the new ones load.
  const [answer, setAnswer] = useState<{ key: string; facts: PlaceDetails | null } | null>(null);
  const title = name?.trim() ?? "";
  const placed = lat != null && lon != null && (lat !== 0 || lon !== 0);
  const key = placed && title ? `${title}@${lat!.toFixed(5)},${lon!.toFixed(5)}` : "";
  const facts = answer && answer.key === key ? answer.facts : undefined;
  useEffect(() => {
    if (!enabled || !key) return;
    let live = true;
    let pending = cache.get(key);
    if (!pending) {
      pending = ask({ data: { name: title.slice(0, 200), lat: lat!, lon: lon! } }).catch(
        () => null,
      );
      cache.set(key, pending);
    }
    void pending.then((f) => {
      if (live) setAnswer({ key, facts: f });
    });
    return () => {
      live = false;
    };
  }, [enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps -- `key` stands for name and pin
  return { placed, facts, loading: enabled && !!key && facts === undefined };
}
