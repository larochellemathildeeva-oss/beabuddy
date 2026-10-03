import { useEffect, useId, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { useTownPicture } from "@/hooks/useTownPicture";
import {
  mapBounds,
  pillStops,
  placePills,
  smoothPath,
  stayLabel,
  type Point,
  type RouteStop,
} from "@/lib/home-route-map";

/** The frame the map is drawn in; the SVG scales to the screen's width. */
export const ROUTE_MAP_W = 390;
export const ROUTE_MAP_H = 300;
const PILL_H = 54;
/** Where the hero's words end over the map; pills stay below it. */
const TITLE_LINE = 112;
const PHOTO = 46;

type Land = FeatureCollection<Geometry>;
let landPromise: Promise<Land> | null = null;

/** The world's coastlines, fetched once and only when a map is drawn. */
function loadLand(): Promise<Land> {
  landPromise ??= import("world-atlas/land-50m.json").then((m) => {
    const topo = (m.default ?? m) as unknown as Parameters<typeof feature>[0] & {
      objects: { land: Parameters<typeof feature>[1] };
    };
    return feature(topo, topo.objects.land) as unknown as Land;
  });
  return landPromise;
}

function pillWidth(stop: RouteStop): number {
  const longest = Math.max(stop.city.length, stayLabel(stop.days).length);
  return Math.min(176, Math.max(118, PHOTO + 34 + longest * 8.6));
}

/**
 * Home's living map: the trip's part of the world in relief, its cities joined
 * by one line, a pill beside each saying how long you stay. Colours come from
 * the mood (`--map-*`, `--route-*`, `--pill-*` in styles.css).
 */
export function TripRouteMap({ stops, label }: { stops: RouteStop[]; label: string }) {
  const id = useId().replace(/:/g, "");
  const [land, setLand] = useState<Land | null>(null);
  useEffect(() => {
    let live = true;
    loadLand()
      .then((l) => live && setLand(l))
      .catch(() => {
        // No coastline: the route still draws on the plain ground.
      });
    return () => {
      live = false;
    };
  }, []);

  const drawn = useMemo(() => {
    if (stops.length === 0) return null;
    // Close around the cities, so they spread across the frame; a one-city
    // trip still gets a few degrees of its country around it.
    const [[w, s], [e, n]] = mapBounds(stops, 4, 2.5, 0.06);
    const corners = {
      type: "MultiPoint" as const,
      coordinates: [
        [w, s],
        [e, n],
      ],
    };
    // The cities sit in the lower part of the frame: the title is over the top.
    const projection = geoMercator().fitExtent(
      [
        [ROUTE_MAP_W * 0.16, ROUTE_MAP_H * 0.45],
        [ROUTE_MAP_W * 0.84, ROUTE_MAP_H * 0.8],
      ],
      corners,
    );
    const dots: Point[] = stops.map((stop) => {
      const [x, y] = projection([stop.lon, stop.lat]) ?? [0, 0];
      return { x, y };
    });
    const which = pillStops(stops);
    const widths = which.map((i) => pillWidth(stops[i]!));
    const pills = placePills(dots, which, {
      width: ROUTE_MAP_W,
      height: ROUTE_MAP_H,
      pillWidth: Math.max(...widths),
      pillHeight: PILL_H,
      top: TITLE_LINE,
    }).map((p) => ({ ...p, w: pillWidth(stops[p.index]!) }));
    return { projection, dots, pills };
  }, [stops]);

  const landPath = useMemo(() => {
    if (!land || !drawn) return "";
    return geoPath(drawn.projection)(land) ?? "";
  }, [land, drawn]);

  if (!drawn) return null;
  const { dots, pills } = drawn;
  const first = dots[0]!;
  const flight = flightTrail(first);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${ROUTE_MAP_W} ${ROUTE_MAP_H}`}
      className="route-map block h-auto w-full"
    >
      <defs>
        <filter id={`${id}-relief`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.022"
            numOctaves="6"
            seed="11"
            result="noise"
          />
          <feDiffuseLighting in="noise" surfaceScale="9" result="rawLit" className="map-light">
            <feDistantLight azimuth="225" elevation="46" />
          </feDiffuseLighting>
          {/* Soft shadows: the relief reads as raised paper, not as rock. */}
          <feComponentTransfer in="rawLit" result="lit">
            <feFuncR type="linear" slope="0.62" intercept="0.4" />
            <feFuncG type="linear" slope="0.62" intercept="0.4" />
            <feFuncB type="linear" slope="0.62" intercept="0.4" />
          </feComponentTransfer>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012"
            numOctaves="3"
            seed="3"
            result="patch"
          />
          <feColorMatrix
            in="patch"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 9 -4.2"
            result="mask"
          />
          <feFlood className="map-green" result="green" />
          <feComposite in="green" in2="mask" operator="in" result="greens" />
          <feMerge result="painted">
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="greens" />
          </feMerge>
          <feBlend in="lit" in2="painted" mode="multiply" result="shaded" />
          <feComposite in="shaded" in2="SourceGraphic" operator="in" />
        </filter>
        <filter id={`${id}-lift`}>
          <feDropShadow dx="1.5" dy="2.5" stdDeviation="2.5" className="map-shadow" />
        </filter>
        <filter id={`${id}-pill`} x="-20%" y="-30%" width="140%" height="170%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" className="pill-shadow" />
        </filter>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="map-fade" stopOpacity="1" />
          <stop offset="0.28" className="map-fade" stopOpacity="0" />
          <stop offset="0.8" className="map-fade" stopOpacity="0" />
          <stop offset="1" className="map-fade" stopOpacity="1" />
        </linearGradient>
        {pills.map((p) => (
          <clipPath key={p.index} id={`${id}-photo-${p.index}`}>
            <circle cx={p.x + 4 + PHOTO / 2} cy={p.y + PILL_H / 2} r={PHOTO / 2} />
          </clipPath>
        ))}
      </defs>

      {landPath ? (
        <g filter={`url(#${id}-lift)`}>
          <path d={landPath} className="map-land" filter={`url(#${id}-relief)`} />
        </g>
      ) : null}
      <rect width={ROUTE_MAP_W} height={ROUTE_MAP_H} fill={`url(#${id}-fade)`} />

      {/* The flight in: a dotted trail into the first city, with its plane. */}
      <path d={flight.path} className="route-trail" />
      <g transform={`translate(${flight.plane.x} ${flight.plane.y}) rotate(${flight.plane.angle})`}>
        <path
          d="M8 0 L-5 -2.2 L-8 -8 L-10.5 -8 L-8 -1.6 L-12 -1.2 L-13.5 -4 L-15 -4 L-14 0 L-15 4 L-13.5 4 L-12 1.2 L-8 1.6 L-10.5 8 L-8 8 L-5 2.2 Z"
          className="route-plane"
        />
      </g>

      <path d={smoothPath(dots)} className="route-line" />
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={i === 0 ? 5.5 : 6.5}
          className={
            i === dots.length - 1 ? "route-dot-end" : i === 0 ? "route-dot-start" : "route-dot"
          }
        />
      ))}

      {pills.map((p, n) => (
        <StopPill
          key={p.index}
          stop={stops[p.index]!}
          x={p.x}
          y={p.y}
          w={p.w}
          tone={n % 3}
          clip={`${id}-photo-${p.index}`}
          shadow={`${id}-pill`}
        />
      ))}
    </svg>
  );
}

function StopPill({
  stop,
  x,
  y,
  w,
  tone,
  clip,
  shadow,
}: {
  stop: RouteStop;
  x: number;
  y: number;
  w: number;
  tone: number;
  clip: string;
  shadow: string;
}) {
  const town = useTownPicture(false, stop.city, stop.country);
  const art = bannerArtUrl(bannerSceneFor([stop.city, stop.country], stop.city));
  const cx = x + 4 + PHOTO / 2;
  const cy = y + PILL_H / 2;
  const days = stayLabel(stop.days);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={PILL_H}
        rx={PILL_H / 2}
        className={`route-pill route-pill-${tone}`}
        filter={`url(#${shadow})`}
      />
      <image
        href={town.photo?.url ?? art}
        x={cx - PHOTO / 2}
        y={cy - PHOTO / 2}
        width={PHOTO}
        height={PHOTO}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clip})`}
        onError={town.onError}
      />
      <circle cx={cx} cy={cy} r={PHOTO / 2} className="route-photo-ring" />
      <text x={x + PHOTO + 16} y={days ? cy - 3 : cy + 5} className="route-city">
        {stop.city}
      </text>
      {days ? (
        <text x={x + PHOTO + 16} y={cy + 14} className="route-days">
          {days}
        </text>
      ) : null}
    </g>
  );
}

/** A dotted arc rising from the first city toward the top of the map, and where its plane sits. */
function flightTrail(first: Point) {
  const start = first;
  const end = {
    x: Math.min(ROUTE_MAP_W - 40, first.x + 60),
    y: Math.max(TITLE_LINE + 10, first.y - 150),
  };
  const c = { x: first.x - 45, y: first.y - 80 };
  const at = (t: number) => ({
    x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * c.x + t ** 2 * end.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * c.y + t ** 2 * end.y,
  });
  const t = 0.5;
  const p = at(t);
  const ahead = at(t + 0.02);
  const angle = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;
  return {
    path: `M${start.x} ${start.y} Q${c.x} ${c.y} ${end.x} ${end.y}`,
    plane: { x: p.x, y: p.y, angle },
  };
}
