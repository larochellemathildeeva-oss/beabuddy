import { useMemo } from "react";
import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useVisitedProvinces } from "@/hooks/useVisitedProvinces";
import { toLocalISODate } from "@/lib/trip-dates";
import { countriesVisited, isVisitedPin, visitedCities, visitsByCountry } from "@/lib/world-visits";

/**
 * The countries-visited figure for screens other than World (which works
 * the same pieces out for its globe and passes them to `countriesVisited`
 * itself), so You and World never show two different numbers.
 */
export function useCountriesVisited(
  trips: readonly { country: string | null; start_date: string | null }[],
): number {
  const photo = usePhotoMemories();
  const vault = useRecommendations();
  const places = useMemo(
    () => [...photo.pins, ...vault.pins].filter(isVisitedPin),
    [photo.pins, vault.pins],
  );
  const cities = useMemo(() => visitedCities(places), [places]);
  const provinces = useVisitedProvinces(cities);
  const keys = useMemo(
    () => visitsByCountry(places, cities, provinces).map((c) => c.key),
    [places, cities, provinces],
  );
  return countriesVisited(keys, trips, toLocalISODate(new Date()));
}
