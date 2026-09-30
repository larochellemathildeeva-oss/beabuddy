import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { tripViewKey } from "@/lib/account-settings";
import { saveAccountSetting } from "@/lib/account-settings-sync";
import { getStored, setStored } from "@/lib/settings-storage";

/**
 * What the trip page shows, chosen by the traveller.
 *
 * Three switches, not the prototype's eight. A preference is for something
 * someone may not want to see; something absent because the data is not
 * there is a conditional render, not a setting. Kept with the account, the
 * same way the Home layout is.
 */
export type TripViewKey = "ribbon" | "journey" | "walkTimes" | "nesting" | "pinChecks";

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
    hint: "The walk, ride or drive between stops on the Day tab, with directions.",
  },
  {
    key: "nesting",
    label: "Nested stops",
    hint: "Timed stops inside another tucked under it. Off: every stop on its own line. What to see inside a stop is always its pill.",
  },
  {
    key: "pinChecks",
    label: "Pins to check",
    hint: "A note on stops whose place Béa was unsure of, and why, here and in the printed itinerary.",
  },
];

export const DEFAULT_TRIP_VIEW: TripViewPrefs = {
  ribbon: true,
  journey: true,
  walkTimes: true,
  nesting: true,
  pinChecks: false,
};

const keyFor = tripViewKey;

function read(userId: string | undefined): TripViewPrefs {
  try {
    const raw = getStored(keyFor(userId));
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
    const onStorage = (e: StorageEvent) => {
      if (e.key === keyFor(user?.id) || e.key === null) setPrefs(read(user?.id));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user?.id]);

  const toggle = useCallback(
    (key: TripViewKey) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        setStored(keyFor(user?.id), JSON.stringify(next));
        if (user?.id) saveAccountSetting("tripView", JSON.stringify(next));
        return next;
      });
    },
    [user?.id],
  );

  return { prefs, toggle };
}
