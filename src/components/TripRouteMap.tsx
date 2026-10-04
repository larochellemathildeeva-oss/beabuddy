import { useEffect, useId, useLayoutEffect, useMemo, useState } from "react";
import { geoMercator } from "d3-geo";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { useTownPicture } from "@/hooks/useTownPicture";
import { creditedOnPhoto } from "@/lib/wikimedia";
import {
  mapBounds,
  pillLabel,
  pillStops,
  placeLabels,
  placePills,
  reliefTiles,
  smoothPath,
  stayLabel,
  type Point,
  type RouteStop,
} from "@/lib/home-route-map";

/**
 * The frame the map is drawn in. On a phone the SVG scales to the screen's
 * width; on a wider column the frame widens instead, so the map, its pills and
 * the title over it keep their size rather than growing with the column.
 */
export const ROUTE_MAP_W = 390;
export const ROUTE_MAP_H = 300;
const PILL_H = 54;
/** Where the hero's words end over the map; pills stay below it. */
const TITLE_LINE = 112;
const PHOTO = 46;
/** Which terrain tiles exist ("z/x/y"): open sea has none. */
type ReliefIndex = ReadonlySet<string>;
let reliefIndex: Promise<ReliefIndex> | null = null;

/** The list of terrain tiles, fetched once and only when a map is drawn. */
function loadReliefIndex(): Promise<ReliefIndex> {
  reliefIndex ??= fetch("/relief/index.json")
    .then((r): Promise<Record<string, string[]>> => (r.ok ? r.json() : Promise.resolve({})))
    .then(
      (byZoom) =>
        new Set(Object.entries(byZoom).flatMap(([z, keys]) => keys.map((k) => `${z}/${k}`))),
    )
    .catch(() => {
      reliefIndex = null;
      return new Set<string>();
    });
  return reliefIndex;
}

function pillWidth(stop: RouteStop): number {
  const longest = Math.max(pillLabel(stop.city).length, stayLabel(stop.days).length);
  // Wide enough for the longest name a pill shows (PILL_LABEL_MAX letters).
  return Math.min(220, Math.max(118, PHOTO + 34 + longest * 8.6));
}

/**
 * Home's living map: the trip's part of the world in real relief, its cities
 * joined by one line, a pill beside each saying how long you stay. Colours come from
 * the mood (`--map-*`, `--route-*`, `--pill-*` in styles.css).
 */
export function TripRouteMap({ stops, label }: { stops: RouteStop[]; label: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const width = useFrameWidth(svg);
  const [relief, setRelief] = useState<ReliefIndex | null>(null);
  useEffect(() => {
    let live = true;
    void loadReliefIndex().then((index) => live && setRelief(index));
    return () => {
      live = false;
    };
  }, []);
  const drawn = useMemo(() => {
    if (stops.length === 0) return null;
    // Close around the cities, so they spread across the frame; a one-city
    // trip still gets a few degrees of its country around it.
    const {
      center,
      corners: [[w, s], [e, n]],
    } = mapBounds(stops, 2.6, 1.4, 0.12);
    // Turned so the trip is in the middle of the map: a trip across the 180°
    // line stays in one piece.
    const corners = {
      type: "MultiPoint" as const,
      coordinates: [
        [w + center, s],
        [e + center, n],
      ],
    };
    // The cities sit in the lower part of the frame: the title is over the top.
    const projection = geoMercator()
      .rotate([-center, 0])
      .fitExtent(
        [
          [width * 0.16, ROUTE_MAP_H * 0.45],
          [width * 0.84, ROUTE_MAP_H * 0.8],
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
      width,
      height: ROUTE_MAP_H,
      pillWidth: Math.max(...widths),
      pillHeight: PILL_H,
      top: TITLE_LINE,
    }).map((p) => ({ ...p, w: pillWidth(stops[p.index]!) }));
    // The terrain under it all: real relief, as fine as the screen's pixels.
    const tiles = reliefTiles({
      scale: projection.scale(),
      translate: projection.translate(),
      center,
      width,
      height: ROUTE_MAP_H,
      dpr: typeof window === "undefined" ? 2 : Math.max(1, window.devicePixelRatio || 1),
    });
    return { dots, pills, tiles };
  }, [stops, width]);

  if (!drawn) return null;
  const { dots, pills, tiles } = drawn;
  const first = dots[0]!;
  const flight = flightTrail(first, width);

  return (
    <svg
      ref={setSvg}
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${ROUTE_MAP_H}`}
      className="route-map block h-auto w-full"
    >
      <defs>
        <filter id={`${id}-pill`} x="-20%" y="-30%" width="140%" height="170%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" className="pill-shadow" />
        </filter>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="map-fade" stopOpacity="0.85" />
          <stop offset="0.16" className="map-fade" stopOpacity="0" />
          <stop offset="0.84" className="map-fade" stopOpacity="0" />
          <stop offset="1" className="map-fade" stopOpacity="1" />
        </linearGradient>
        {pills.map((p) => (
          <clipPath key={p.index} id={`${id}-photo-${p.index}`}>
            <circle cx={p.x + 4 + PHOTO / 2} cy={p.y + PILL_H / 2} r={PHOTO / 2} />
          </clipPath>
        ))}
      </defs>

      {/* The sea, then the land: Natural Earth II's shaded relief and land
          cover (public domain), with its sea painted out. A tile of open sea
          was never built, so the sea shows through where none answers. */}
      <rect width={width} height={ROUTE_MAP_H} className="map-sea" />
      {tiles
        .filter((t) => relief?.has(`${t.z}/${t.x}/${t.y}`))
        .map((t) => (
          <image
            key={`${t.z}/${t.x}/${t.y}/${t.left}`}
            href={`/relief/${t.z}/${t.x}/${t.y}.webp`}
            x={t.left}
            y={t.top}
            // A hair over, so no seam shows between tiles.
            width={t.size + 0.6}
            height={t.size + 0.6}
            preserveAspectRatio="none"
          />
        ))}
      {/* The mood's wash over the terrain: lighter for Calm, darker for Dark. */}
      <rect width={width} height={ROUTE_MAP_H} className="map-wash" />
      <rect width={width} height={ROUTE_MAP_H} fill={`url(#${id}-fade)`} />

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

/**
 * The frame's width: the column's width in pixels, never under the phone frame
 * (a narrower phone scales the phone frame down, as before).
 */
function useFrameWidth(el: SVGSVGElement | null, min = ROUTE_MAP_W): number {
  const [width, setWidth] = useState(ROUTE_MAP_W);
  // Measured before paint, so a wide column never shows the phone frame first;
  // resizes are taken once a frame, since each one re-projects the coastline.
  useLayoutEffect(() => {
    if (!el) return;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.max(min, Math.round(w)));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const watch = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(read);
    });
    watch.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
    };
  }, [el, min]);
  return width;
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
  // A pill is too small to carry a photo's author and licence, so it shows
  // only photos credited once for all (Pexels), else Béa's painting.
  const photo = town.photo && !creditedOnPhoto(town.photo) ? town.photo : null;
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
        href={photo?.url ?? art}
        x={cx - PHOTO / 2}
        y={cy - PHOTO / 2}
        width={PHOTO}
        height={PHOTO}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clip})`}
        onError={photo ? town.onError : undefined}
      />
      <circle cx={cx} cy={cy} r={PHOTO / 2} className="route-photo-ring" />
      <text x={x + PHOTO + 16} y={days ? cy - 3 : cy + 5} className="route-city">
        {pillLabel(stop.city)}
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
function flightTrail(first: Point, width: number) {
  const start = first;
  const end = {
    x: Math.min(width - 40, first.x + 60),
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

/**
 * The trip page's banner in Stops mode (UI revamp, `tripHero` in the mockup):
 * the same terrain as Home's map filling the banner, a white glowing line
 * through the cities, each named in white beside its dot. The stop you are in
 * is ringed in the accent; stops already behind you are hollow, with the line
 * to them in the accent. A haze of the page's own colour sits over the top,
 * under the trip's name.
 */
export function TripBannerMap({
  stops,
  label,
  height,
  current = -1,
  done = 0,
  top,
  bottom,
}: {
  stops: RouteStop[];
  label: string;
  height: number;
  /** The band the cities are drawn in: below the words, above the foot. */
  top: number;
  bottom: number;
  /** Index of the stop you are in, ringed; -1 for none. */
  current?: number;
  /** How many stops are behind you. */
  done?: number;
}) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  // Its real width, never the phone frame: the banner's height is fixed, so a
  // wider frame would be cropped at the sides and cut a name off.
  const width = useFrameWidth(svg, 0);
  const [relief, setRelief] = useState<ReliefIndex | null>(null);
  useEffect(() => {
    let live = true;
    void loadReliefIndex().then((index) => live && setRelief(index));
    return () => {
      live = false;
    };
  }, []);
  const drawn = useMemo(() => {
    if (stops.length === 0) return null;
    const {
      center,
      corners: [[w, s], [e, n]],
    } = mapBounds(stops, 2.6, 1.4, 0.12);
    const corners = {
      type: "MultiPoint" as const,
      coordinates: [
        [w + center, s],
        [e + center, n],
      ],
    };
    // The cities sit between the trip's name and the panel rising over the
    // bottom of the banner.
    const projection = geoMercator()
      .rotate([-center, 0])
      .fitExtent(
        [
          [width * 0.16, top],
          [width * 0.84, Math.max(top + 40, bottom)],
        ],
        corners,
      );
    const dots: Point[] = stops.map((stop) => {
      const [x, y] = projection([stop.lon, stop.lat]) ?? [0, 0];
      return { x, y };
    });
    const labels = placeLabels(
      dots,
      stops.map((s) => pillLabel(s.city)),
      { width, keep: current },
    );
    const tiles = reliefTiles({
      scale: projection.scale(),
      translate: projection.translate(),
      center,
      width,
      height,
      dpr: typeof window === "undefined" ? 2 : Math.max(1, window.devicePixelRatio || 1),
    });
    return { dots, labels, tiles };
  }, [stops, width, height, current, top, bottom]);

  if (!drawn) return null;
  const { dots, labels, tiles } = drawn;
  // Dots behind you: every one once the trip is over. The line in the accent
  // stops at the last dot.
  const behind = Math.max(0, Math.min(done, dots.length));
  const lineTo = Math.min(behind, dots.length - 1);

  return (
    <svg
      ref={setSvg}
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className="route-map banner-map absolute inset-0 size-full"
    >
      <defs>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width={width} height={height} className="map-sea" />
      {tiles
        .filter((t) => relief?.has(`${t.z}/${t.x}/${t.y}`))
        .map((t) => (
          <image
            key={`${t.z}/${t.x}/${t.y}/${t.left}`}
            href={`/relief/${t.z}/${t.x}/${t.y}.webp`}
            x={t.left}
            y={t.top}
            width={t.size + 0.6}
            height={t.size + 0.6}
            preserveAspectRatio="none"
          />
        ))}
      <rect width={width} height={height} className="map-wash" />

      {dots.length > 1 ? (
        <>
          <path d={smoothPath(dots)} className="banner-route-glow" filter={`url(#${id}-glow)`} />
          <path d={smoothPath(dots)} className="banner-route" />
          {lineTo > 0 ? (
            <path d={smoothPath(dots.slice(0, lineTo + 1))} className="banner-route-done" />
          ) : null}
        </>
      ) : null}
      {dots.map((d, i) =>
        i === current ? (
          <g key={i}>
            <circle cx={d.x} cy={d.y} r={18} className="banner-dot-halo" />
            <circle cx={d.x} cy={d.y} r={11} className="banner-dot-ring" />
            <circle cx={d.x} cy={d.y} r={7} className="banner-dot-here" />
          </g>
        ) : (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={i < behind ? 6 : 7}
            className={i < behind ? "banner-dot-done" : "banner-dot"}
          />
        ),
      )}
      {labels.map((l) => (
        <text
          key={l.index}
          x={l.x}
          y={l.y}
          dy="0.35em"
          textAnchor={l.anchor}
          className={l.index === current ? "banner-label banner-label-here" : "banner-label"}
        >
          {pillLabel(stops[l.index]!.city)}
        </text>
      ))}
    </svg>
  );
}
