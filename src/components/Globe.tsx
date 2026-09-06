import { useEffect, useMemo, useRef, useState } from "react";
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
const world = feature(
  topo,
  topo.objects["countries"]!,
) as unknown as FeatureCollection<Geometry, { name?: string }>;

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
  const [rotation, setRotation] = useState<[number, number]>([-10, -18]);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const velocity = useRef<[number, number]>([0, 0]);
  const pending = useRef<[number, number] | null>(null);
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

  const scheduleRotation = (next: [number, number]) => {
    pending.current = next;
    if (rafDrag.current == null) {
      rafDrag.current = requestAnimationFrame(flushRotation);
    }
  };

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
      setRotation(([lam, phi]) => [
        lam + vx,
        Math.max(-85, Math.min(85, phi + vy)),
      ]);
      velocity.current = [vx * 0.92, vy * 0.92];
      rafInertia.current = requestAnimationFrame(tick);
    };
    rafInertia.current = requestAnimationFrame(tick);
  };

  return (
    <div className={`select-none ${className ?? ""}`}>
      <div
        className="relative overflow-hidden rounded-3xl border border-border bg-elevated touch-pan-y"
        onPointerDown={(e) => {
          stopInertia();
          velocity.current = [0, 0];
          drag.current = { x: e.clientX, y: e.clientY };
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY };
          const dLam = dx * 0.4;
          const dPhi = -dy * 0.3;
          velocity.current = [dLam, dPhi];
          const [lam, phi] = pending.current ?? rotation;
          scheduleRotation([
            lam + dLam,
            Math.max(-85, Math.min(85, phi + dPhi)),
          ]);
        }}
        onPointerUp={() => {
          drag.current = null;
          startInertia();
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.12 : 0.12;
          setZoom((z) => Math.max(0.7, Math.min(2.6, z + delta)));
        }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-[min(52vw,420px)] w-full cursor-grab active:cursor-grabbing md:h-[480px]"
        >
          <defs>
            <radialGradient id="ocean" cx="35%" cy="30%">
              <stop offset="0%" stopColor="var(--card)" />
              <stop offset="70%" stopColor="var(--muted)" />
              <stop offset="100%" stopColor="var(--secondary)" />
            </radialGradient>
          </defs>
          <path d={spherePath} fill="url(#ocean)" stroke="var(--border)" />
          <path d={graticulePath} fill="none" stroke="var(--border)" strokeWidth={0.4} opacity={0.7} />
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
                  if (!c.name || !onCountrySelect) return;
                  e.stopPropagation();
                  onCountrySelect(c.name);
                }}
              />
            ) : null,
          )}
          {projected.map(({ pin, x, y }) => (
            <g key={pin.id} transform={`translate(${x} ${y})`}>
              <g className="pin-pop cursor-pointer" onClick={() => onSelect?.(pin)}>
                <circle
                  r={selectedId === pin.id ? 11 : 8}
                  fill={PIN_FILL[pin.type]}
                  opacity={0.28}
                />
                <circle r={4.2} fill={PIN_FILL[pin.type]} stroke="var(--card)" strokeWidth={1.2} />
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
            onClick={() => setZoom((z) => Math.min(2.6, z + 0.2))}
          >
            +
          </button>
          <span className="h-px bg-border" />
          <button
            type="button"
            aria-label="Zoom out"
            className="px-2.5 py-1.5 text-sm text-foreground"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
          >
            −
          </button>
        </div>

        <p className="absolute bottom-3 left-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Drag to rotate · scroll to zoom
        </p>
      </div>
    </div>
  );
}
