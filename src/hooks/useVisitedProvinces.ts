import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import {
  provinceFilesFor,
  visitedProvinces,
  type ProvinceFeature,
  type ProvinceFileEntry,
  type VisitedCity,
  type VisitedProvince,
} from "@/lib/world-visits";

const BASE = "/geo/admin1";

// Kept for the visit: the boundaries do not change while the app is open,
// and a country fetched once is not fetched again when a city is added.
let indexRequest: Promise<ProvinceFileEntry[]> | null = null;
const countryRequests = new Map<string, Promise<ProvinceFeature[]>>();

function loadIndex(): Promise<ProvinceFileEntry[]> {
  indexRequest ??= fetch(`${BASE}/index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<ProvinceFileEntry[]>) : []))
    .catch(() => {
      indexRequest = null; // let a later visit try again
      return [];
    });
  return indexRequest;
}

function loadCountry(a3: string): Promise<ProvinceFeature[]> {
  let request = countryRequests.get(a3);
  if (!request) {
    request = fetch(`${BASE}/${a3}.json`)
      .then(async (r) => {
        if (!r.ok) return [];
        const topo = (await r.json()) as Topology<{ p: GeometryCollection }>;
        return (feature(topo, topo.objects.p) as unknown as { features: ProvinceFeature[] })
          .features;
      })
      .catch(() => {
        countryRequests.delete(a3);
        return [];
      });
    countryRequests.set(a3, request);
  }
  return request;
}

/**
 * The provinces your visited cities are in, for the World globe.
 *
 * Fetches only the countries holding one of your cities (a few kilometres
 * of outline each), and works the rest out in the browser — no lookups, so
 * nothing about where you have been leaves the device. Empty until loaded,
 * and empty if the files cannot be fetched: the globe still shows countries
 * and cities without them.
 */
export function useVisitedProvinces(cities: readonly VisitedCity[]): VisitedProvince[] {
  const [provinces, setProvinces] = useState<VisitedProvince[]>([]);
  // What the answer depends on, as a value: a new array of the same cities
  // on every render must not start the work again.
  const shape = cities.map((c) => `${c.key}@${c.lat.toFixed(4)},${c.lon.toFixed(4)}`).join("|");

  useEffect(() => {
    if (cities.length === 0) {
      setProvinces([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const index = await loadIndex();
      const files = provinceFilesFor(index, cities);
      const features = (await Promise.all(files.map(loadCountry))).flat();
      if (!cancelled) setProvinces(visitedProvinces(cities, features));
    })();
    return () => {
      cancelled = true;
    };
  }, [shape]); // eslint-disable-line react-hooks/exhaustive-deps -- `shape` stands for `cities`

  return provinces;
}
