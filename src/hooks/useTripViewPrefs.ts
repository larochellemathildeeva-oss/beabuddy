import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * What the trip page shows, chosen by the traveller.
 *
 * Three switches, not the prototype's eight. A preference is for something
 * someone may not want to see; something absent because the data is not
 * there is a conditional render, not a setting. Kept on this device, the
 * same way the Home layout is.
 */
export type TripViewKey = "ribbon" | "journey" | "walkTimes";

export type TripViewPrefs = Record<TripViewKey, boolean>;

export const TRIP_VIEW_OPTIONS: { key: TripViewKey; label: string; hint: string }[] = [
  { key: "journey", label: "Live journey", hint: "The numbered line of stops at the top of Now." },
  {
    key: "ribbon",
    label: "Itinerary ribbon",
    hint: "The strip of stop cards you swipe along on Now.",
  },
  {
    key: "walkTimes",
    label: "Walk times",
    hint: "The walk or drive between stops on the Day tab, with directions.",
  },
];

export const DEFAULT_TRIP_VIEW: TripViewPrefs = { ribbon: true, journey: true, walkTimes: true };

const keyFor = (userId: string | undefined) => `bea-trip-view-${userId ?? "anon"}`;

function read(userId: string | undefined): TripViewPrefs {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return DEFAULT_TRIP_VIEW;
    return { ...DEFAULT_TRIP_VIEW, ...(JSON.parse(raw) as Partial<TripViewPrefs>) };
  } catch {
    return DEFAULT_TRIP_VIEW;
  }
}

export function useTripViewPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<TripViewPrefs>(DEFAULT_TRIP_VIEW);

  useEffect(() => {
    setPrefs(read(user?.id));
  }, [user?.id]);

  const toggle = useCallback(
    (key: TripViewKey) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        try {
          window.localStorage.setItem(keyFor(user?.id), JSON.stringify(next));
        } catch {
          /* storage unavailable: the choice lasts for this visit */
        }
        return next;
      });
    },
    [user?.id],
  );

  return { prefs, toggle };
}
