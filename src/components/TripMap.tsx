import { useId, useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldTopo from "world-atlas/countries-110m.json";
import { formatMetres } from "@/lib/near";
import { haversine } from "@/lib/geo";
import { tripMapPlan, type MapStop } from "@/lib/trip-map";
import { OSM_ATTRIBUTION } from "@/lib/geo-endpoints";

const W = 720;
const H = 420;
const PAD = 56;
/**
 * One stop has no extent to fit, and fitExtent answers Infinity for it — which
 * projects every coordinate to NaN and draws nothing. A lone stop gets a fixed
 * regional scale instead: enough country around it to say where in the world
 * it is, which is all one point can tell you.
 */
const SINGLE_STOP_SCALE = 6_000;

type AnyTopology = Parameters<typeof feature>[0];
const topo = worldTopo as unknown as AnyTopology;
const world = feature(topo, topo.objects["countries"]!) as unknown as FeatureCollection<
  Geometry,
  { name?: string }
>;

function Pin({
  x,
  y,
  label,
  showLabel = true,
}: {
  x: number;
  y: number;
  label: string;
  showLabel?: boolean;
}) {
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <circle r="12" className="fill-primary" opacity="0.16" />
      <circle r="5.5" className="fill-primary stroke-card" strokeWidth="2" />
      {showLabel && (
        <text
          y="-18"
          textAnchor="middle"
          fontSize="13.5"
          fontWeight="600"
          className="fill-foreground stroke-elevated"
          paintOrder="stroke"
          strokeWidth="4"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function Route({ points }: { points: [number, number][] }) {
  if (points.length < 2) return null;
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  return (
    <path
      d={d}
      fill="none"
      className="stroke-primary"
      strokeWidth="2.25"
      strokeDasharray="6 5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.9"
    />
  );
}

/**
 * Country outlines fitted to the stops. The basemap is the same bundled
 * topology the globe draws, so this costs no request and works with no
 * connection — which a tile map could not.
 */
function Geographic({ stops, showLabels = true }: { stops: MapStop[]; showLabels?: boolean }) {
  const clip = useId();
  const { land, points } = useMemo(() => {
    const only = stops[0]!;
    const projection =
      stops.length === 1
        ? geoMercator()
            .scale(SINGLE_STOP_SCALE)
            .center([only.lon, only.lat])
            .translate([W / 2, H / 2])
        : geoMercator().fitExtent(
            [
              [PAD, PAD],
              [W - PAD, H - PAD],
            ],
            { type: "MultiPoint", coordinates: stops.map((s) => [s.lon, s.lat]) },
          );
    const path = geoPath(projection);
    return {
      land: world.features.map((f, i) => ({ id: i, d: path(f) ?? "" })).filter((f) => f.d),
      points: stops.map((s) => projection([s.lon, s.lat]) as [number, number]),
    };
  }, [stops]);

  return (
    <>
      <defs>
        <clipPath id={clip}>
          <rect width={W} height={H} rx="18" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {land.map((f) => (
          <path key={f.id} d={f.d} className="fill-card stroke-border" strokeWidth="0.8" />
        ))}
        <Route points={points} />
        {stops.map((s, i) => (
          <Pin
            key={`${s.title}-${i}`}
            x={points[i]![0]}
            y={points[i]![1]}
            label={s.title}
            showLabel={showLabels}
          />
        ))}
      </g>
    </>
  );
}

/**
 * No basemap. Inside one city the country outlines are nowhere near the stops,
 * so drawing them would be a map that shows nothing. This shows what is
 * actually known: where the stops sit relative to each other, and how far
 * apart they really are.
 */
function Schematic({ stops, showLabels = true }: { stops: MapStop[]; showLabels?: boolean }) {
  const { points, legs } = useMemo(() => {
    const lons = stops.map((s) => s.lon);
    const lats = stops.map((s) => s.lat);
    const mid = {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lon: (Math.min(...lons) + Math.max(...lons)) / 2,
    };
    // Longitude degrees shrink with latitude; without this a city reads skewed.
    const kx = Math.cos((mid.lat * Math.PI) / 180);
    const spanX = (Math.max(...lons) - Math.min(...lons)) * kx || 1e-4;
    const spanY = Math.max(...lats) - Math.min(...lats) || 1e-4;
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);

    const pts = stops.map(
      (s) =>
        [W / 2 + (s.lon - mid.lon) * kx * scale, H / 2 - (s.lat - mid.lat) * scale] as [
          number,
          number,
        ],
    );
    return {
      points: pts,
      legs: stops.slice(1).map((to, i) => ({
        label: formatMetres(haversine(stops[i]!, to)),
        x: (pts[i]![0] + pts[i + 1]![0]) / 2,
        y: (pts[i]![1] + pts[i + 1]![1]) / 2 - 7,
      })),
    };
  }, [stops]);

  return (
    <>
      <g opacity="0.45">
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i}>
            <line
              x1={i * 90}
              y1="0"
              x2={i * 90}
              y2={H}
              className="stroke-border"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1={i * 52.5}
              x2={W}
              y2={i * 52.5}
              className="stroke-border"
              strokeWidth="0.5"
            />
          </g>
        ))}
      </g>
      <Route points={points} />
      {stops.map((s, i) => (
        <Pin
          key={`${s.title}-${i}`}
          x={points[i]![0]}
          y={points[i]![1]}
          label={s.title}
          showLabel={showLabels}
        />
      ))}
      {showLabels &&
        legs.map((leg) => (
          <text
            key={`${leg.x}-${leg.y}`}
            x={leg.x.toFixed(1)}
            y={leg.y.toFixed(1)}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="600"
            className="fill-muted-foreground stroke-elevated"
            paintOrder="stroke"
            strokeWidth="4"
          >
            {leg.label}
          </text>
        ))}
    </>
  );
}

/**
 * The trip, drawn.
 *
 * Every stop already stored a position and none of it was ever shown. This
 * uses the stop list the directions download uses, so the two can never
 * describe different journeys, and the basemap the globe already bundles, so
 * it needs no tile provider, no key and no network.
 */
export function TripMap({
  stops,
  area,
  compact = false,
}: {
  stops: { title: string; lat?: number | null | undefined; lon?: number | null | undefined }[];
  /** Shown when nothing can be placed, to name what is missing. */
  area?: string | null;
  /**
   * The bare drawing, for use as a backdrop on a trip card: no panel, no
   * caption, no pin labels, and nothing at all when the trip cannot be
   * placed. A card has no room to explain itself and should not try.
   */
  compact?: boolean;
}) {
  const plan = useMemo(() => tripMapPlan(stops), [stops]);

  if (plan.kind === "none") {
    if (compact) return null;
    // Only worth saying once there is an itinerary to place.
    if (plan.reason === "no-stops") return null;
    return (
      <div className="mb-3 rounded-xl bg-elevated p-3">
        <p className="label-caps text-foreground">On the map</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          None of {area ? `your ${area} stops` : "these stops"} has a location yet, so there is
          nothing to draw. Add an address to a stop and it appears here.
        </p>
      </div>
    );
  }

  const single = plan.kind === "single";
  const drawn: MapStop[] = single ? [plan.stop] : plan.stops;

  if (compact) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
        {plan.kind === "geographic" || single ? (
          <Geographic stops={drawn} showLabels={false} />
        ) : (
          <Schematic stops={drawn} showLabels={false} />
        )}
      </svg>
    );
  }

  return (
    <div className="mb-3 overflow-hidden rounded-xl bg-elevated">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={
          single
            ? `Map showing ${plan.stop.title}`
            : `Map of ${drawn.length} stops, ${drawn.map((s) => s.title).join(" to ")}`
        }
      >
        {plan.kind === "geographic" || single ? (
          <Geographic stops={drawn} />
        ) : (
          <Schematic stops={drawn} />
        )}
      </svg>
      {plan.kind === "schematic" && (
        <p className="px-3 pb-2.5 pt-1 text-[12px] text-muted-foreground">
          These stops are close together, so this shows how they sit relative to each other rather
          than a street map.
        </p>
      )}
      {/* The credit ODbL asks for, next to the data it applies to. The pins
          are geocoded from OpenStreetMap however they got here. */}
      {!compact && (
        <p className="px-3 pb-2 text-[11.5px] text-muted-foreground">{OSM_ATTRIBUTION}</p>
      )}
    </div>
  );
}
