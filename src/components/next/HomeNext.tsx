import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  CloudSun,
  Heart,
  Luggage,
  MapPin,
  Navigation,
  Plane,
} from "@/components/icons";
import { StopArt } from "@/components/day/stop-bits";
import { TripPicture } from "@/components/HomeTripCard";
import { AerialBanner, type AerialPlace } from "@/components/next/AerialBanner";
import { useAerialRoute } from "@/hooks/useAerialRoute";
import { usePlaceNow } from "@/hooks/usePlaceNow";
import { useTownPicture } from "@/hooks/useTownPicture";
import type { TripGlance } from "@/hooks/useTripGlances";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripRow } from "@/hooks/useTrips";
import { calloutBoxes, tripProgress } from "@/lib/aerial-route";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { flightParts, heroWhen, pillLabel, stayLabel } from "@/lib/home-route-map";
import { todaysCompanion, untilLabel, type SavedCity } from "@/lib/home-now";
import { routeStopOn } from "@/lib/import-stop";
import { terrainFor, TERRAIN_ART, type TerrainRegistry } from "@/lib/terrain-art";
import { timeForRail } from "@/lib/timeline-kind";
import { toLocalISODate } from "@/lib/trip-dates";
import { heroTags, routeLine } from "@/lib/trip-glance";
import { describeWeather, usesFahrenheit } from "@/lib/weather";
import { creditedOnPhoto } from "@/lib/wikimedia";

const ON_TRIP_H = 430;
const UPCOMING_H = 420;
const NO_TRIP_H = 360;

/** "Alps Road Trip" → "Alps Road Trip." (the header pattern: a title ends with a full stop). */
function withStop(title: string): string {
  const t = title.trim();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

function sceneFor(trip: TripRow, cities: string[]): string {
  return bannerArtUrl(
    bannerSceneFor([trip.title, ...cities, trip.city, trip.country], trip.title || trip.city || ""),
  );
}

/** The words over the top of an aerial banner: kicker, serif title, and a round button. */
function BannerWords({
  trip,
  kicker,
  title,
  sub,
}: {
  trip: TripRow;
  kicker: string;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="relative z-[2] flex items-start justify-between gap-3 px-5 pt-3">
      <Link to="/trips/$tripId" params={{ tripId: trip.id }} viewTransition className="min-w-0">
        <p className="hn-kicker">{kicker}</p>
        <h2 className="hn-title mt-1.5">{title}</h2>
        {sub ? <p className="mt-1.5 text-[15px] font-medium text-foreground/80">{sub}</p> : null}
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        aria-label={`Open ${trip.title}`}
        className="hn-ink-btn mt-1 shrink-0"
      >
        <ArrowRight className="size-[22px]" aria-hidden />
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Upcoming                                                            */
/* ------------------------------------------------------------------ */

/**
 * Home before a trip (Figma "Home", upcoming): the kind of moment, the trip's
 * name and how soon, its destination picture, and the route as a row of city
 * chips with their stay. No map: the picture is a photo of the place.
 */
export function HomeNextUpcoming({ trip, photos }: { trip: TripRow; photos: TripPhotoRow[] }) {
  const { stops, route } = useAerialRoute(trip, true);
  const tags = heroTags(trip.start_date, trip.end_date, trip.dates_status === "tentative");
  const when = heroWhen(tags.when);
  const cityNames = stops.map((s) => s.city).filter(Boolean);
  return (
    <section data-guide="home-trip" className="space-y-3">
      <Link to="/trips/$tripId" params={{ tripId: trip.id }} viewTransition className="block">
        <p className="hn-kicker">{tags.label}</p>
        <h2 className="hn-title mt-1.5 !text-[32px]">
          <span className="line-clamp-2 break-words">{trip.title}</span>
          {when ? <span className="block">{when}</span> : null}
        </h2>
      </Link>
      <div className="overflow-hidden rounded-[var(--r-card)] border border-border bg-card">
        <TripPhotoBox trip={trip} photos={photos} cities={cityNames} />
        <div className="border-t border-border p-2">
          <CityChips cities={route.map((s) => ({ city: s.city, days: stayLabel(s.days) }))} />
        </div>
      </div>
    </section>
  );
}

/** The destination picture: a photo of the place, never a map. */
function TripPhotoBox({
  trip,
  photos,
  cities,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  cities: string[];
}) {
  return (
    <div className="relative h-[112px] overflow-hidden">
      <TripPicture trip={trip} photos={photos} cities={cities} />
    </div>
  );
}

/** The route as chips joined by arrows: "Paris · 3 days → Prague · 1 day". */
function CityChips({
  cities,
  current = -1,
}: {
  cities: { city: string; days: string }[];
  current?: number;
}) {
  if (cities.length === 0) return null;
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto pb-0.5" aria-label="Route">
      {cities.map((c, i) => (
        <li key={`${c.city}-${i}`} className="flex shrink-0 items-center gap-1.5">
          {i > 0 ? <ArrowRight className="size-4 text-muted-foreground" aria-hidden /> : null}
          <span
            aria-current={i === current ? "step" : undefined}
            className={`rounded-full border px-3 py-1.5 leading-tight ${
              i === current ? "border-foreground bg-card" : "border-border bg-card"
            }`}
          >
            <b className="block text-[14px] font-semibold">{pillLabel(c.city)}</b>
            {c.days ? (
              <span className="block text-[13px] text-muted-foreground">{c.days}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** "Sat, Apr 12": the flight's day. */
function shortDay(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * The trip in three numbers (the same three as Home's stats strip, each
 * opening its own list): to-dos left, the flight, how packed. Pastel boxes
 * in Colorful, quiet cells in Calm and Dark.
 */
export function HomeNextStats({
  trip,
  glance,
  overlap = true,
}: {
  trip: TripRow;
  glance: TripGlance | undefined;
  /** Rising over the foot of the map above it; off when the stop panel sits between. */
  overlap?: boolean;
}) {
  const open = glance?.todos.open ?? 0;
  const flight = glance?.flight ?? null;
  const parts = flight ? flightParts(`${flight.title} ${flight.detail ?? ""}`) : null;
  const packing = glance?.packing ?? null;
  const percent = packing ? Math.round(packing.ratio * 100) : 0;
  const packed = packing
    ? new Intl.NumberFormat(undefined, { style: "percent" }).format(percent / 100)
    : "—";
  const tile =
    "flex min-h-[64px] flex-col justify-center gap-0.5 rounded-[var(--r-card)] border border-border bg-card px-3 py-2.5";
  return (
    <section
      data-guide="home-next"
      aria-label="This trip at a glance"
      className="grid grid-cols-3 gap-2"
    >
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={{ prep: "todo" }}
        className={tile}
      >
        <Stat big={String(open)} small={open === 1 ? "to-do" : "to-dos"} />
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={flight ? {} : { view: "bookings" }}
        className={tile}
      >
        {flight ? (
          <Stat
            big={parts?.code ?? flight.title}
            small={shortDay(flight.day_date) || "flight"}
            icon={<Plane className="size-4" aria-hidden />}
          />
        ) : (
          <Stat
            big="Flight"
            small="Not added yet"
            icon={<Plane className="size-4" aria-hidden />}
          />
        )}
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={{ prep: "packing" }}
        className={tile}
      >
        <Stat
          big={packed}
          small={packing ? "packed" : "Packing list"}
          icon={<Luggage className="size-4" aria-hidden />}
        />
      </Link>
    </section>
  );
}

/** The frame's "Continue trip" card: one door to the trip's four working views. */
export function HomeNextContinue({ trip }: { trip: TripRow }) {
  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      className="flex min-h-[64px] flex-col justify-center gap-0.5 rounded-[var(--r-card)] border border-border bg-card px-4 py-3"
    >
      <span className="flex items-center gap-1.5 text-[16px] font-bold leading-tight">
        Continue trip
        <ArrowRight className="size-4" aria-hidden />
      </span>
      <span className="text-[13px] text-muted-foreground">
        Overview · Itinerary · To-do · Packing
      </span>
    </Link>
  );
}

function Stat({ big, small, icon }: { big: string; small: string; icon?: ReactNode }) {
  return (
    <span className="block min-w-0">
      <span className="flex items-center gap-1.5 text-[16px] font-bold leading-tight">
        {icon}
        <span className="truncate">{big}</span>
      </span>
      <span className="line-clamp-2 block break-words text-[13px] leading-snug text-muted-foreground">
        {small}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* On a trip                                                           */
/* ------------------------------------------------------------------ */

/** What a stop card shows of a plan row. */
type NowStop = {
  id: string;
  title: string;
  kind: string;
  detail: string | null;
  address: string | null;
  time_label: string | null;
};

/**
 * Home while a trip is under way (mockup `tripHero('home')`, the references'
 * "On trip · Day 3 of 7"): the trip from above with its route, the city you
 * are in ringed, the ones behind you filled; then, on a panel rising over
 * the banner's foot, the current and next stops and three chips — how far
 * along, the weather there, what you saved there. Where you are comes from
 * the Companion's taps ("I'm here", "Leaving"), never from the clock.
 */
export function HomeNextOnTrip({
  trip,
  photos,
  glance,
  showStops = true,
  savedHere,
  weather = false,
  registry = TERRAIN_ART,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  /** The "Current / Next stop" module (Customize home). */
  showStops?: boolean;
  /** Places saved in the trip's towns (`useHomeTripModules().savedHere.length`). */
  savedHere: number;
  /** Ask the weather there (only when a weather module is on, as Home does). */
  weather?: boolean;
  registry?: TerrainRegistry;
}) {
  const { stops, placed, route, indexOf } = useAerialRoute(trip, true);
  const today = toLocalISODate(new Date());
  // The city ringed is where the taps say you are, never merely the city the calendar puts today in.
  const taps = useMemo(() => todaysCompanion(glance?.items ?? [], today), [glance, today]);
  const calendarCity = routeStopOn(placed, today);
  const tappedCity = taps.current?.day_date ? routeStopOn(placed, taps.current.day_date) : null;
  const indexOfCity = (city: typeof calendarCity) =>
    city ? (indexOf[placed.indexOf(city)] ?? -1) : -1;
  const current = indexOfCity(tappedCity);
  const behind = Math.max(0, indexOfCity(calendarCity));
  const tags = heroTags(trip.start_date, trip.end_date, trip.dates_status === "tentative");
  const cityNames = stops.map((s) => s.city).filter(Boolean);
  const kicker = [tags.label === "On the trip" ? "On trip" : tags.label, tags.when]
    .filter(Boolean)
    .join(" · ");
  const terrain = terrainFor(
    [trip.title, ...route.map((s) => s.city), trip.country],
    route,
    registry,
  );
  const here = route[current >= 0 ? current : Math.min(behind, route.length - 1)] ?? null;
  const progress = tripProgress(current, behind, route.length);

  return (
    <section data-guide="home-trip" className="space-y-3">
      <Link to="/trips/$tripId" params={{ tripId: trip.id }} viewTransition className="block">
        <p className="hn-kicker">{kicker}</p>
        <h2 className="hn-title mt-1.5">{withStop(trip.title)}</h2>
      </Link>
      <TripPhotoBox trip={trip} photos={photos} cities={cityNames} />
      <CityChips
        cities={route.map((s) => ({ city: s.city, days: stayLabel(s.days) }))}
        current={current >= 0 ? current : Math.min(behind, route.length - 1)}
      />
      <div className="space-y-3">
        {showStops ? <NowCards trip={trip} glance={glance} day={tags.when} /> : null}
        <TripChips
          trip={trip}
          progress={progress}
          here={here}
          savedHere={savedHere}
          weather={weather}
        />
      </div>
    </section>
  );
}

function NowCards({
  trip,
  glance,
  day,
}: {
  trip: TripRow;
  glance: TripGlance | undefined;
  day: string;
}) {
  const today = toLocalISODate(new Date());
  const state = useMemo(() => todaysCompanion(glance?.items ?? [], today), [glance, today]);
  if (!glance) return null;
  const dayNumber = /^Day \d+/.exec(day)?.[0] ?? "";
  const dayMeta = dayNumber ? `${dayNumber} · Today` : "Today";
  if (state.stops.length === 0 || state.phase === "done") {
    return (
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        className="hn-card block p-4"
      >
        <p className="text-[14px] text-muted-foreground">{dayMeta}</p>
        <p className="mt-1 text-[17px] font-semibold">
          {state.stops.length === 0 ? "Nothing planned for today." : "That was today's last stop."}
        </p>
      </Link>
    );
  }
  const now = new Date();
  return (
    <div className="hn-card divide-y divide-border/70 overflow-hidden">
      {state.current ? (
        <StopCard trip={trip} stop={state.current} label="Current stop" meta={dayMeta} live />
      ) : null}
      {state.next ? (
        <StopCard
          trip={trip}
          stop={state.next}
          label="Next stop"
          meta={untilLabel(state.next.time_label, now)}
        />
      ) : null}
    </div>
  );
}

/** One stop, as Companion says it: its name, its time, a line about it and its picture. */
function StopCard({
  trip,
  stop,
  label,
  meta,
  live = false,
}: {
  trip: TripRow;
  stop: NowStop;
  label: string;
  meta: string;
  live?: boolean;
}) {
  const time = timeForRail(stop.time_label);
  const line = stop.detail?.trim() || stop.address?.trim() || "";
  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      aria-label={`${label}: ${stop.title}${time ? `, ${time}` : ""}`}
      className="block p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium text-muted-foreground">{label}</p>
        <span className="flex min-w-0 items-center gap-2 text-[14px] text-muted-foreground">
          <span className="truncate">{meta}</span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-foreground">
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </span>
      </div>
      <p className="mt-0.5 flex items-center gap-2 text-[18px] font-semibold leading-snug">
        <span aria-hidden className={`hn-stop-dot ${live ? "hn-stop-dot-live" : ""}`} />
        <span className="min-w-0 break-words">{stop.title}</span>
      </p>
      <div className="mt-3 flex items-center gap-3.5">
        <StopArt item={stop} className="h-[76px] w-[104px] shrink-0 rounded-[14px]" />
        <div className="min-w-0">
          {time ? <p className="text-[17px] font-bold leading-tight">{time}</p> : null}
          {line ? (
            <p className="mt-0.5 line-clamp-3 text-[15px] leading-snug text-muted-foreground">
              {line}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function temperature(celsius: number): string {
  const f = usesFahrenheit(typeof navigator === "undefined" ? undefined : navigator.language);
  return f ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;
}

/**
 * The references' three chips under the stops: how far along the trip is
 * (stops), the weather in the town you are in, what you saved there. Each
 * says only what is known: no weather chip until the sky answers.
 */
function TripChips({
  trip,
  progress,
  here,
  savedHere,
  weather,
}: {
  trip: TripRow;
  progress: { at: number; total: number };
  here: { city: string; lat: number; lon: number } | null;
  savedHere: number;
  weather: boolean;
}) {
  const now = usePlaceNow(weather ? here?.lat : null, weather ? here?.lon : null);
  const sky = now.status === "ready" ? now.weather : null;
  return (
    <div className="grid grid-cols-3 gap-2 pb-1">
      {progress.total > 0 ? (
        <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="hn-chip hn-chip-1">
          <span className="hn-chip-icon">
            <MapPin className="size-4" aria-hidden />
          </span>
          <Stat big={`${progress.at}/${progress.total}`} small="stops" />
        </Link>
      ) : null}
      {sky && here ? (
        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          aria-label={`${temperature(sky.temp)}, ${describeWeather(sky.code).label}, in ${here.city}`}
          className="hn-chip hn-chip-2"
        >
          <span className="hn-chip-icon">
            <CloudSun className="size-4" aria-hidden />
          </span>
          <Stat big={temperature(sky.temp)} small={`in ${pillLabel(here.city, 12)}`} />
        </Link>
      ) : null}
      <Link to="/recommendations" className="hn-chip hn-chip-4">
        <span className="hn-chip-icon">
          <Bookmark className="size-4" aria-hidden />
        </span>
        <Stat big="Saved" small={`${savedHere} ${savedHere === 1 ? "place" : "places"}`} />
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* No trip                                                             */
/* ------------------------------------------------------------------ */

/**
 * Home with no trip (Figma "Home no trip"): "No trip selected", the invitation
 * to start one, and Plan with Béa. The saved cities follow as photo cards.
 */
export function HomeNextNoTrip({ greeting, date }: { greeting: string; date: string }) {
  return (
    <section
      data-guide="home-trip"
      className="space-y-2 rounded-[var(--r-card)] border border-border bg-muted/60 p-4"
    >
      <p className="hn-kicker">No trip selected</p>
      <h2 className="hn-title !text-[30px]">Your next trip starts here</h2>
      <p className="text-[15px] text-foreground/80">
        Your saved places are ready when you are. Choose a city, then shape a plan.
      </p>
      <Link
        to="/trips/plan"
        aria-label={`Plan with Béa. ${greeting}, ${date}`}
        className="flex min-h-11 items-center justify-center rounded-[var(--r-card)] border border-border bg-card px-4 text-[15px] font-semibold"
      >
        Plan with Béa
      </Link>
    </section>
  );
}
