import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Globe } from "@/components/Globe";
import { ComparePins } from "@/components/ComparePins";
import { AddVisitedCity } from "@/components/AddVisitedCity";
import { Switch } from "@/components/ui/switch";

import { supabase } from "@/integrations/supabase/client";

import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useTrips } from "@/hooks/useTrips";
import { STAT_OPTIONS, useStatsLayout } from "@/hooks/useStatsLayout";
import { pinColorClass, pinLabel, type Pin, type PinType } from "@/data/atlas";
import { countryWorldShare, deriveTravelStats } from "@/lib/travel-stats";
import { isCityLevelPlace } from "@/lib/reco-place";
import { BEA_SIGNATURE, beaLine } from "@/lib/bea-voice";

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
  const [statsOpen, setStatsOpen] = useState(true);
  const [statsEdit, setStatsEdit] = useState(false);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const statsLayout = useStatsLayout();

  const photo = usePhotoMemories();
  const vault = useRecommendations();
  const t = useTrips();
  const allPins = [...photo.pins, ...vault.pins].filter(
    (p) => p.type !== "reco" || !isCityLevelPlace(p),
  );

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
  const worldShare = useMemo(
    () => countryWorldShare(travelStats.countries),
    [travelStats.countries],
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
        allPins.length === 0
          ? BEA_SIGNATURE.world
          : photo.stats.cities
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

        {allPins.length === 0 && (
          <div className="card-soft p-4">
            <p className="font-display text-[18px] leading-snug">{beaLine("empty.globe").title}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{beaLine("empty.globe").body}</p>
          </div>
        )}

        <div data-guide="globe">
          <Globe
            pins={visible}
            selectedId={selected?.id}
            onSelect={setSelected}
            onCountrySelect={(name) => {
              const lower = name.toLowerCase();
              const match =
                allPins.find((p) => p.country.toLowerCase() === lower) ??
                allPins.find((p) => {
                  if (lower.includes("united states") || lower === "usa") {
                    return /united states|usa/i.test(p.country);
                  }
                  if (lower.includes("united kingdom") || lower === "uk") {
                    return /united kingdom|uk|britain/i.test(p.country);
                  }
                  return p.country.toLowerCase().includes(lower) || lower.includes(p.country.toLowerCase());
                });
              if (match) {
                setCountry(match.country);
                setSelected(match);
              }
            }}
          />
        </div>

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
            {statsOpen && (
              <button
                type="button"
                onClick={() => setStatsEdit((v) => !v)}
                className="text-[11px] text-primary"
              >
                {statsEdit ? "Done" : "Choose stats"}
              </button>
            )}
          </div>
          {statsOpen && (
            <div id="travel-stats-body" className="card-soft space-y-3 px-4 py-3">
              <div className="grid grid-cols-4 gap-2">
                {statsLayout.layout.countries &&
                  (statsLayout.layout.countryShare ? (
                    <Stat
                      value={`${worldShare.percent}%`}
                      label="of the world"
                      hint={`${worldShare.visited} of ${worldShare.world} countries`}
                    />
                  ) : (
                    <Stat value={travelStats.countries} label="Countries" />
                  ))}
                {statsLayout.layout.cities && <Stat value={travelStats.cities} label="Cities" />}
                {statsLayout.layout.trips && <Stat value={tripsCompleted} label="Trips completed" />}
                {statsLayout.layout.flights && <Stat value={counts.flights} label="Flights" />}
                {statsLayout.layout.hotels && <Stat value={counts.hotels} label="Hotels" />}
                {statsLayout.layout.restaurants && (
                  <Stat value={counts.restaurants} label="Restaurants" />
                )}
                {statsLayout.layout.travelDays && <Stat value={travelDays} label="Travel days" />}
                {statsLayout.layout.pins && <Stat value={allPins.length} label="Pins" accent />}
              </div>
              {!STAT_OPTIONS.some((option) => statsLayout.layout[option.key]) && (
                <p className="text-[12px] text-muted-foreground">
                  Nothing selected — tap Choose stats and turn a few back on.
                </p>
              )}
              {statsLayout.layout.countries && statsLayout.layout.countryShare && (
                <p className="text-[12px] text-muted-foreground">
                  You have visited {worldShare.percent}% of the world — {worldShare.visited} of{" "}
                  {worldShare.world} widely recognised countries.
                </p>
              )}
              {statsEdit && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-[12px] text-muted-foreground">
                    Pick what Béa counts. Saved on this phone.
                  </p>
                  {STAT_OPTIONS.map((option) => (
                    <div key={option.key} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-medium">{option.label}</p>
                        <p className="text-[11px] text-muted-foreground">{option.hint}</p>
                      </div>
                      <Switch
                        checked={statsLayout.layout[option.key]}
                        onCheckedChange={() => statsLayout.toggle(option.key)}
                        aria-label={`Show ${option.label}`}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                    <div>
                      <p className="text-[13px] font-medium">Countries as a world share</p>
                      <p className="text-[11px] text-muted-foreground">
                        Show 1 of 195 countries as a percentage.
                      </p>
                    </div>
                    <Switch
                      checked={statsLayout.layout.countryShare}
                      onCheckedChange={(on) => statsLayout.setCountryShare(on)}
                      aria-label="Show countries as a percentage of the world"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={statsLayout.reset}
                    className="w-full rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
                  >
                    Reset to default
                  </button>
                  <p className="rounded-xl border border-dashed border-primary/40 bg-card px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
                    Dreaming of a number that isn't here — croissants eaten, continents stamped,
                    nights under canvas? Béa's whole job is to make you happy, and she is nosy in
                    the useful way.{" "}
                    <Link to="/profile" className="font-medium text-primary underline underline-offset-2">
                      Tell her on You → Feedback
                    </Link>
                    .
                  </p>
                </div>
              )}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                These stats only include data Béa has access to — the trips, timeline entries,
                photos and pins saved in this app.
              </p>
              {!statsEdit && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Missing a number that would make you grin?{" "}
                  <Link to="/profile" className="text-primary underline underline-offset-2">
                    You → Feedback
                  </Link>{" "}
                  is where Béa keeps her ears open.
                </p>
              )}
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

        <AddVisitedCity onSaved={() => void vault.reload()} />

        <ComparePins
          pins={[
            ...photo.pins,
            ...vault.comparePins.filter((p) => p.type !== "reco" || !isCityLevelPlace(p)),
          ]}
        />


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
      </div>
    </AppShell>
  );
}

function Stat({
  value,
  label,
  hint,
  accent,
}: {
  value: number | string;
  label: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`font-display text-[22px] leading-none ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}
