import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Globe } from "@/components/Globe";
import { Section } from "@/components/Section";
import { ComparePins } from "@/components/ComparePins";
import { AddVisitedCity } from "@/components/AddVisitedCity";
import { Switch } from "@/components/ui/switch";

import { supabase } from "@/integrations/supabase/client";

import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useTrips } from "@/hooks/useTrips";
import { STAT_OPTIONS, useStatsLayout } from "@/hooks/useStatsLayout";
import type { Pin } from "@/data/atlas";
import { useVisitedProvinces } from "@/hooks/useVisitedProvinces";
import { countryKey } from "@/lib/country-names";
import {
  cityPins,
  isVisitedPin,
  visitedCities,
  visitedCountryKeys,
  visitsByCountry,
} from "@/lib/world-visits";
import { countryWorldShare, deriveTravelStats } from "@/lib/travel-stats";
import { isCityLevelPlace } from "@/lib/reco-place";
import { BEA_SIGNATURE, beaLine } from "@/lib/bea-voice";

type ItineraryCounts = { flights: number; hotels: number; restaurants: number };

export const Route = createFileRoute("/world")({
  staticData: { plane: "tab" },
  head: () => ({
    meta: [
      { title: "World — Béa" },
      {
        name: "description",
        content:
          "Spin the globe to see everywhere you've been: the countries, the provinces and states, and the cities.",
      },
      { property: "og:title", content: "World — Béa" },
      {
        property: "og:description",
        content: "An interactive globe of the countries, provinces and cities you've visited.",
      },
    ],
  }),
  component: WorldPage,
});

function WorldPage() {
  const [selected, setSelected] = useState<Pin | null>(null);
  const [statsOpen, setStatsOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [statsEdit, setStatsEdit] = useState(false);
  /** The caveat about what the numbers count — asked for, not always on. */
  const [statsNote, setStatsNote] = useState(false);
  const statsLayout = useStatsLayout();

  const photo = usePhotoMemories();
  const vault = useRecommendations();
  const t = useTrips();
  // Only where you have been. Wishlist, next time and recommendations live on
  // Recs; a globe of everything was a second, busier copy of that tab.
  const places = useMemo(
    () => [...photo.pins, ...vault.pins].filter(isVisitedPin),
    [photo.pins, vault.pins],
  );
  // The "Pins" statistic still counts everything saved, as it always has.
  const savedPinCount = [...photo.pins, ...vault.pins].filter(
    (p) => p.type !== "reco" || !isCityLevelPlace(p),
  ).length;
  const cities = useMemo(() => visitedCities(places), [places]);
  const provinces = useVisitedProvinces(cities);
  const byCountry = useMemo(
    () => visitsByCountry(places, cities, provinces),
    [places, cities, provinces],
  );
  const globeCities = useMemo(() => cityPins(cities), [cities]);
  const shadedCountries = useMemo(() => visitedCountryKeys(places, provinces), [places, provinces]);
  const provinceOf = useMemo(() => {
    const map = new Map<string, (typeof provinces)[number]>();
    for (const p of provinces) for (const key of p.cityKeys) map.set(key, p);
    return map;
  }, [provinces]);
  const cityOf = (pin: Pin) => cities.find((c) => `city:${c.key}` === pin.id);

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
    () =>
      t.trips.filter((tr) => tr.status === "past" || (tr.end_date && tr.end_date < today)).length,
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
        .in(
          "trip_id",
          t.trips.map((tr) => tr.id),
        );
      if (cancelled || !data) return;
      const next: ItineraryCounts = { flights: 0, hotels: 0, restaurants: 0 };
      for (const row of data) {
        const k = (row.kind ?? "").toLowerCase();
        if (k.includes("flight")) next.flights += 1;
        else if (k === "hotel" || k === "lodging") next.hotels += 1;
        else if (k === "reservation" || k === "meal" || k.includes("restaurant"))
          next.restaurants += 1;
      }
      setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [statsOpen, t.trips]);

  return (
    <AppShell
      eyebrow="Your world"
      title={
        places.length === 0
          ? BEA_SIGNATURE.world
          : photo.stats.cities
            ? `${travelStats.cities} cities, ${travelStats.countries} countries.`
            : "Your map starts here."
      }
    >
      <div className="space-y-5">
        {places.length === 0 ? (
          <div className="card-soft p-4">
            <p className="font-display text-[18px] leading-snug">{beaLine("empty.globe").title}</p>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              {beaLine("empty.globe").body}
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            {[
              plural(cities.length, "city", "cities"),
              provinces.length > 0
                ? plural(provinces.length, "province or state", "provinces and states")
                : "",
              plural(byCountry.length, "country", "countries"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <div data-guide="globe" className="relative">
          {/* The only way to add a place on this tab. It sits on the globe
              because that is what you are adding to, and because a full-width
              panel at the foot of the page was a section nobody scrolled to. */}
          <button
            type="button"
            data-guide="add-city"
            onClick={() => setAddOpen(true)}
            aria-label="Add a city or country to your globe"
            title="Add a city or country"
            className="absolute right-2 top-2 z-10 grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-md"
          >
            <Plus className="size-5" aria-hidden />
          </button>
          <Globe
            pins={globeCities}
            regions={provinces}
            visitedCountries={shadedCountries}
            selectedId={selected?.id}
            onSelect={setSelected}
            onCountrySelect={(name) => {
              // A tap on a country opens one of your cities there, in any
              // language the country was saved in.
              const key = countryKey(name);
              const match = globeCities.find((pin) => countryKey(pin.country) === key);
              if (match) setSelected(match);
            }}
          />
        </div>

        {selected && cityOf(selected) && (
          <section className="rise card-soft p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="label-caps">You've been here</span>
                <h2 className="mt-1 text-[23px] leading-tight">{selected.city}</h2>
                <p className="text-[13px] text-muted-foreground">
                  {[provinceOf.get(cityOf(selected)!.key)?.name, cityOf(selected)!.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {plural(cityOf(selected)!.places, "place", "places")} you've saved or photographed
                  here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground"
              >
                Close
              </button>
            </div>
          </section>
        )}

        {byCountry.length > 0 && (
          <div data-guide="places-list">
            <Section
              title="Where you've been"
              hint="Pick a city and the globe spins to it"
              defaultOpen
            >
              <ul className="space-y-3">
                {byCountry.map((visit) => (
                  <li key={visit.key} className="rounded-xl border border-border p-3">
                    <p className="text-[15px] font-semibold">{visit.country}</p>
                    {visit.provinces.length > 0 && (
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        {visit.provinces.map((p) => p.name).join(" · ")}
                      </p>
                    )}
                    {visit.cities.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {visit.cities.map((city) => {
                          const on = selected?.id === `city:${city.key}`;
                          return (
                            <button
                              key={city.key}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                setSelected(
                                  globeCities.find((pin) => pin.id === `city:${city.key}`) ?? null,
                                )
                              }
                              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                                on
                                  ? "border-primary/40 bg-primary-soft font-semibold"
                                  : "border-border bg-card"
                              }`}
                            >
                              <span className="size-2 rounded-full bg-visited" aria-hidden />
                              {city.city}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        )}

        <section data-guide="travel-stats">
          <div className="mb-3 flex items-baseline justify-between">
            <button
              onClick={() => setStatsOpen((v) => !v)}
              className="label-caps flex items-center gap-1.5 text-foreground"
              aria-expanded={statsOpen}
              aria-controls="travel-stats-body"
            >
              <span
                className={`transition-transform duration-(--t-shift) ease-(--ease-standard) ${statsOpen ? "rotate-90" : ""}`}
              >
                ▸
              </span>
              Travel statistics
            </button>
            {statsOpen && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStatsNote((v) => !v)}
                  aria-expanded={statsNote}
                  aria-controls="travel-stats-note"
                  className="tap-44 grid size-5 place-items-center rounded-full border border-border text-[11.5px] font-semibold text-muted-foreground"
                  aria-label="What these numbers count"
                  title="What these numbers count"
                >
                  ?
                </button>
                <button
                  type="button"
                  onClick={() => setStatsEdit((v) => !v)}
                  className="text-[12px] text-primary"
                >
                  {statsEdit ? "Done" : "Choose stats"}
                </button>
              </div>
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
                {statsLayout.layout.trips && (
                  <Stat value={tripsCompleted} label="Trips completed" />
                )}
                {statsLayout.layout.flights && <Stat value={counts.flights} label="Flights" />}
                {statsLayout.layout.hotels && <Stat value={counts.hotels} label="Hotels" />}
                {statsLayout.layout.restaurants && (
                  <Stat value={counts.restaurants} label="Restaurants" />
                )}
                {statsLayout.layout.travelDays && <Stat value={travelDays} label="Travel days" />}
                {statsLayout.layout.pins && <Stat value={savedPinCount} label="Pins" accent />}
              </div>
              {!STAT_OPTIONS.some((option) => statsLayout.layout[option.key]) && (
                <p className="text-[13px] text-muted-foreground">
                  Nothing selected — tap Choose stats and turn a few back on.
                </p>
              )}
              {statsLayout.layout.countries && statsLayout.layout.countryShare && (
                <p className="text-[13px] text-muted-foreground">
                  You have visited {worldShare.percent}% of the world — {worldShare.visited} of{" "}
                  {worldShare.world} widely recognised countries.
                </p>
              )}
              {statsEdit && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-[13px] text-muted-foreground">
                    Pick what Béa counts. Saved on this phone.
                  </p>
                  {STAT_OPTIONS.map((option) => (
                    <div key={option.key} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14.5px] font-medium">{option.label}</p>
                        <p className="text-[12px] text-muted-foreground">{option.hint}</p>
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
                      <p className="text-[14.5px] font-medium">Countries as a world share</p>
                      <p className="text-[12px] text-muted-foreground">
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
                    className="w-full rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
                  >
                    Reset to default
                  </button>
                  <p className="rounded-xl border border-dashed border-primary/40 bg-card px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
                    Dreaming of a number that isn't here — croissants eaten, continents stamped,
                    nights under canvas? Béa's whole job is to make you happy, and she is nosy in
                    the useful way.{" "}
                    <Link
                      to="/profile"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      Tell her on You → Feedback
                    </Link>
                    .
                  </p>
                </div>
              )}
              {/* The caveat is true and worth saying once; it was not worth
                  two paragraphs under every number, every visit. */}
              {statsNote && (
                <div
                  id="travel-stats-note"
                  className="rounded-xl bg-elevated px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground"
                >
                  <p>
                    These stats only include data Béa has access to — the trips, timeline entries,
                    photos and pins saved in this app.
                  </p>
                  <p className="mt-1.5">
                    Missing a number that would make you grin?{" "}
                    <Link to="/profile" className="text-primary underline underline-offset-2">
                      You → Feedback
                    </Link>{" "}
                    is where Béa keeps her ears open.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        <AddVisitedCity
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={() => void vault.reload()}
        />

        <ComparePins
          pins={[
            ...photo.pins,
            ...vault.comparePins.filter((p) => p.type !== "reco" || !isCityLevelPlace(p)),
          ]}
        />
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
      <p className="mt-1 text-[11.5px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {hint && <p className="mt-0.5 text-[11.5px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
