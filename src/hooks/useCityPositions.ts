import { useEffect, useMemo, useState } from "react";
import { knownCityPosition, locateCities, pinCityStops } from "@/lib/city-locate";
import { citiesToLocate, type CityStop, type Position } from "@/lib/city-position";

/**
 * Positions for the trip's cities that have none: found by name, and saved
 * on their stops so the next time needs no lookup. A trip made before Béa
 * looked cities up gets its map the first time Home shows it.
 */
export function useCityPositions(stops: readonly CityStop[]): ReadonlyMap<string, Position> {
  const wanted = useMemo(() => citiesToLocate(stops), [stops]);
  const [found, setFound] = useState<ReadonlyMap<string, Position>>(() => new Map());
  const ask = wanted.map((w) => w.key).join("\n");

  useEffect(() => {
    if (wanted.length === 0) return;
    let live = true;
    // What this phone already knows draws at once; the rest is asked.
    const known = new Map<string, Position>();
    for (const { key } of wanted) {
      const at = knownCityPosition(key);
      if (at) known.set(key, at);
    }
    if (known.size) setFound(known);
    void locateCities(stops).then((positions) => {
      if (!live) return;
      setFound(positions);
      void pinCityStops(stops, positions);
    });
    return () => {
      live = false;
    };
    // Asked again only when the cities without a position change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  return found;
}
