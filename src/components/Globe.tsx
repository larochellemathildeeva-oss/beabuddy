import { useEffect, useId, useMemo, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldTopo from "world-atlas/countries-110m.json";
import type { Pin } from "@/data/atlas";
import { foldAccents } from "@/lib/fuzzy";

const PIN_FILL: Record<Pin["type"], string> = {
  visited: "var(--visited)",
  nexttime: "var(--nexttime)",
  wishlist: "var(--wishlist)",
  reco: "var(--reco)",
};

type AnyTopology = Parameters<typeof feature>[0];
const topo = worldTopo as unknown as AnyTopology;
const world = feature(topo, topo.objects["countries"]!) as unknown as FeatureCollection<
  Geometry,
  { name?: string }
>;

/** world-atlas short names → names people save on pins. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  "united states of america": ["united states", "usa", "us", "u.s.", "u.s.a."],
  "united kingdom": ["uk", "great britain", "britain", "england"],
  "czech republic": ["czechia"],
  "bosnia and herz.": ["bosnia", "bosnia and herzegovina"],
  "central african rep.": ["central african republic"],
  "dem. rep. congo": ["democratic republic of the congo", "drc", "dr congo"],
  "eq. guinea": ["equatorial guinea"],
  "dominican rep.": ["dominican republic"],
  "solomon is.": ["solomon islands"],
  "s. sudan": ["south sudan"],
  "n. cyprus": ["northern cyprus"],
  "w. sahara": ["western sahara"],
  "cote d'ivoire": ["ivory coast", "côte d'ivoire"],
  swaziland: ["eswatini"],
  macedonia: ["north macedonia"],
  russia: ["russian federation"],
  syria: ["syrian arab republic"],
  iran: ["iran (islamic republic of)"],
  venezuela: ["venezuela (bolivarian republic of)"],
  bolivia: ["bolivia (plurinational state of)"],
  tanzania: ["united republic of tanzania"],
  "south korea": ["korea", "republic of korea"],
  "north korea": ["dem. rep. korea", "dprk"],
};

function norm(name: string) {
  return foldAccents(name).toLowerCase().replace(/\./g, "").trim();
}

function countryKeys(name: string): string[] {
  const n = norm(name);
  const keys = new Set<string>([n]);
  for (const [canonical, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (n === canonical || aliases.some((a) => norm(a) === n)) {
      keys.add(canonical);
      for (const a of aliases) keys.add(norm(a));
    }
  }
  return [...keys];
}

function visitedCountryKeySet(pins: Pin[]): Set<string> {
  const keys = new Set<string>();
  for (const pin of pins) {
    if (pin.type !== "visited" && !pin.visited) continue;
    if (!pin.country?.trim()) continue;
    for (const k of countryKeys(pin.country)) keys.add(k);
  }
  return keys;
}

function featureVisited(name: string | undefined, visited: Set<string>): boolean {
  if (!name) return false;
  return countryKeys(name).some((k) => visited.has(k));
}

const SIZE = 320;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.6;

/** Pointer travel (px) past which a pointerup is a rotate, not a country/pin click. */
const DRAG_SLOP = 6;

type ActivePointer = { x: number; y: number };

function pinchDistance(a: ActivePointer, b: ActivePointer) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function Globe({
  pins,
  selectedId,
  onSelect,
  onCountrySelect,
  className,
}: {
  pins: Pin[];
  selectedId?: string | null | undefined;
  onSelect?: ((pin: Pin) => void) | undefined;
  onCountrySelect?: ((countryName: string) => void) | undefined;
  /** Extra classes on the outer frame — e.g. full-bleed on large screens. */
  className?: string | undefined;
}) {
  const oceanId = `globe-ocean-${useId().replace(/:/g, "")}`;
  const [rotation, setRotation] = useState<[number, number]>([-10, -18]);
  const [zoom, setZoom] = useState(1);
  const pointers = useRef<Map<number, ActivePointer>>(new Map());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const velocity = useRef<[number, number]>([0, 0]);
  const pending = useRef<[number, number] | null>(null);
  /**
   * The rotation the pointer has produced so far. `rotation` state lags by a
   * frame, so reading it as the base during a fast drag drops movement.
   */
  const live = useRef<[number, number]>([-10, -18]);
  /** Live zoom for pinch — state lags a frame the same way rotation does. */
  const liveZoom = useRef(1);
  /** Pointer travel since the gesture began (single-finger only). */
  const moved = useRef(0);
  /**
   * Once a gesture is a drag or pinch, ignore the trailing click.
   * Cleared on the next pointerdown — not on pointerup, because click fires after.
   */
  const gestureConsumed = useRef(false);
  /** True if this gesture used two fingers — no fling after release. */
  const didPinch = useRef(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const rafDrag = useRef<number | null>(null);
  const rafInertia = useRef<number | null>(null);

  const visitedKeys = useMemo(() => visitedCountryKeySet(pins), [pins]);

  // Stable country ids — never Math.random() (that remounts paths every render).
  const countries = useMemo(
    () =>
      world.features.map((f) => ({
        id: String(f.id ?? f.properties?.name ?? "unknown"),
        name: f.properties?.name ?? "",
        feature: f,
      })),
    [],
  );

  const { countryPaths, graticulePath, spherePath, projection } = useMemo(() => {
    const proj = geoOrthographic()
      .scale(150 * zoom)
      .translate([SIZE / 2, SIZE / 2])
      .rotate([rotation[0], rotation[1]]);
    const path = geoPath(proj);
    return {
      projection: proj,
      countryPaths: countries.map((c) => ({
        id: c.id,
        name: c.name,
        d: path(c.feature) ?? "",
        visited: featureVisited(c.name, visitedKeys),
      })),
      graticulePath: path(geoGraticule10()) ?? "",
      spherePath: path({ type: "Sphere" }) ?? "",
    };
  }, [rotation, zoom, countries, visitedKeys]);

  const clipTest = useMemo(() => {
    const c: [number, number] = [-rotation[0], -rotation[1]];
    return (lon: number, lat: number) => {
      const toRad = Math.PI / 180;
      const cosd =
        Math.sin(c[1] * toRad) * Math.sin(lat * toRad) +
        Math.cos(c[1] * toRad) * Math.cos(lat * toRad) * Math.cos((lon - c[0]) * toRad);
      return cosd >= 0;
    };
  }, [rotation]);

  const projected = useMemo(() => {
    return pins
      .map((pin) => {
        const p = projection([pin.lon, pin.lat]);
        if (!p || !clipTest(pin.lon, pin.lat)) return null;
        return { pin, x: p[0], y: p[1] };
      })
      .filter(Boolean) as { pin: Pin; x: number; y: number }[];
  }, [pins, projection, clipTest]);

  const cityLabels = useMemo(
    () =>
      Array.from(
        new Map(projected.map((point) => [point.pin.city.trim().toLowerCase(), point])).values(),
      ).slice(0, zoom > 1.35 ? 20 : 10),
    [projected, zoom],
  );

  const flushRotation = () => {
    rafDrag.current = null;
    if (!pending.current) return;
    const next = pending.current;
    pending.current = null;
    setRotation(next);
  };

  const applyDelta = (dLam: number, dPhi: number) => {
    const [lam, phi] = live.current;
    const next: [number, number] = [lam + dLam, Math.max(-85, Math.min(85, phi + dPhi))];
    live.current = next;
    scheduleRotation(next);
  };

  const scheduleRotation = (next: [number, number]) => {
    pending.current = next;
    if (rafDrag.current == null) {
      rafDrag.current = requestAnimationFrame(flushRotation);
    }
  };

  const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

  const applyZoom = (next: number) => {
    const z = clampZoom(next);
    liveZoom.current = z;
    setZoom(z);
  };

  // React attaches `wheel` as a passive listener at the root, so an onWheel
  // preventDefault() is ignored and the page scrolls as well as the globe.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = clampZoom(liveZoom.current + (e.deltaY > 0 ? -0.12 : 0.12));
      liveZoom.current = next;
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    return () => {
      if (rafDrag.current != null) cancelAnimationFrame(rafDrag.current);
      if (rafInertia.current != null) cancelAnimationFrame(rafInertia.current);
    };
  }, []);

  const stopInertia = () => {
    if (rafInertia.current != null) {
      cancelAnimationFrame(rafInertia.current);
      rafInertia.current = null;
    }
  };

  const startInertia = () => {
    stopInertia();
    const tick = () => {
      const [vx, vy] = velocity.current;
      if (Math.hypot(vx, vy) < 0.08) {
        rafInertia.current = null;
        return;
      }
      applyDelta(vx, vy);
      velocity.current = [vx * 0.92, vy * 0.92];
      rafInertia.current = requestAnimationFrame(tick);
    };
    rafInertia.current = requestAnimationFrame(tick);
  };

  const endPointer = (pointerId: number) => {
    pointers.current.delete(pointerId);
    if (pointers.current.size < 2) {
      pinchStart.current = null;
    }
    if (pointers.current.size === 0) {
      if (didPinch.current) {
        velocity.current = [0, 0];
        stopInertia();
      } else {
        startInertia();
      }
    }
  };

  const trySelectPin = (pin: Pin) => {
    if (gestureConsumed.current || moved.current > DRAG_SLOP) return;
    onSelect?.(pin);
  };

  const trySelectCountry = (name: string) => {
    if (!onCountrySelect || gestureConsumed.current || moved.current > DRAG_SLOP) return;
    onCountrySelect(name);
  };

  return (
    <div className={`select-none ${className ?? ""}`}>
      <div
        ref={frameRef}
        className="relative touch-none overflow-hidden rounded-3xl border border-border bg-elevated"
        onPointerDown={(e) => {
          // Zoom controls are buttons inside the frame — don't steal their gesture.
          if ((e.target as Element | null)?.closest?.("button")) return;

          stopInertia();
          velocity.current = [0, 0];
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

          if (pointers.current.size === 1) {
            moved.current = 0;
            gestureConsumed.current = false;
            didPinch.current = false;
          } else if (pointers.current.size >= 2) {
            gestureConsumed.current = true;
            didPinch.current = true;
            velocity.current = [0, 0];
            const [a, b] = [...pointers.current.values()];
            if (a && b) {
              pinchStart.current = {
                distance: Math.max(1, pinchDistance(a, b)),
                zoom: liveZoom.current,
              };
            }
          }

          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          const prev = pointers.current.get(e.pointerId)!;
          const next = { x: e.clientX, y: e.clientY };
          pointers.current.set(e.pointerId, next);

          if (pointers.current.size >= 2) {
            gestureConsumed.current = true;
            didPinch.current = true;
            velocity.current = [0, 0];
            const pts = [...pointers.current.values()];
            const a = pts[0];
            const b = pts[1];
            if (!a || !b) return;
            const distance = Math.max(1, pinchDistance(a, b));
            if (!pinchStart.current) {
              pinchStart.current = { distance, zoom: liveZoom.current };
              return;
            }
            const ratio = distance / pinchStart.current.distance;
            applyZoom(pinchStart.current.zoom * ratio);
            return;
          }

          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          moved.current += Math.abs(dx) + Math.abs(dy);
          if (moved.current > DRAG_SLOP) gestureConsumed.current = true;
          const dLam = dx * 0.4;
          const dPhi = -dy * 0.3;
          velocity.current = [dLam, dPhi];
          applyDelta(dLam, dPhi);
        }}
        onPointerUp={(e) => endPointer(e.pointerId)}
        onPointerCancel={(e) => endPointer(e.pointerId)}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-[min(52vw,420px)] w-full cursor-grab active:cursor-grabbing md:h-[480px]"
        >
          <defs>
            <radialGradient id={oceanId} cx="35%" cy="30%">
              <stop offset="0%" stopColor="var(--card)" />
              <stop offset="70%" stopColor="var(--muted)" />
              <stop offset="100%" stopColor="var(--secondary)" />
            </radialGradient>
          </defs>
          <path d={spherePath} fill={`url(#${oceanId})`} stroke="var(--border)" />
          <path
            d={graticulePath}
            fill="none"
            stroke="var(--border)"
            strokeWidth={0.4}
            opacity={0.7}
          />
          {countryPaths.map((c) =>
            c.d ? (
              <path
                key={c.id}
                d={c.d}
                fill={c.visited ? "var(--visited)" : "var(--primary)"}
                stroke="var(--card)"
                strokeWidth={0.4}
                opacity={c.visited ? 0.55 : 0.22}
                className={onCountrySelect && c.name ? "cursor-pointer" : undefined}
                onClick={(e) => {
                  if (!c.name) return;
                  // A drag / pinch that ends over a country is not a country tap.
                  if (gestureConsumed.current || moved.current > DRAG_SLOP) return;
                  e.stopPropagation();
                  trySelectCountry(c.name);
                }}
              />
            ) : null,
          )}
          {projected.map(({ pin, x, y }) => (
            <g key={pin.id} transform={`translate(${x} ${y})`}>
              <g
                className="pin-pop cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  trySelectPin(pin);
                }}
              >
                {/* Invisible hit target — fingers rarely land on the 4px dot. */}
                <circle r={16} fill="transparent" />
                <circle
                  r={selectedId === pin.id ? 11 : 8}
                  fill={PIN_FILL[pin.type] ?? "var(--reco)"}
                  opacity={0.28}
                />
                <circle
                  r={4.2}
                  fill={PIN_FILL[pin.type] ?? "var(--reco)"}
                  stroke="var(--card)"
                  strokeWidth={1.2}
                />
              </g>
            </g>
          ))}
          {cityLabels.map(({ pin, x, y }) => (
            <text
              key={`city-${pin.city}-${pin.id}`}
              x={x + 7}
              y={y - 6}
              className="pointer-events-none fill-foreground text-[9px] font-semibold"
              stroke="var(--card)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {pin.city}
            </text>
          ))}
        </svg>

        <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          <button
            type="button"
            aria-label="Zoom in"
            className="px-2.5 py-1.5 text-sm text-foreground"
            onClick={() => applyZoom(liveZoom.current + 0.2)}
          >
            +
          </button>
          <span className="h-px bg-border" />
          <button
            type="button"
            aria-label="Zoom out"
            className="px-2.5 py-1.5 text-sm text-foreground"
            onClick={() => applyZoom(liveZoom.current - 0.2)}
          >
            −
          </button>
        </div>

        <p className="absolute bottom-3 left-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Drag to rotate · pinch or scroll to zoom
        </p>
      </div>
    </div>
  );
}
