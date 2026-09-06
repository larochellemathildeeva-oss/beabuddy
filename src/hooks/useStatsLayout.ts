import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type StatKey =
  | "countries"
  | "cities"
  | "trips"
  | "flights"
  | "hotels"
  | "restaurants"
  | "travelDays"
  | "pins";

export type StatsLayout = Record<StatKey, boolean> & { countryShare: boolean };

export const STAT_OPTIONS: { key: StatKey; label: string; hint: string }[] = [
  { key: "countries", label: "Countries", hint: "Distinct countries from photos and visited pins." },
  { key: "cities", label: "Cities", hint: "Places you have actually been." },
  { key: "trips", label: "Trips completed", hint: "Past trips, or ones whose end date has gone by." },
  { key: "flights", label: "Flights", hint: "Flight stops on your trip timelines." },
  { key: "hotels", label: "Hotels", hint: "Hotel and lodging stops." },
  { key: "restaurants", label: "Restaurants", hint: "Reservations and restaurant stops." },
  { key: "travelDays", label: "Travel days", hint: "Nights and days covered by trip dates." },
  { key: "pins", label: "Pins", hint: "Everything on the globe, including wish list and recs." },
];

export const DEFAULT_STATS_LAYOUT: StatsLayout = {
  countries: true,
  cities: true,
  trips: true,
  flights: true,
  hotels: true,
  restaurants: true,
  travelDays: true,
  pins: true,
  countryShare: true,
};

const keyFor = (userId: string | undefined) => `bea-stats-layout-${userId ?? "anon"}`;

function read(userId: string | undefined): StatsLayout {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return DEFAULT_STATS_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<StatsLayout>;
    return { ...DEFAULT_STATS_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_STATS_LAYOUT;
  }
}

export function useStatsLayout() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<StatsLayout>(DEFAULT_STATS_LAYOUT);

  useEffect(() => {
    setLayout(read(user?.id));
  }, [user?.id]);

  const toggle = useCallback(
    (key: StatKey) => {
      setLayout((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        try {
          window.localStorage.setItem(keyFor(user?.id), JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [user?.id],
  );

  const setCountryShare = useCallback(
    (on: boolean) => {
      setLayout((prev) => {
        const next = { ...prev, countryShare: on };
        try {
          window.localStorage.setItem(keyFor(user?.id), JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [user?.id],
  );

  const reset = useCallback(() => {
    setLayout(DEFAULT_STATS_LAYOUT);
    try {
      window.localStorage.removeItem(keyFor(user?.id));
    } catch {
      /* storage unavailable */
    }
  }, [user?.id]);

  return { layout, toggle, setCountryShare, reset };
}
