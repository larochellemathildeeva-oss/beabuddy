import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Globe } from "@/components/Globe";
import { ComparePins } from "@/components/ComparePins";
import { AddVisitedCity } from "@/components/AddVisitedCity";

import { supabase } from "@/integrations/supabase/client";

import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useTrips } from "@/hooks/useTrips";
import { pinColorClass, pinLabel, type Pin, type PinType } from "@/data/atlas";
import { deriveTravelStats } from "@/lib/travel-stats";

type ItineraryCounts = { flights: number; hotels: number; restaurants: number };

export const Route = createFileRoute("/world")({
  head: () => ({
    meta: [
      { title: "World — Béa" },
      {
        name: "description",
        content:
          "Spin the globe to see every city you've visited, every place on your wishlist and every recommendation waiting for you.",
      },
      { property: "og:title", content: "World — Béa" },
      {
        property: "og:description",
        content: "An interactive globe of your visited, wishlist, next-time and recommendation pins.",
      },
    ],
  }),
  component: WorldPage,
});

const filters: { type: PinType; label: string }[] = [
  { type: "visited", label: "Visited" },
  { type: "nexttime", label: "Next time" },
  { type: "wishlist", label: "Wishlist" },
  { type: "reco", label: "Recs" },
];

function WorldPage() {
  const [active, setActive] = useState<PinType[]>(["visited", "nexttime", "wishlist", "reco"]);
  const [selected, setSelected] = useState<Pin | null>(null);
  const [heatmap, setHeatmap] = useState(false);
  const [heatOpen, setHeatOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");

  const photo = usePhotoMemories();
  const vault = useRecommendations();
  const t = useTrips();
  const allPins = [...photo.pins, ...vault.pins];

  // Photo rows plus vault pins, so a city added by hand on this map counts too.
  // photo.pins are omitted on purpose — they are derived from photo.rows and
  // would be the same places twice.
  const travelStats = useMemo(
    () => deriveTravelStats(photo.rows, vault.pins),
    [photo.rows, vault.pins],
  );

  const [counts, setCounts] = useState<ItineraryCounts>({ flights: 0, hotels: 0, restaurants: 0 });

  const today = new Date().toISOString().slice(0, 10);
  const tripsCompleted = useMemo(
    () => t.trips.filter((tr) => tr.status === "past" || (tr.end_date && tr.end_date < today)).length,
    [t.trips, today],
  );
  const travelDays = useMemo(
    () =>
      t.trips.reduce((sum, tr) => {
        if (!tr.start_date || !tr.end_date) return sum;
        const ms = Date.parse(tr.end_date) - Date.parse(tr.start_date);
        return Number.isFinite(ms) && ms >= 0 ? sum + Math.round(ms / 86400000) + 1 : sum;
      }, 0),
    [t.trips],
  );

  useEffect(() => {
    if (!statsOpen || !t.trips.length) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("itinerary_items")
        .select("kind")
        .in("trip_id", t.trips.map((tr) => tr.id));
      if (cancelled || !data) return;
      const next: ItineraryCounts = { flights: 0, hotels: 0, restaurants: 0 };
      for (const row of data) {
        const k = (row.kind ?? "").toLowerCase();
        if (k.includes("flight")) next.flights += 1;
        else if (k === "hotel" || k === "lodging") next.hotels += 1;
        else if (k === "reservation" || k === "meal" || k.includes("restaurant")) next.restaurants += 1;
      }
      setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [statsOpen, t.trips]);

  const countries = useMemo(
    () => Array.from(new Set(allPins.map((p) => p.country).filter(Boolean))).sort(),
    [allPins.length],
  );

  const q = query.trim().toLowerCase();
  const visible = allPins.filter(
    (p) =>
      active.includes(p.type) &&
      (country === "all" || p.country === country) &&
      (!q ||
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)),
  );


  const cityRows = useMemo(() => {
    const map = new Map<string, { city: string; photos: number; days: Set<string> }>();
    for (const r of photo.rows) {
      if (!r.city) continue;
      const key = r.city.toLowerCase();
      const g = map.get(key) ?? { city: r.city, photos: 0, days: new Set<string>() };
      g.photos += 1;
      if (r.taken_at) g.days.add(r.taken_at.slice(0, 10));
      map.set(key, g);
    }
    return Array.from(map.values())
      .map((g) => ({ city: g.city, photos: g.photos, days: g.days.size }))
      .sort((a, b) => b.photos - a.photos);
  }, [photo.rows]);

  const toggle = (t: PinType) =>
    setActive((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <AppShell
      eyebrow="Your world"
      title={
        photo.stats.cities
          ? `${travelStats.cities} cities, ${travelStats.countries} countries.`
          : "Your map starts here."
      }
    >
      <div className="space-y-5">
        <div data-guide="pin-filters" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.type}
              onClick={() => toggle(f.type)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                active.includes(f.type)
                  ? "border-border bg-card"
                  : "border-border/60 bg-transparent text-muted-foreground"
              }`}
            >
              <span className={`size-2 rounded-full ${pinColorClass[f.type]}`} />
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place, city or country"
            aria-label="Search your pins"
            className="min-w-[180px] flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[13px]"
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Filter by country"
            className="rounded-xl border border-border bg-card px-3 py-2 text-[13px]"
          >
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(query || country !== "all" || active.length < 4) && (
            <button
              onClick={() => {
                setQuery("");
                setCountry("all");
                setActive(["visited", "nexttime", "wishlist", "reco"]);
              }}
              className="rounded-xl border border-border px-3 py-2 text-[12px] text-muted-foreground"
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Showing {visible.length} of {allPins.length} pins.
        </p>

        <div data-guide="globe">
          <Globe pins={visible} selectedId={selected?.id} onSelect={setSelected} />
        </div>

        <AddVisitedCity onSaved={() => void vault.reload()} />

        <ComparePins pins={[...photo.pins, ...vault.comparePins]} />


        {selected ? (
          <section className="rise card-soft p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${pinColorClass[selected.type]}`} />
                  <span className="label-caps">{pinLabel[selected.type]}</span>
                </div>
                <h2 className="mt-1 text-[24px] leading-tight">{selected.name}</h2>
                <p className="text-[12px] text-muted-foreground">
                  {selected.city}, {selected.country}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                Close
              </button>
            </div>

            {selected.notes && (
              <p className="mt-3 font-display text-[16px] leading-snug">“{selected.notes}”</p>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              {["Photos", "Hotels", "Restaurants", "Attractions", "Notes", "Budget"].map((t) => (
                <span
                  key={t}
                  className="rounded-xl border border-border bg-elevated px-2 py-2 text-center text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>

          </section>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Tap any pin on the globe to open that place — photos, notes, budget and Future Me notes.
          </p>
        )}

        <section data-guide="travel-stats">
          <div className="mb-3 flex items-baseline justify-between">
            <button
              onClick={() => setStatsOpen((v) => !v)}
              className="label-caps flex items-center gap-1.5 text-foreground"
              aria-expanded={statsOpen}
              aria-controls="travel-stats-body"
            >
              <span className={`transition-transform duration-200 ${statsOpen ? "rotate-90" : ""}`}>
                ▸
              </span>
              Travel statistics
            </button>
          </div>
          {statsOpen && (
            <div id="travel-stats-body" className="card-soft space-y-3 px-4 py-3">
              <div className="grid grid-cols-4 gap-2">
                <Stat value={travelStats.countries} label="Countries" />
                <Stat value={travelStats.cities} label="Cities" />
                <Stat value={tripsCompleted} label="Trips completed" />
                <Stat value={counts.flights} label="Flights" />
                <Stat value={counts.hotels} label="Hotels" />
                <Stat value={counts.restaurants} label="Restaurants" />
                <Stat value={travelDays} label="Travel days" />
                <Stat value={allPins.length} label="Pins" accent />
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                These stats only include data Béa has access to — the trips, timeline entries,
                photos and pins saved in this app.
              </p>
            </div>
          )}
        </section>

        <section data-guide="heatmap">
          <div className="mb-3 flex items-baseline justify-between">
            <button
              onClick={() => setHeatOpen((v) => !v)}
              className="flex items-center gap-1.5 label-caps text-foreground"
              aria-expanded={heatOpen}
              aria-controls="heatmap-body"
            >
              <span className={`transition-transform duration-200 ${heatOpen ? "rotate-90" : ""}`}>
                ▸
              </span>
              Heatmap
            </button>
            {heatOpen && (
              <button onClick={() => setHeatmap((v) => !v)} className="text-[11px] text-primary">
                {heatmap ? "By photos" : "By days"}
              </button>
            )}
          </div>
          {heatOpen && (
            cityRows.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                Import photos and each city you've been will appear here.
              </p>
            ) : (
              <div id="heatmap-body" className="card-soft divide-y divide-border">
                {cityRows.map((c) => {
                  const value = heatmap ? c.days : c.photos;
                  const max = Math.max(...cityRows.map((x) => (heatmap ? x.days : x.photos)), 1);
                  return (
                    <div key={c.city} className="flex items-center gap-3 p-3">
                      <span className="w-24 shrink-0 font-display text-[16px]">{c.city}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.max(8, (value / max) * 100)}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-[11px] text-muted-foreground">
                        {heatmap ? `${c.days} days` : `${c.photos} photos`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={`font-display text-[22px] leading-none ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </div>
  );
}
