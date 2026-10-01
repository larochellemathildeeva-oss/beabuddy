import { useMemo } from "react";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldTopo from "world-atlas/countries-110m.json";
import { Bed, Landmark, MapPin, Utensils } from "@/components/icons";
import type { SceneFigure } from "@/lib/how-it-works";

/**
 * Small drawings for the story page.
 *
 * Deliberately abstractions of Béa's own interface rather than screenshots: a
 * screenshot goes stale the week the UI changes, and cropped app chrome at this
 * size reads as clutter. Each figure shows the shape of the idea — scattered,
 * captured, sorted, assembled — using the same cards, chips and glyphs the real
 * screens use.
 */

const Card = ({
  children,
  className = "",
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`rounded-xl border border-border/70 bg-card px-2.5 py-1.5 text-[11.5px] shadow-sm ${className}`}
    style={style}
  >
    {children}
  </div>
);

function Scatter() {
  const bits = [
    { label: "voice note", x: "4%", y: "6%", rot: -7 },
    { label: "screenshot", x: "52%", y: "0%", rot: 5 },
    { label: "a link", x: "18%", y: "38%", rot: 3 },
    { label: "group chat", x: "58%", y: "44%", rot: -4 },
    { label: "a note at midnight", x: "8%", y: "72%", rot: 6 },
  ];
  return (
    <div className="relative h-[168px] w-full">
      {bits.map((bit) => (
        <Card
          key={bit.label}
          className="absolute opacity-70"
          style={{ left: bit.x, top: bit.y, transform: `rotate(${bit.rot}deg)` }}
        >
          {bit.label}
        </Card>
      ))}
    </div>
  );
}

function Capture() {
  return (
    <div className="flex h-[168px] w-full flex-col justify-center gap-2">
      <div className="truncate rounded-xl border border-border bg-elevated px-3 py-2 text-[11.5px] text-muted-foreground">
        example.com/10-hidden-gems-lisbon
      </div>
      {[
        { name: "A Cevicheria", where: "Príncipe Real" },
        { name: "Miradouro da Senhora do Monte", where: "Graça" },
        { name: "Cortiço & Netos", where: "Intendente" },
      ].map((place, i) => (
        <Card key={place.name} className="flex items-center gap-2">
          <MapPin className="size-3 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{place.name}</span>
          <span className="shrink-0 text-[10.5px] text-muted-foreground">{place.where}</span>
          <span
            aria-hidden
            className={`size-3 shrink-0 rounded-[4px] border ${
              i < 2 ? "border-primary bg-primary" : "border-border"
            }`}
          />
        </Card>
      ))}
    </div>
  );
}

function Vault() {
  const kinds = [
    { label: "Visited", tone: "bg-visited" },
    { label: "Next time", tone: "bg-nexttime" },
    { label: "Wishlist", tone: "bg-wishlist" },
    { label: "Recommendation", tone: "bg-reco" },
  ];
  return (
    <div className="flex h-[168px] w-full flex-col justify-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {kinds.map((kind) => (
          <span
            key={kind.label}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px]"
          >
            <span className={`size-1.5 rounded-full ${kind.tone}`} aria-hidden />
            {kind.label}
          </span>
        ))}
      </div>
      <div className="mt-1 space-y-1.5">
        {[
          { name: "Bar Raval", by: "by Sarah" },
          { name: "Sotto Sotto", by: "by Marie" },
        ].map((row) => (
          <Card key={row.name} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
            <span className="shrink-0 text-[10.5px] text-muted-foreground">{row.by}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Assemble() {
  const rows = [
    { time: "08:30", name: "Inoda Coffee", Icon: Utensils },
    { time: "10:00", name: "Fushimi Inari", Icon: Landmark },
    { time: "21:00", name: "Hotel Kanra", Icon: Bed },
  ];
  return (
    <div className="flex h-[168px] w-full flex-col justify-center gap-2">
      <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Thu · Sep 17</p>
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-2.5">
          <span className="w-[38px] shrink-0 text-[11.5px] font-semibold tabular-nums">
            {row.time}
          </span>
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary/85">
            <row.Icon className="size-3" aria-hidden />
          </span>
          <Card className="min-w-0 flex-1 truncate">{row.name}</Card>
        </div>
      ))}
    </div>
  );
}

function Nearby() {
  return (
    <div className="flex h-[168px] w-full items-center">
      <Card className="w-full p-0">
        <div className="flex items-start gap-2.5 px-3 py-3">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <MapPin className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold">You saved a place two streets away</p>
            <p className="text-[11.5px] text-muted-foreground">
              Bar Raval · saved 11 months ago · by Sarah
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Compare() {
  return (
    <div className="flex h-[168px] w-full flex-col justify-center gap-2">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Plan A", note: "Stays central" },
          { label: "Plan B", note: "90 min on the bridge" },
        ].map((plan, i) => (
          <Card key={plan.label} className={i === 0 ? "border-primary/50" : ""}>
            <p className="text-[11.5px] font-semibold">{plan.label}</p>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">{plan.note}</p>
          </Card>
        ))}
      </div>
      <div className="rounded-xl bg-primary-soft px-3 py-2">
        <p className="text-[11.5px] font-semibold text-primary">Béa would take A.</p>
        <p className="text-[10.5px] text-muted-foreground">
          Slower mornings, and the food you said you wanted.
        </p>
      </div>
    </div>
  );
}

/** Where the drawing's travels went: lon, lat. Also the countries it shades. */
const MAP_TRIPS: { lon: number; lat: number; country: string }[] = [
  { lon: -9.14, lat: 38.72, country: "Portugal" },
  { lon: 2.35, lat: 48.86, country: "France" },
  { lon: 12.5, lat: 41.9, country: "Italy" },
  { lon: -3.7, lat: 40.42, country: "Spain" },
  { lon: 13.4, lat: 52.52, country: "Germany" },
  { lon: -0.13, lat: 51.51, country: "United Kingdom" },
  { lon: -6.84, lat: 34.02, country: "Morocco" },
];

const mapWorld = (() => {
  const topo = worldTopo as unknown as Parameters<typeof feature>[0];
  return feature(topo, topo.objects["countries"]!) as unknown as FeatureCollection<
    Geometry,
    { name?: string }
  >;
})();

/** A still globe in the app's own palette, filled in by six years of trips. */
function MapFills() {
  const drawn = useMemo(() => {
    const projection = geoOrthographic().scale(62).translate([100, 70]).rotate([-4, -38]);
    const path = geoPath(projection);
    const been = new Set(MAP_TRIPS.map((t) => t.country));
    return {
      sphere: path({ type: "Sphere" }) ?? "",
      grid: path(geoGraticule10()) ?? "",
      land: mapWorld.features.map((f, i) => ({
        key: String(f.id ?? i),
        d: path(f) ?? "",
        been: been.has(f.properties?.name ?? ""),
      })),
      dots: MAP_TRIPS.map((t) => projection([t.lon, t.lat])).filter((p): p is [number, number] =>
        Boolean(p),
      ),
    };
  }, []);

  return (
    <div className="relative h-[168px] w-full overflow-hidden rounded-2xl bg-elevated">
      <svg viewBox="0 0 200 160" className="size-full" aria-hidden>
        <defs>
          <radialGradient id="how-map-sea" cx="38%" cy="32%" r="75%">
            <stop
              offset="0%"
              style={{ stopColor: "color-mix(in oklab, var(--visited) 8%, var(--card))" }}
            />
            <stop
              offset="100%"
              style={{ stopColor: "color-mix(in oklab, var(--visited) 30%, var(--card))" }}
            />
          </radialGradient>
          <radialGradient id="how-map-shade" cx="40%" cy="35%" r="68%">
            <stop offset="60%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.16} />
          </radialGradient>
        </defs>
        <path d={drawn.sphere} fill="url(#how-map-sea)" />
        <path d={drawn.grid} fill="none" stroke="var(--visited)" strokeWidth={0.3} opacity={0.14} />
        {drawn.land.map((c) =>
          c.d ? (
            <path
              key={c.key}
              d={c.d}
              style={{
                fill: c.been
                  ? "color-mix(in oklab, var(--visited) 72%, var(--card))"
                  : "color-mix(in oklab, var(--foreground) 16%, var(--card))",
              }}
              stroke="var(--card)"
              strokeWidth={0.35}
            />
          ) : null,
        )}
        <path d={drawn.sphere} fill="url(#how-map-shade)" />
        {drawn.dots.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2.1}
            fill="var(--visited)"
            stroke="var(--card)"
            strokeWidth={0.8}
          />
        ))}
      </svg>
      <p className="absolute inset-x-0 bottom-2 text-center text-[10.5px] text-muted-foreground">
        Six years, one map
      </p>
    </div>
  );
}

const FIGURES: Record<SceneFigure, () => React.JSX.Element> = {
  scatter: Scatter,
  capture: Capture,
  vault: Vault,
  assemble: Assemble,
  nearby: Nearby,
  compare: Compare,
  map: MapFills,
};

export function SceneFigureView({ figure }: { figure: SceneFigure }) {
  const Figure = FIGURES[figure];
  return <Figure />;
}
