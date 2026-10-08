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

type Box = { x0: number; x1: number; y0: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Each country's name goes right of its ring, or left when a pin or another
 * name is there, or not at all: the ring still marks it, and says its name
 * when held. The map is too small to print every name over Europe.
 */
function placeRingLabels<T extends { name: string; x: number; y: number }>(
  rings: T[],
  pins: readonly { x: number; y: number }[],
): (T & { side: "right" | "left" | null })[] {
  const taken: Box[] = pins.map(({ x, y }) => ({ x0: x - 4, x1: x + 4, y0: y - 12, y1: y }));
  return rings.map((ring) => {
    const width = ring.name.length * 3.6;
    const right: Box = { x0: ring.x + 3, x1: ring.x + 4 + width, y0: ring.y - 3, y1: ring.y + 3 };
    const left: Box = { x0: ring.x - 4 - width, x1: ring.x - 3, y0: ring.y - 3, y1: ring.y + 3 };
    const fits = (box: Box) => box.x0 >= 0 && box.x1 <= W && !taken.some((t) => overlaps(t, box));
    const side = fits(right) ? "right" : fits(left) ? "left" : null;
    if (side) taken.push(side === "right" ? right : left);
    return { ...ring, side };
  });
}

/**
 * The World tab's Stats view: the same places as the globe, laid flat so the
 * whole world is seen at once. Countries you have been to are shaded, your
 * provinces or states filled, each city gets a pin and each country a ring,
 * as on the globe. Not interactive —
 * the globe on the Map tab is the one to explore.
 */
export function WorldFlatMap({
  pins,
  visitedCountries,
  regions,
  countryMarks,
  atlas = false,
}: {
  /**
   * World's Map view, as the minimalist design draws it: hairline countries,
   * the ones you have been to faintly filled, a dot per city, no names.
   */
  atlas?: boolean;
  pins: Pin[];
  visitedCountries: ReadonlySet<string>;
  regions?: { id: string; name: string; feature: Feature<Geometry, GeoJsonProperties> }[];
  /** Every country you have been to, as the globe marks it. */
  countryMarks?: { key: string; name: string; lat: number; lon: number }[] | undefined;
}) {
  const { countries, regionPaths, points, rings } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent(
      [
        [4, 4],
        [W - 4, H - 4],
      ],
      { type: "Sphere" },
    );
    const path = geoPath(projection);
    const points = pins
      .map((pin) => {
        const p = projection([pin.lon, pin.lat]);
        return p ? { id: pin.id, name: pin.city || pin.name, x: p[0], y: p[1] } : null;
      })
      .filter((p): p is { id: string; name: string; x: number; y: number } => p !== null);
    return {
      countries: world.features.map((f, i) => ({
        id: String(f.id ?? i),
        d: path(f) ?? "",
        visited:
          Boolean(f.properties?.name) && visitedCountries.has(countryKey(f.properties?.name)),
      })),
      regionPaths: (regions ?? []).map((r) => ({ id: r.id, d: path(r.feature) ?? "" })),
      points,
      rings: placeRingLabels(
        (countryMarks ?? [])
          .map((mark) => {
            const p = projection([mark.lon, mark.lat]);
            return p ? { key: mark.key, name: mark.name, x: p[0], y: p[1] } : null;
          })
          .filter((p): p is { key: string; name: string; x: number; y: number } => p !== null),
        points,
      ),
    };
  }, [pins, visitedCountries, regions, countryMarks]);

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
        c.d && atlas ? (
          <path
            key={c.id}
            d={c.d}
            fill={c.visited ? "var(--muted)" : "none"}
            stroke="var(--border)"
            strokeWidth={0.4}
          />
        ) : c.d ? (
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
        r.d ? (
          <path
            key={r.id}
            d={r.d}
            fill={atlas ? "var(--border)" : "var(--visited)"}
            opacity={atlas ? 1 : 0.9}
          />
        ) : null,
      )}
      {atlas
        ? points.map((p) => (
            <circle key={p.id} cx={p.x} cy={p.y} r={2.2} fill="var(--foreground)">
              <title>{p.name}</title>
            </circle>
          ))
        : null}
      {(atlas ? [] : points).map((p) => (
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
      {/* Country rings go over the city pins, as on the globe, with the
          name beside them where it has room. */}
      {(atlas ? [] : rings).map((r) => (
        <g key={`country-${r.key}`}>
          <title>{r.name}</title>
          <circle
            cx={r.x}
            cy={r.y}
            r={2.4}
            fill="var(--card)"
            stroke="var(--visited)"
            strokeWidth={1.2}
          />
          {r.side && (
            <text
              x={r.side === "right" ? r.x + 4 : r.x - 4}
              y={r.y + 2}
              textAnchor={r.side === "right" ? "start" : "end"}
              className="fill-foreground text-[5.5px] font-semibold uppercase"
              stroke="var(--card)"
              strokeWidth={1.6}
              paintOrder="stroke"
            >
              {r.name}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
