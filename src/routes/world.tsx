import { toLocalISODate } from "@/lib/trip-dates";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bookmark,
  ChevronRight,
  FileText,
  Globe2,
  ListPlus,
  Maximize2,
  MapPin,
  MoreHorizontal,
  Plane,
  Plus,
  Search,
  Share,
  X,
} from "@/components/icons";
import { AppShell } from "@/components/AppShell";
import { Globe } from "@/components/Globe";
import { WorldFlatMap } from "@/components/WorldFlatMap";
import { ComparePins } from "@/components/ComparePins";
import { AddVisitedCity, type AddPlacesStart } from "@/components/AddVisitedCity";
import { Switch } from "@/components/ui/switch";

import { supabase } from "@/integrations/supabase/client";

import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations, type RecoRowDB } from "@/hooks/useRecommendations";
import { useTrips } from "@/hooks/useTrips";
import { useBeaSettings } from "@/hooks/useBeaSettings";
import { STAT_OPTIONS, useStatsLayout } from "@/hooks/useStatsLayout";
import type { Pin, PinType } from "@/data/atlas";
import { useVisitedProvinces } from "@/hooks/useVisitedProvinces";
import { countryDisplayName, countryKey } from "@/lib/country-names";
import {
  cityPins,
  countryMarks,
  isVisitedPin,
  visitedCities,
  visitedCountryKeys,
  visitsByCountry,
  type CountryVisits,
} from "@/lib/world-visits";
import { countryWorldShare } from "@/lib/travel-stats";
import { continentOf, visitedContinents } from "@/lib/continents";
import { isCityLevelPlace } from "@/lib/reco-place";
import { beaLine } from "@/lib/bea-voice";
import { emptyLine } from "@/lib/bea-personality";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { foldAccents } from "@/lib/fuzzy";

type ItineraryCounts = { flights: number; hotels: number; restaurants: number };

/** Which level of the map is showing: everything, or only one of the three counts. */
type WorldView = "all" | "cities" | "provinces" | "countries" | "continents";

/** The four views of the tab, as in the master. */
type WorldTab = "map" | "bucket" | "been" | "stats";

const TABS: { id: WorldTab; label: string; subtitle: string }[] = [
  {
    id: "map",
    label: "Map",
    subtitle: "Explore, save and keep track of everywhere you want to go.",
  },
  {
    id: "bucket",
    label: "Bucket list",
    subtitle: "Plan your next adventure, keep track of where you've been and what's next.",
  },
  {
    id: "been",
    label: "Been there",
    subtitle: "Every country, province and city you've been to, in one place.",
  },
  {
    id: "stats",
    label: "Stats",
    subtitle: "A snapshot of everywhere you've been and everywhere you want to go.",
  },
];

const WORLD_TABS: readonly WorldTab[] = ["map", "bucket", "been", "stats"];

type WorldSearch = {
  /** Open on one view, so the tour and links can point at a control on it. */
  tab?: WorldTab;
};

export const Route = createFileRoute("/world")({
  staticData: { plane: "tab" },
  validateSearch: (search: Record<string, unknown>): WorldSearch =>
    WORLD_TABS.includes(search["tab"] as WorldTab) ? { tab: search["tab"] as WorldTab } : {},
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

/** Saved places grouped by country: one bucket-list row per destination. */
type Destination = {
  key: string;
  name: string;
  /** Cities or place names inside it, most mentioned first. */
  within: string[];
  rows: RecoRowDB[];
};

function destinationsOf(rows: RecoRowDB[]): Destination[] {
  const groups = new Map<string, Destination>();
  for (const row of rows) {
    const country = row.country?.trim();
    const name = country
      ? countryDisplayName(country)
      : row.city?.trim() || row.name.trim() || "Somewhere";
    const key = country ? `c:${countryKey(country)}` : `n:${foldAccents(name).toLowerCase()}`;
    const group = groups.get(key) ?? { key, name, within: [], rows: [] };
    group.rows.push(row);
    const inner = (row.city?.trim() || row.name.trim()) ?? "";
    if (
      inner &&
      foldAccents(inner).toLowerCase() !== foldAccents(name).toLowerCase() &&
      !group.within.some((w) => foldAccents(w).toLowerCase() === foldAccents(inner).toLowerCase())
    ) {
      group.within.push(inner);
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

function WorldPage() {
  const search = Route.useSearch();
  const navigateWorld = Route.useNavigate();
  // The view lives in the URL, so a link opens it, the World tab (no ?tab=)
  // comes back to Map, and a copied link names the view on screen.
  const tab: WorldTab = search.tab ?? "map";
  const setTab = (next: WorldTab) => {
    void navigateWorld({
      search: next === "map" ? {} : { tab: next },
      replace: true,
    });
  };
  const [selected, setSelected] = useState<Pin | null>(null);
  const [statsOpen, setStatsOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addStart, setAddStart] = useState<AddPlacesStart | undefined>(undefined);
  const [view, setView] = useState<WorldView>("all");
  const [statsEdit, setStatsEdit] = useState(false);
  /** The caveat about what the numbers count — asked for, not always on. */
  const [statsNote, setStatsNote] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openCountry, setOpenCountry] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const statsLayout = useStatsLayout();
  const settings = useBeaSettings();

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
  // Montreal counts Québec, Canada and North America: the continents come
  // from the countries, as the countries come from the cities.
  const continents = useMemo(() => visitedContinents(byCountry), [byCountry]);
  const globeCities = useMemo(() => cityPins(cities), [cities]);
  const namedCountries = useMemo(() => countryMarks(places, byCountry), [places, byCountry]);
  const shadedCountries = useMemo(() => visitedCountryKeys(places, provinces), [places, provinces]);
  const provinceOf = useMemo(() => {
    const map = new Map<string, (typeof provinces)[number]>();
    for (const p of provinces) for (const key of p.cityKeys) map.set(key, p);
    return map;
  }, [provinces]);
  const noCountries = useMemo(() => new Set<string>(), []);
  const show = {
    cities: view === "all" || view === "cities",
    provinces: view === "all" || view === "provinces",
    countries: view === "all" || view === "countries" || view === "continents",
  };
  const cityOf = (pin: Pin) => cities.find((c) => `city:${c.key}` === pin.id);

  // The saved lists, from the same recommendations Recs keeps.
  const wishlistRows = useMemo(
    () => vault.rows.filter((r) => r.pin_type === "wishlist" && !r.visited),
    [vault.rows],
  );
  const nextTimeRows = useMemo(
    () => vault.rows.filter((r) => r.pin_type === "nexttime" && !r.visited),
    [vault.rows],
  );
  const bucket = useMemo(() => destinationsOf(wishlistRows), [wishlistRows]);

  const [counts, setCounts] = useState<ItineraryCounts>({ flights: 0, hotels: 0, restaurants: 0 });

  const today = toLocalISODate(new Date());
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
  const worldShare = useMemo(() => countryWorldShare(byCountry.length), [byCountry.length]);

  useEffect(() => {
    if (tab !== "stats" || !statsOpen || !t.trips.length) return;
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
  }, [tab, statsOpen, t.trips]);

  const bucketEmpty = useMemo(
    () => emptyLine({ kind: "noSavedRecommendations", settings }),
    [settings],
  );

  /** Open the add sheet where one of the tiles or buttons asked. */
  const startAdd = (mode: "one" | "list", type?: PinType, file?: File) => {
    setAddStart({ key: Date.now(), mode, type, file });
    setAddOpen(true);
  };

  /** Show a city on the globe: the Map tab, spun to it and selected. */
  const showCity = (cityKey: string) => {
    const pin = globeCities.find((p) => p.id === `city:${cityKey}`) ?? null;
    if (view !== "all" && view !== "cities") setView("all");
    setSelected(pin);
    setTab("map");
  };

  const showCountry = (visit: CountryVisits) => {
    const first = visit.cities[0];
    if (first) showCity(first.key);
    else {
      setSelected(null);
      setView("countries");
      setTab("map");
    }
  };

  /** Your own places matching the search: cities and countries you've been to. */
  const matches = useMemo(() => {
    const q = foldAccents(query).toLowerCase().trim();
    if (q.length < 1) return [];
    const out: { id: string; label: string; sub: string; go: () => void }[] = [];
    for (const visit of byCountry) {
      if (foldAccents(visit.country).toLowerCase().includes(q)) {
        out.push({
          id: `country:${visit.key}`,
          label: visit.country,
          sub: plural(visit.cities.length, "city", "cities"),
          go: () => showCountry(visit),
        });
      }
      for (const city of visit.cities) {
        if (foldAccents(city.city).toLowerCase().includes(q)) {
          out.push({
            id: `city:${city.key}`,
            label: city.city,
            sub: visit.country,
            go: () => showCity(city.key),
          });
        }
      }
    }
    return out.slice(0, 8);
    // showCity/showCountry read the same data these depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, byCountry]);

  const markBeen = async (dest: Destination) => {
    setRowBusy(dest.key);
    try {
      for (const row of dest.rows) await vault.update(row.id, { pin_type: "visited" });
    } finally {
      setRowBusy(null);
      setMenuFor(null);
    }
  };

  const figures = [
    { icon: MapPin, value: cities.length, label: plainLabel(cities.length, "Place", "Places") },
    {
      icon: Globe2,
      value: byCountry.length,
      label: plainLabel(byCountry.length, "Country", "Countries"),
    },
    { icon: Plane, value: t.trips.length, label: plainLabel(t.trips.length, "Trip", "Trips") },
    { icon: Bookmark, value: savedPinCount, label: "Saved places" },
  ];

  const figureCard = (
    <div className="plain-card grid grid-cols-4 divide-x divide-border py-4">
      {figures.map((f, i) => (
        <div key={f.label} className="flex flex-col items-center gap-1 px-1 text-center">
          <span
            className={`tile-fill-${i + 1} grid size-9 place-items-center rounded-full`}
            aria-hidden
          >
            <f.icon className={`seq-text-${i + 1} size-5`} />
          </span>
          <span className="font-display text-[28px] leading-none tabular-nums">{f.value}</span>
          <span className="text-[12px] leading-tight text-muted-foreground">{f.label}</span>
        </div>
      ))}
    </div>
  );

  // "From my trips" is in the master but Béa has no way yet to turn a trip's
  // cities into places you've been, so the tile stays hidden until it does.
  const addTiles: { label: string; icon: typeof Plus; onClick: () => void }[] = [
    { label: "Paste a list", icon: ListPlus, onClick: () => startAdd("list") },
    { label: "Add manually", icon: Plus, onClick: () => startAdd("one") },
    { label: "Import file", icon: FileText, onClick: () => fileRef.current?.click() },
  ];

  const addCard = (
    <section className="plain-card p-4">
      <h2 className="font-display text-[22px] leading-none">Add places to your world</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {addTiles.map((tile, i) => (
          <button
            key={tile.label}
            type="button"
            onClick={tile.onClick}
            className={`tile-fill-${i + 2} flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/60 px-2 text-[12.5px] font-medium transition-transform active:scale-[0.97]`}
          >
            <tile.icon className={`seq-text-${i + 2} size-6`} aria-hidden />
            {tile.label}
          </button>
        ))}
      </div>
    </section>
  );

  const viewFilters =
    places.length > 0 ? (
      // The counts are also filters: tap Cities and the globe and the list
      // show only cities; tap it again for everything.
      <div role="group" aria-label="Show on the map" className="flex flex-wrap gap-1.5">
        {[
          { id: "cities" as const, n: cities.length, one: "City", many: "Cities" },
          provinces.length > 0
            ? {
                id: "provinces" as const,
                n: provinces.length,
                one: "Province / state",
                many: "Provinces & states",
              }
            : null,
          { id: "countries" as const, n: byCountry.length, one: "Country", many: "Countries" },
          continents.length > 0
            ? {
                id: "continents" as const,
                n: continents.length,
                one: "Continent",
                many: "Continents",
              }
            : null,
        ]
          .filter((s) => s !== null)
          .map((stat) => {
            const on = view === stat.id;
            return (
              <button
                key={stat.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = on ? "all" : stat.id;
                  setView(next);
                  // A city card with no city pin on the globe points at nothing.
                  if (next !== "all" && next !== "cities") setSelected(null);
                }}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className="tabular-nums">{stat.n}</span>
                <span className={on ? "text-primary-foreground/85" : "text-muted-foreground"}>
                  {stat.n === 1 ? stat.one : stat.many}
                </span>
              </button>
            );
          })}
      </div>
    ) : null;

  const current = TABS.find((x) => x.id === tab)!;

  return (
    <AppShell
      title={<span className="text-[44px] leading-none">Your world</span>}
      headerAction={
        <button
          type="button"
          aria-label={searchOpen ? "Close search" : "Search your world"}
          aria-expanded={searchOpen}
          onClick={() => {
            setSearchOpen((v) => !v);
            setQuery("");
          }}
          className="grid size-12 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm"
        >
          {searchOpen ? (
            <X className="size-5" aria-hidden />
          ) : (
            <Search className="size-5" aria-hidden />
          )}
        </button>
      }
    >
      <div className="space-y-5">
        <p className="-mt-3 text-[15px] text-muted-foreground">
          {current.subtitle}
          {places.length > 0 && (
            <span className="sr-only">
              {" "}
              {[
                cities.length > 0 ? plural(cities.length, "city", "cities") : "",
                plural(byCountry.length, "country", "countries"),
                continents.length > 0 ? plural(continents.length, "continent", "continents") : "",
              ]
                .filter(Boolean)
                .join(", ")}
              .
            </span>
          )}
        </p>

        {searchOpen && (
          <div className="rise plain-card space-y-2 p-3">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="A city or country you've been to"
              aria-label="Search your world"
              className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-[15px] outline-none focus:border-primary"
            />
            {query.trim() && (
              <ul className="divide-y divide-border">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        m.go();
                        setSearchOpen(false);
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-3 px-1 py-2.5 text-left"
                    >
                      <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{m.label}</span>
                        <span className="block text-[12.5px] text-muted-foreground">{m.sub}</span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      startAdd("one");
                    }}
                    className="flex w-full items-center gap-3 px-1 py-2.5 text-left text-[14.5px] font-medium text-primary"
                  >
                    <Plus className="size-4" aria-hidden />
                    {matches.length ? "Add another place" : "Not there yet — add a place"}
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}

        <div
          role="tablist"
          aria-label="World views"
          data-guide="world-tabs"
          className="grid grid-cols-4 gap-1.5"
        >
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={`h-10 whitespace-nowrap rounded-full px-1 text-[13.5px] font-semibold transition-colors duration-(--t-tap) ${
                tab === x.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-elevated text-foreground hover:bg-accent"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        {tab === "map" && (
          <>
            {places.length === 0 && (
              <div className="plain-card flex items-center gap-3 p-4">
                <img
                  src="/bea/bea-think-static.png"
                  alt=""
                  className="art-dim size-16 shrink-0 object-contain"
                />
                <div>
                  <p className="font-display text-[20px] leading-snug">
                    {beaLine("empty.globe").title}
                  </p>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    {beaLine("empty.globe").body}
                  </p>
                </div>
              </div>
            )}

            <div data-guide="globe" className="relative">
              <Globe
                variant="open"
                pins={show.cities ? globeCities : []}
                regions={show.provinces ? provinces : []}
                // Cities and Provinces show only themselves: no whole countries
                // shaded behind them, from the pins or from the list.
                visitedCountries={show.countries ? shadedCountries : noCountries}
                shadePinCountries={show.countries}
                countryMarks={show.countries ? namedCountries : []}
                selectedId={selected?.id}
                onSelect={setSelected}
                onCountrySelect={(name) => {
                  // A tap on a country opens one of your cities there, in any
                  // language the country was saved in — only while cities are
                  // on the globe, so it has a pin to spin to.
                  if (!show.cities) return;
                  const key = countryKey(name);
                  const match = globeCities.find((pin) => countryKey(pin.country) === key);
                  if (match) setSelected(match);
                }}
              />
              <button
                type="button"
                data-guide="add-city"
                onClick={() => startAdd("one")}
                aria-label="Add a city or country"
                className="absolute bottom-1 right-0 flex flex-col items-center gap-1 text-[12px] font-medium"
              >
                <span className="grid size-14 place-items-center rounded-full border border-border bg-card text-foreground shadow-md transition-transform active:scale-95">
                  <Share className="size-6" aria-hidden />
                </span>
                Add places
              </button>
            </div>

            {viewFilters}

            {selected && cityOf(selected) && (
              <section className="rise plain-card p-4">
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
                      {plural(cityOf(selected)!.places, "place", "places")} you've saved or
                      photographed here.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground"
                  >
                    Close
                  </button>
                </div>
              </section>
            )}

            {figureCard}
            {addCard}
          </>
        )}

        {tab === "bucket" && (
          <>
            <div className="relative overflow-hidden rounded-[var(--r-card)]">
              <img
                src={bannerArtUrl("coastal")}
                alt=""
                className="art-dim h-[190px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-center gap-4 p-5">
                <h2 className="max-w-[12ch] font-display text-[34px] leading-[1.02] text-white">
                  Dream now, pin later.
                </h2>
                <button
                  type="button"
                  onClick={() => startAdd("one", "wishlist")}
                  className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-neutral-900 shadow-sm"
                >
                  Add to bucket list <Plus className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-[27px] leading-none">My bucket list</h2>
                <Link
                  to="/recommendations"
                  className="inline-flex items-center gap-0.5 text-[14px] font-semibold text-primary"
                >
                  See all <ChevronRight className="size-4" aria-hidden />
                </Link>
              </div>
              {vault.loading ? (
                <div className="plain-card h-40 animate-pulse" />
              ) : bucket.length === 0 ? (
                <div className="plain-card flex items-center gap-3 p-4">
                  <img
                    src="/bea/bea-think-static.png"
                    alt=""
                    className="art-dim size-16 shrink-0 object-contain"
                  />
                  <p className="text-[14.5px] text-muted-foreground">{bucketEmpty}</p>
                </div>
              ) : (
                <ul className="plain-card divide-y divide-border overflow-visible">
                  {bucket.map((dest, i) => (
                    <PlaceRow
                      key={dest.key}
                      picture={bannerArtUrl(bannerSceneFor([dest.name, ...dest.within], dest.name))}
                      title={dest.name}
                      sub={dest.within.slice(0, 3).join(" · ")}
                      count={plural(dest.rows.length, "place", "places")}
                      pin={
                        <MapPin
                          className={`seq-text-${(i % 5) + 1} size-6`}
                          weight="fill"
                          aria-hidden
                        />
                      }
                      menu={
                        <RowMenu
                          open={menuFor === dest.key}
                          onToggle={() => setMenuFor(menuFor === dest.key ? null : dest.key)}
                          label={`More for ${dest.name}`}
                        >
                          <Link
                            to="/recommendations"
                            className="block px-4 py-2.5 text-[14px] hover:bg-elevated"
                          >
                            Open in Recs
                          </Link>
                          <button
                            type="button"
                            disabled={rowBusy === dest.key}
                            onClick={() => void markBeen(dest)}
                            className="block w-full px-4 py-2.5 text-left text-[14px] hover:bg-elevated disabled:opacity-50"
                          >
                            {rowBusy === dest.key ? "Moving…" : "Been there — put it on my globe"}
                          </button>
                        </RowMenu>
                      }
                    />
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => startAdd("one", "wishlist")}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-primary/15 bg-primary-soft text-[16px] font-semibold text-primary transition-transform active:scale-[0.99]"
              >
                <Plus className="size-5" aria-hidden /> Add a destination
              </button>
            </section>

            <ComparePins
              pins={[
                ...photo.pins,
                ...vault.comparePins.filter((p) => p.type !== "reco" || !isCityLevelPlace(p)),
              ]}
            />
          </>
        )}

        {tab === "been" && (
          <>
            {viewFilters}
            {byCountry.length === 0 ? (
              <div className="plain-card flex items-center gap-3 p-4">
                <img
                  src="/bea/bea-think-static.png"
                  alt=""
                  className="art-dim size-16 shrink-0 object-contain"
                />
                <div>
                  <p className="font-display text-[20px] leading-snug">
                    {beaLine("empty.globe").title}
                  </p>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    {beaLine("empty.globe").body}
                  </p>
                </div>
              </div>
            ) : (
              <section data-guide="places-list" className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-[27px] leading-none">Where you've been</h2>
                  <span className="text-[13px] text-muted-foreground">Tap a city to see it</span>
                </div>
                {(view === "continents"
                  ? [
                      ...continents.map((c) => ({
                        heading: `${c.continent} · ${plural(c.countries.length, "country", "countries")}`,
                        visits: byCountry.filter((v) => continentOf(v.key) === c.continent),
                      })),
                      {
                        heading: "Elsewhere",
                        visits: byCountry.filter((v) => !continentOf(v.key)),
                      },
                    ].filter((group) => group.visits.length > 0)
                  : [
                      {
                        heading: "",
                        visits: byCountry.filter((visit) =>
                          view === "provinces"
                            ? visit.provinces.length > 0
                            : view === "cities"
                              ? visit.cities.length > 0
                              : true,
                        ),
                      },
                    ]
                ).map((group) => (
                  <div key={group.heading || "all"} className="space-y-2">
                    {group.heading && <h3 className="label-caps px-1">{group.heading}</h3>}
                    <ul className="plain-card divide-y divide-border">
                      {group.visits.map((visit, i) => {
                        const expanded = openCountry === visit.key;
                        const sub =
                          view !== "cities" && view !== "countries" && visit.provinces.length > 0
                            ? visit.provinces.map((p) => p.name).join(" · ")
                            : visit.cities
                                .slice(0, 4)
                                .map((c) => c.city)
                                .join(" · ");
                        const placeCount = visit.cities.reduce((n, c) => n + c.places, 0);
                        return (
                          <PlaceRow
                            key={visit.key}
                            picture={bannerArtUrl(
                              bannerSceneFor(
                                [visit.country, ...visit.cities.map((c) => c.city)],
                                visit.country,
                              ),
                            )}
                            title={visit.country}
                            sub={sub}
                            count={
                              visit.cities.length > 0
                                ? `${plural(visit.cities.length, "city", "cities")} · ${plural(placeCount, "place", "places")}`
                                : "The whole country"
                            }
                            onOpen={
                              show.cities && visit.cities.length > 0
                                ? () => setOpenCountry(expanded ? null : visit.key)
                                : undefined
                            }
                            expanded={expanded}
                            pin={
                              <button
                                type="button"
                                onClick={() => showCountry(visit)}
                                aria-label={`Show ${visit.country} on the globe`}
                                className="grid size-10 place-items-center rounded-full"
                              >
                                <MapPin
                                  className={`seq-text-${(i % 5) + 1} size-6`}
                                  weight="fill"
                                  aria-hidden
                                />
                              </button>
                            }
                            extra={
                              expanded ? (
                                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                                  {visit.cities.map((city) => (
                                    <button
                                      key={city.key}
                                      type="button"
                                      onClick={() => showCity(city.key)}
                                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px]"
                                    >
                                      <span
                                        className="size-2 rounded-full bg-visited"
                                        aria-hidden
                                      />
                                      {city.city}
                                    </button>
                                  ))}
                                </div>
                              ) : null
                            }
                          />
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            )}
            <button
              type="button"
              onClick={() => startAdd("one", "visited")}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-primary/15 bg-primary-soft text-[16px] font-semibold text-primary transition-transform active:scale-[0.99]"
            >
              <Plus className="size-5" aria-hidden /> Add a place you've been
            </button>
          </>
        )}

        {tab === "stats" && (
          <>
            {figureCard}

            <div className="plain-card relative overflow-hidden p-2">
              <WorldFlatMap
                pins={globeCities}
                visitedCountries={shadedCountries}
                regions={provinces}
                countryMarks={namedCountries}
              />
              <button
                type="button"
                onClick={() => {
                  setView("all");
                  setTab("map");
                }}
                aria-label="Open the globe"
                title="Open the globe"
                className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-border bg-card shadow-sm"
              >
                <Maximize2 className="size-4" aria-hidden />
              </button>
            </div>

            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-[27px] leading-none">Your travel lists</h2>
                <Link
                  to="/recommendations"
                  className="inline-flex items-center gap-0.5 text-[14px] font-semibold text-primary"
                >
                  See all <ChevronRight className="size-4" aria-hidden />
                </Link>
              </div>
              <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
                {[
                  {
                    label: "Bucket list",
                    n: wishlistRows.length,
                    scene: "coastal" as const,
                    go: () => setTab("bucket"),
                  },
                  {
                    label: "Been there",
                    n: cities.length,
                    scene: "oldtown" as const,
                    go: () => setTab("been"),
                  },
                  {
                    label: "Next time",
                    n: nextTimeRows.length,
                    scene: "temple" as const,
                    to: "/recommendations" as const,
                  },
                ].map((list) => {
                  const body = (
                    <>
                      <img
                        src={bannerArtUrl(list.scene)}
                        alt=""
                        className="art-dim h-[92px] w-full rounded-xl object-cover"
                      />
                      <span className="mt-2 block px-1 text-[14.5px] font-semibold">
                        {list.label}
                      </span>
                      <span className="block px-1 text-[12.5px] text-muted-foreground">
                        {plural(list.n, "place", "places")}
                      </span>
                    </>
                  );
                  const cls =
                    "plain-card w-[132px] shrink-0 snap-start p-1.5 pb-2.5 text-left transition-transform active:scale-[0.98]";
                  return "to" in list && list.to ? (
                    <Link key={list.label} to={list.to} className={cls}>
                      {body}
                    </Link>
                  ) : (
                    <button key={list.label} type="button" onClick={list.go} className={cls}>
                      {body}
                    </button>
                  );
                })}
              </div>
            </section>

            {addCard}

            <section data-guide="travel-stats">
              <div className="mb-3 flex items-baseline justify-between">
                <button
                  onClick={() => setStatsOpen((v) => !v)}
                  className="flex items-center gap-1.5 font-display text-[22px] leading-none text-foreground"
                  aria-expanded={statsOpen}
                  aria-controls="travel-stats-body"
                >
                  <ChevronRight
                    className={`size-4 transition-transform duration-(--t-shift) ease-(--ease-standard) ${statsOpen ? "rotate-90" : ""}`}
                    aria-hidden
                  />
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
                      className="text-[13px] font-semibold text-primary"
                    >
                      {statsEdit ? "Done" : "Choose stats"}
                    </button>
                  </div>
                )}
              </div>
              {statsOpen && (
                <div id="travel-stats-body" className="plain-card space-y-3 px-4 py-4">
                  <div className="grid grid-cols-4 gap-2">
                    {statsLayout.layout.countries &&
                      (statsLayout.layout.countryShare ? (
                        <Stat
                          value={`${worldShare.percent}%`}
                          label="of the world"
                          hint={`${worldShare.visited} of ${worldShare.world} countries`}
                        />
                      ) : (
                        <Stat value={byCountry.length} label="Countries" />
                      ))}
                    {statsLayout.layout.cities && <Stat value={cities.length} label="Cities" />}
                    {statsLayout.layout.trips && (
                      <Stat value={tripsCompleted} label="Trips completed" />
                    )}
                    {statsLayout.layout.flights && <Stat value={counts.flights} label="Flights" />}
                    {statsLayout.layout.hotels && <Stat value={counts.hotels} label="Hotels" />}
                    {statsLayout.layout.restaurants && (
                      <Stat value={counts.restaurants} label="Restaurants" />
                    )}
                    {statsLayout.layout.travelDays && (
                      <Stat value={travelDays} label="Travel days" />
                    )}
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
                        Pick what Béa counts. Saved to your account.
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
                        className="w-full rounded-full border border-border px-3 py-2 text-[13px] font-semibold"
                      >
                        Reset to default
                      </button>
                      <p className="rounded-xl border border-dashed border-primary/40 bg-card px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
                        Dreaming of a number that isn't here — croissants eaten, continents stamped,
                        nights under canvas? Béa's whole job is to make you happy, and she is nosy
                        in the useful way.{" "}
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
                        These stats only include data Béa has access to — the trips, timeline
                        entries, photos and pins saved in this app.
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
          </>
        )}

        {/* "Import file" picks the file straight from the tap (a browser only
            opens the picker from a gesture), then the sheet reads it. */}
        <input
          ref={fileRef}
          type="file"
          accept="text/plain,text/csv,.txt,.md,.csv,.list"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) startAdd("list", undefined, file);
          }}
        />

        <AddVisitedCity
          open={addOpen}
          start={addStart}
          onClose={() => setAddOpen(false)}
          onSaved={() => void vault.reload()}
        />
      </div>
    </AppShell>
  );
}

/** One destination row, as in the master's bucket list: picture, name, places, pin, more. */
function PlaceRow({
  picture,
  title,
  sub,
  count,
  pin,
  menu,
  onOpen,
  expanded,
  extra,
}: {
  picture: string;
  title: string;
  sub: string;
  count: string;
  pin: ReactNode;
  menu?: ReactNode;
  onOpen?: (() => void) | undefined;
  expanded?: boolean;
  extra?: ReactNode;
}) {
  const text = (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[16px] font-semibold">{title}</span>
      {sub && <span className="block truncate text-[13px] text-muted-foreground">{sub}</span>}
      <span className="block text-[12.5px] text-muted-foreground">{count}</span>
    </span>
  );
  return (
    <li>
      <div className="flex items-center gap-3 p-2.5">
        <img
          src={picture}
          alt=""
          className="art-dim h-[60px] w-[84px] shrink-0 rounded-xl object-cover"
        />
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 text-left"
          >
            {text}
          </button>
        ) : (
          text
        )}
        {pin}
        {menu}
      </div>
      {extra}
    </li>
  );
}

function RowMenu({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-expanded={open}
        className="grid size-10 place-items-center rounded-full text-muted-foreground"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-60 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-lg">
          {children}
        </div>
      )}
    </div>
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
      <p className={`font-display text-[24px] leading-none ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      <p className="mt-1 text-[12px] leading-tight text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-[11.5px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function plainLabel(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
