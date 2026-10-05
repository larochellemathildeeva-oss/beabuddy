import { useEffect, useId, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { geoMercator } from "d3-geo";
import { useThemeName } from "@/hooks/useThemeName";
import { stopsOnArt, type Pt } from "@/lib/aerial-route";
import {
  mapBounds,
  pillLabel,
  placeLabels,
  reliefTiles,
  smoothPath,
  type ReliefTile,
} from "@/lib/home-route-map";
import { terrainSrc, type TerrainArt } from "@/lib/terrain-art";

/** Which terrain tiles exist ("z/x/y"): open sea has none. */
type ReliefIndex = ReadonlySet<string>;
let reliefIndex: Promise<ReliefIndex> | null = null;

/** The app's list of relief tiles (`public/relief/index.json`), fetched once. */
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

function useReliefIndex(wanted: boolean): ReliefIndex | null {
  const [relief, setRelief] = useState<ReliefIndex | null>(null);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    void loadReliefIndex().then((index) => live && setRelief(index));
    return () => {
      live = false;
    };
  }, [wanted]);
  return relief;
}

/** The banner's real width (its height is fixed), measured before paint. */
function useFrameWidth(el: Element | null, fallback = 390): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    if (!el) return;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.round(w));
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
  }, [el]);
  return width;
}

export type AerialPlace = { city: string; lat: number; lon: number };

type Source = "terrain" | "relief" | "scene";

/**
 * The aerial banner of Home and Trips (the "three moods" references): a
 * picture of the trip's part of the world with its route drawn over it in
 * code — a glowing line through the stops, the one you are in ringed in the
 * accent, the ones behind you filled, each named in a small tag.
 *
 * The picture, in order: the owner's terrain art for the destination
 * (`terrain-art.ts`; drawn as a true map when it has a box), else the app's
 * Natural Earth relief tiles (the same terrain as Home's living map, richer
 * here), else the destination's `banner-art.ts` scene. Nothing else is
 * invented: every dot is a stop of the trip at its own position.
 *
 * `children` draws over the banner at the stops' positions (bubbles, tags),
 * in the banner's pixels, so they can be links.
 */
export function AerialBanner({
  places,
  label,
  height,
  top,
  bottom,
  current = -1,
  done = 0,
  terrain = null,
  scene,
  mode = "route",
  compact = false,
  showLabels = true,
  spread = [0.16, 0.84],
  footInset = 4,
  children,
}: {
  places: readonly AerialPlace[];
  label: string;
  height: number;
  /** The band the stops are drawn in: below the words, above the foot. */
  top: number;
  bottom: number;
  /** Index of the stop you are in (ringed); -1 for none. */
  current?: number;
  /** How many stops are behind you. */
  done?: number;
  /** The owner's art for this destination (`terrainFor`), if any. */
  terrain?: TerrainArt | null;
  /** The destination's painted scene (`bannerArtUrl`), the last fallback. */
  scene?: string;
  /** A route through the stops, or pins alone (saved cities, the trips' places). */
  mode?: "route" | "pins";
  /** A small picture (a row, a tile): smaller dots and tags. */
  compact?: boolean;
  showLabels?: boolean;
  /** How much of the width the stops spread over, as fractions. */
  spread?: readonly [number, number];
  /** How much of the banner's foot is covered (a panel rising over it): the credit sits above. */
  footInset?: number;
  children?: (points: Pt[], width: number) => ReactNode;
}) {
  const id = useId().replace(/:/g, "");
  const theme = useThemeName();
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const width = useFrameWidth(box);
  const relief = useReliefIndex(!terrain);
  const drawn = useMemo(() => {
    if (places.length === 0) return null;
    const frame = { width, height };
    if (terrain?.bounds && terrain.width && terrain.height) {
      const { points, frame: art } = stopsOnArt(
        places,
        terrain.bounds,
        { width: terrain.width, height: terrain.height },
        frame,
        { top, bottom },
      );
      return { points, tiles: [] as ReliefTile[], art };
    }
    const route = mode === "route";
    const {
      center,
      corners: [[w, s], [e, n]],
    } = route ? mapBounds(places, 2.6, 1.4, 0.12) : mapBounds(places, 14, 8, 0.2);
    const projection = geoMercator()
      .rotate([-center, 0])
      .fitExtent(
        [
          [width * spread[0], top],
          [width * spread[1], Math.max(top + (compact ? 10 : 40), bottom)],
        ],
        {
          type: "MultiPoint" as const,
          coordinates: [
            [w + center, s],
            [e + center, n],
          ],
        },
      );
    const points = places.map((p) => {
      const [x, y] = projection([p.lon, p.lat]) ?? [0, 0];
      return { x, y };
    });
    const tiles = reliefTiles({
      scale: projection.scale(),
      translate: projection.translate(),
      center,
      width,
      height,
      dpr: typeof window === "undefined" ? 2 : Math.max(1, window.devicePixelRatio || 1),
    });
    return { points, tiles, art: null };
  }, [places, width, height, top, bottom, terrain, mode, compact, spread]);

  // Relief only where it has a tile under this trip; else the destination's scene.
  const hasRelief = (drawn?.tiles ?? []).some((t) => relief?.has(`${t.z}/${t.x}/${t.y}`));
  const source: Source = terrain ? "terrain" : relief && !hasRelief && scene ? "scene" : "relief";

  const labels = useMemo(() => {
    if (!drawn || !showLabels || mode !== "route") return [];
    const k = compact ? 0.85 : 1;
    return placeLabels(
      drawn.points,
      places.map((p) => pillLabel(p.city)),
      { width, keep: current, letter: 7.9 * k, gap: 16 * k, line: 26 * k },
    );
  }, [drawn, places, width, current, showLabels, mode, compact]);

  const points = drawn?.points ?? [];
  const behind = Math.max(0, Math.min(done, points.length));
  const lineTo = Math.min(behind, points.length - 1);
  const s = compact ? 0.62 : 1;
  const tag = compact ? { h: 20, font: 12, pad: 7 } : { h: 26, font: 13.5, pad: 10 };

  return (
    <div ref={setBox} className="aerial absolute inset-0" data-terrain={source}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
      >
        <defs>
          <filter
            id={`${id}-land`}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            {/* Softened a hair: the tiles are drawn larger than their own pixels. */}
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.45" result="soft" />
            {/* Sea pixels are a little bluer than red; land never is (as on Home's map). */}
            <feColorMatrix
              in="soft"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -40 0 40 0 -0.5"
              result="seaHard"
            />
            <feGaussianBlur in="seaHard" stdDeviation="0.9" result="sea" />
            <feFlood className="aerial-water-flood" result="water" />
            <feComposite in="water" in2="sea" operator="in" result="wet" />
            {/* Land: the relief's own light, in richer colour and a touch more contrast. */}
            <feColorMatrix in="soft" type="saturate" values="1.55" result="rich" />
            <feComponentTransfer in="rich" result="land">
              <feFuncR type="linear" slope="1.14" intercept="-0.07" />
              <feFuncG type="linear" slope="1.12" intercept="-0.05" />
              <feFuncB type="linear" slope="1.1" intercept="-0.06" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="land" />
              <feMergeNode in="wet" />
            </feMerge>
          </filter>
          <filter id={`${id}-cloud`} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.009 0.016"
              numOctaves="4"
              seed="11"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.2 1.25"
            />
          </filter>
          <radialGradient id={`${id}-vignette`} cx="50%" cy="55%" r="75%">
            <stop offset="0.55" className="aerial-vignette" stopOpacity="0" />
            <stop offset="1" className="aerial-vignette" stopOpacity="1" />
          </radialGradient>
          <linearGradient id={`${id}-cloud-mask-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.85" />
          </linearGradient>
          <mask id={`${id}-cloud-mask`}>
            <rect width={width} height={height} fill={`url(#${id}-cloud-mask-g)`} />
          </mask>
          <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={compact ? 2 : 4} />
          </filter>
          <filter id={`${id}-shadow`} x="-30%" y="-60%" width="160%" height="220%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" className="aerial-tag-shadow" />
          </filter>
        </defs>

        <rect width={width} height={height} className="aerial-sea" />
        {source === "terrain" && terrain ? (
          drawn?.art ? (
            <image
              href={terrainSrc(terrain, theme === "dark")}
              x={drawn.art.dx}
              y={drawn.art.dy}
              width={drawn.art.width}
              height={drawn.art.height}
              preserveAspectRatio="none"
            />
          ) : (
            <image
              href={terrainSrc(terrain, theme === "dark")}
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid slice"
            />
          )
        ) : source === "scene" && scene ? (
          <image href={scene} width={width} height={height} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <g filter={`url(#${id}-land)`}>
            {(drawn?.tiles ?? [])
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
          </g>
        )}
        {/* The mood over the picture: airy for Calm, clear for Colorful, night for Dark. */}
        <rect width={width} height={height} className="aerial-wash" />
        {source === "relief" && !compact ? (
          <rect
            width={width}
            height={height}
            filter={`url(#${id}-cloud)`}
            mask={`url(#${id}-cloud-mask)`}
            className="aerial-cloud"
          />
        ) : null}
        <rect width={width} height={height} fill={`url(#${id}-vignette)`} />

        {mode === "route" && points.length > 1 ? (
          <>
            <path
              d={smoothPath(points)}
              className="aerial-route-glow"
              filter={`url(#${id}-glow)`}
            />
            <path d={smoothPath(points)} className="aerial-route" strokeWidth={3.2 * s} />
            {lineTo > 0 ? (
              <path
                d={smoothPath(points.slice(0, lineTo + 1))}
                className="aerial-route-done"
                strokeWidth={3.2 * s}
              />
            ) : null}
          </>
        ) : null}
        {points.map((d, i) =>
          mode === "route" && i === current ? (
            <g key={i}>
              <circle cx={d.x} cy={d.y} r={22 * s} className="aerial-here-halo" />
              <circle cx={d.x} cy={d.y} r={13 * s} className="aerial-here-ring" />
              <circle cx={d.x} cy={d.y} r={7.5 * s} className="aerial-here" />
            </g>
          ) : (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={(mode === "pins" ? 5.5 : 7) * s}
              className={
                i < behind && mode === "route" ? "aerial-dot aerial-dot-done" : "aerial-dot"
              }
            />
          ),
        )}
        {labels.map((l) => {
          const text = pillLabel(places[l.index]!.city);
          const here = l.index === current;
          const font = here ? tag.font + 1.5 : tag.font;
          const w = text.length * font * 0.58 + tag.pad * 2;
          const x = l.anchor === "start" ? l.x - 4 : l.x - w + 4;
          return (
            <g key={l.index} filter={`url(#${id}-shadow)`}>
              <rect
                x={x}
                y={l.y - tag.h / 2}
                width={w}
                height={tag.h}
                rx={tag.h / 2}
                className={here ? "aerial-tag aerial-tag-here" : "aerial-tag"}
              />
              <text
                x={x + w / 2}
                y={l.y}
                dy="0.35em"
                textAnchor="middle"
                className={here ? "aerial-tag-text aerial-tag-text-here" : "aerial-tag-text"}
                style={{ fontSize: font }}
              >
                {text}
              </text>
            </g>
          );
        })}
      </svg>
      {terrain?.credit && source === "terrain" && !compact ? (
        <span className="aerial-credit absolute left-3 z-[1]" style={{ bottom: footInset }}>
          {terrain.credit}
        </span>
      ) : null}
      {drawn && children ? children(points, width) : null}
    </div>
  );
}
