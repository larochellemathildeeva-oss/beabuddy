import { useMemo } from "react";
import { useCityPositions } from "@/hooks/useCityPositions";
import { useTripStops } from "@/hooks/useTripStops";
import type { TripRow } from "@/hooks/useTrips";
import { knownCityPosition } from "@/lib/city-locate";
import {
  cityKey,
  hasPosition,
  tripCityStop,
  withCityPositions,
  type CityStop,
  type Position,
} from "@/lib/city-position";
import { routeStopsIndexed } from "@/lib/home-route-map";

/** Positions this phone already knows for a city: no lookup. */
function knownPositions(stops: readonly CityStop[]): ReadonlyMap<string, Position> {
  const found = new Map<string, Position>();
  for (const stop of stops) {
    if (hasPosition(stop) || !stop.city.trim()) continue;
    const key = cityKey(stop.city, stop.country);
    const at = knownCityPosition(key);
    if (at) found.set(key, at);
  }
  return found;
}

/**
 * A trip's cities, placed, and the route the aerial banner draws through
 * them — the same reads as Home's map and the Trips rows (`useTripStops`,
 * `useCityPositions`). `lookUp` finds cities typed rather than picked (one
 * lookup each, kept on the phone); rows only draw what is already known, so
 * a long list never asks the map for every trip at once.
 */
export function useAerialRoute(trip: TripRow | null, lookUp: boolean) {
  const { stops, loading } = useTripStops(trip?.id ?? null, null);
  // A one-city trip keeps its city on the trip, not as a stop.
  const cityStops = useMemo(
    (): readonly CityStop[] => (!trip ? [] : stops.length || loading ? stops : tripCityStop(trip)),
    [stops, loading, trip],
  );
  const looked = useCityPositions(lookUp ? cityStops : []);
  const placed = useMemo(() => {
    const known = new Map([...knownPositions(cityStops), ...looked]);
    return withCityPositions(cityStops, known);
  }, [cityStops, looked]);
  const { route, indexOf } = useMemo(() => routeStopsIndexed(placed), [placed]);
  return { stops, loading, placed, route, indexOf };
}
