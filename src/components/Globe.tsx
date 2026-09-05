import { useMemo, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoCircle } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldTopo from "world-atlas/countries-110m.json";
import type { Pin } from "@/data/atlas";

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

const SIZE = 320;

export function Globe({
  pins,
  selectedId,
  onSelect,
}: {
  pins: Pin[];
  selectedId?: string | null | undefined;
  onSelect?: ((pin: Pin) => void) | undefined;
}) {
  const [rotation, setRotation] = useState<[number, number]>([-10, -18]);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const { countryPaths, graticulePath, spherePath, projection } = useMemo(() => {
    const proj = geoOrthographic()
      .scale(150 * zoom)
      .translate([SIZE / 2, SIZE / 2])
      .rotate([rotation[0], rotation[1]]);
    const path = geoPath(proj);
    return {
      projection: proj,
      countryPaths: world.features.map((f) => ({
        id: String(f.id ?? f.properties?.name ?? Math.random()),
        d: path(f) ?? "",
      })),
      graticulePath: path(geoGraticule10()) ?? "",
      spherePath: path({ type: "Sphere" }) ?? "",
    };
  }, [rotation, zoom]);

  const visible = geoCircle().radius(90).center([-rotation[0], -rotation[1]]);
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
  void visible;

  const projected = pins
    .map((pin) => {
      const p = projection([pin.lon, pin.lat]);
      if (!p || !clipTest(pin.lon, pin.lat)) return null;
      return { pin, x: p[0], y: p[1] };
    })
    .filter(Boolean) as { pin: Pin; x: number; y: number }[];

  const cityLabels = Array.from(
    new Map(projected.map((point) => [point.pin.city.trim().toLowerCase(), point])).values(),
  ).slice(0, zoom > 1.35 ? 20 : 10);

  return (
    <div className="select-none">
      <div
        className="relative touch-none overflow-hidden rounded-3xl border border-border bg-elevated"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY };
          setRotation(([lam, phi]) => [
            lam + dx * 0.4,
            Math.max(-85, Math.min(85, phi - dy * 0.3)),
          ]);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-[320px] w-full cursor-grab active:cursor-grabbing"
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
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={0.4}
                opacity={0.28}
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
            aria-label="Zoom in"
            className="px-2.5 py-1.5 text-sm text-foreground"
            onClick={() => setZoom((z) => Math.min(2.6, z + 0.2))}
          >
            +
          </button>
          <span className="h-px bg-border" />
          <button
            aria-label="Zoom out"
            className="px-2.5 py-1.5 text-sm text-foreground"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
          >
            −
          </button>
        </div>

        <p className="absolute bottom-3 left-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Drag to rotate
        </p>
      </div>
    </div>
  );
}
