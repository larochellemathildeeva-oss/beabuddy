import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import worldTopo from "world-atlas/countries-110m.json";
import type { Pin } from "@/data/atlas";
import { countryKey } from "@/lib/country-names";

type AnyTopology = Parameters<typeof feature>[0];
const topo = worldTopo as unknown as AnyTopology;
const world = feature(topo, topo.objects["countries"]!) as unknown as FeatureCollection<
  Geometry,
  { name?: string }
>;

const W = 360;
const H = 188;

/**
 * The World tab's Stats view: the same places as the globe, laid flat so the
 * whole world is seen at once. Countries you have been to are shaded, your
 * provinces or states filled, and each city gets a pin. Not interactive —
 * the globe on the Map tab is the one to explore.
 */
export function WorldFlatMap({
  pins,
  visitedCountries,
  regions,
}: {
  pins: Pin[];
  visitedCountries: ReadonlySet<string>;
  regions?: { id: string; name: string; feature: Feature<Geometry, GeoJsonProperties> }[];
}) {
  const { countries, regionPaths, points } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent(
      [
        [4, 4],
        [W - 4, H - 4],
      ],
      { type: "Sphere" },
    );
    const path = geoPath(projection);
    return {
      countries: world.features.map((f, i) => ({
        id: String(f.id ?? i),
        d: path(f) ?? "",
        visited:
          Boolean(f.properties?.name) && visitedCountries.has(countryKey(f.properties?.name)),
      })),
      regionPaths: (regions ?? []).map((r) => ({ id: r.id, d: path(r.feature) ?? "" })),
      points: pins
        .map((pin) => {
          const p = projection([pin.lon, pin.lat]);
          return p ? { id: pin.id, name: pin.city || pin.name, x: p[0], y: p[1] } : null;
        })
        .filter((p): p is { id: string; name: string; x: number; y: number } => p !== null),
    };
  }, [pins, visitedCountries, regions]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`A flat map of the world with ${points.length} ${
        points.length === 1 ? "city" : "cities"
      } you have been to.`}
      className="block h-auto w-full"
    >
      {countries.map((c) =>
        c.d ? (
          <path
            key={c.id}
            d={c.d}
            fill={c.visited ? "var(--visited)" : "var(--primary)"}
            opacity={c.visited ? 0.55 : 0.18}
            stroke="var(--card)"
            strokeWidth={0.3}
          />
        ) : null,
      )}
      {regionPaths.map((r) =>
        r.d ? <path key={r.id} d={r.d} fill="var(--visited)" opacity={0.9} /> : null,
      )}
      {points.map((p) => (
        <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
          <title>{p.name}</title>
          {/* A map pin, its point on the place. */}
          <path
            d="M0 0 C-1.2 -2.6 -4 -4.6 -4 -7.6 A4 4 0 1 1 4 -7.6 C4 -4.6 1.2 -2.6 0 0 Z"
            fill="var(--primary)"
            stroke="var(--card)"
            strokeWidth={0.8}
          />
          <circle cy={-7.6} r={1.5} fill="var(--card)" />
        </g>
      ))}
    </svg>
  );
}
