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
 * Home before a trip (mockup `homeUpcoming`, the references' trip home): the
 * kind of moment and how soon over the trip's part of the world, seen from
 * above, its cities joined by the route, each with a photo bubble saying how
 * long you stay. Without any placed city, the trip's picture.
 */
export function HomeNextUpcoming({
  trip,
  photos,
  registry = TERRAIN_ART,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  /** The owner's terrain art (`terrain-art.ts`). */
  registry?: TerrainRegistry;
}) {
  const { stops, route } = useAerialRoute(trip, true);
  const tags = heroTags(trip.start_date, trip.end_date, trip.dates_status === "tentative");
  const when = heroWhen(tags.when);
  const cityNames = stops.map((s) => s.city).filter(Boolean);
  const places: AerialPlace[] = route;
  const terrain = terrainFor(
    [trip.title, ...route.map((s) => s.city), trip.country],
    route,
    registry,
  );
  const where =
    routeLine(cityNames) || trip.city?.split(",")[0] || cityNames[0] || trip.country || "";

  return (
    <section data-guide="home-trip" className="hn-hero -mx-4" style={{ height: UPCOMING_H }}>
      {route.length > 0 ? (
        <AerialBanner
          places={places}
          label={`Map of the trip: ${route.map((s) => s.city).join(", ")}`}
          height={UPCOMING_H}
          top={190}
          bottom={UPCOMING_H - 70}
          terrain={terrain?.art ?? null}
          scene={sceneFor(trip, cityNames)}
          showLabels={false}
          spread={[0.14, 0.7]}
          footInset={56}
        >
          {(points, width) => {
            const widths = route.map((s) => Math.min(184, 88 + pillLabel(s.city).length * 8.8));
            const boxes = calloutBoxes(
              points,
              widths,
              { width, top: 0, bottom: UPCOMING_H - 56 },
              {
                height: BUBBLE_H,
                gap: 8,
                dot: 10,
                // The title and the open button stay clear.
                keepClear: [
                  { x: 0, y: 0, width: Math.min(270, width * 0.7), height: 150 },
                  { x: width - 96, y: 0, width: 96, height: 104 },
                ],
              },
            );
            return (
              <>
                {/* A bubble moved off its town keeps a thread to it. */}
                <svg
                  aria-hidden
                  viewBox={`0 0 ${width} ${UPCOMING_H}`}
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 z-[1] size-full"
                >
                  {boxes.map((box, i) => {
                    const at = points[i];
                    if (!box || !at) return null;
                    const x = Math.max(box.x + 20, Math.min(box.x + box.width - 20, at.x));
                    const y = Math.max(box.y + 6, Math.min(box.y + box.height - 6, at.y));
                    if (Math.hypot(x - at.x, y - at.y) < 22) return null;
                    return <line key={i} x1={at.x} y1={at.y} x2={x} y2={y} className="hn-thread" />;
                  })}
                </svg>
                {route.map((stop, i) => {
                  const box = boxes[i];
                  if (!box) return null;
                  return (
                    <CityBubble
                      key={`${stop.city}-${i}`}
                      trip={trip}
                      city={stop.city}
                      country={stop.country}
                      days={stayLabel(stop.days)}
                      style={{
                        left: `${(box.x / width) * 100}%`,
                        top: box.y,
                        width: box.width,
                        height: BUBBLE_H,
                      }}
                    />
                  );
                })}
              </>
            );
          }}
        </AerialBanner>
      ) : (
        <>
          <TripPicture trip={trip} photos={photos} cities={cityNames} />
          {where ? (
            <span className="absolute inset-x-5 bottom-16 z-[1] truncate text-[16px] font-semibold text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">
              {where}
            </span>
          ) : null}
        </>
      )}
      <span aria-hidden className="hn-haze" style={{ "--haze-end": "150px" } as CSSProperties} />
      <BannerWords
        trip={trip}
        kicker={tags.label}
        title={
          <>
            <span className="line-clamp-2 break-words">{trip.title}</span>
            {when ? <span className="block">{when}</span> : null}
          </>
        }
      />
    </section>
  );
}

const BUBBLE_H = 50;

/** A city on the upcoming map: its photo (or Béa's painting) in a ring, and how long you stay. */
function CityBubble({
  trip,
  city,
  country,
  days,
  style,
}: {
  trip: TripRow;
  city: string;
  country: string | null;
  days: string;
  style: CSSProperties;
}) {
  const town = useTownPicture(false, city, country);
  // Too small for a photo's author and licence: only photos credited once for all, else the painting.
  const photo = town.photo && !creditedOnPhoto(town.photo) ? town.photo : null;
  const art = bannerArtUrl(bannerSceneFor([city, country], city));
  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      aria-label={days ? `${city}, ${days}` : city}
      className="hn-bubble absolute z-[1]"
      style={style}
    >
      <img
        src={photo?.url ?? art}
        alt=""
        decoding="async"
        referrerPolicy={photo ? "no-referrer" : undefined}
        onError={photo ? town.onError : undefined}
        className="size-[42px] shrink-0 rounded-full object-cover"
      />
      <span className="min-w-0 leading-tight">
        <b className="block truncate text-[15px] font-bold">{pillLabel(city)}</b>
        {days ? (
          <span className="block truncate text-[13px] text-muted-foreground">{days}</span>
        ) : null}
      </span>
    </Link>
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
  return (
    <section
      data-guide="home-next"
      aria-label="This trip at a glance"
      className={`hn-stats relative z-[3] ${overlap ? "-mt-12" : ""} grid grid-cols-3 gap-2`}
    >
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={{ prep: "todo" }}
        className="hn-chip hn-chip-1"
      >
        <span className="hn-chip-icon">
          <Check className="size-4" aria-hidden />
        </span>
        <Stat big={String(open)} small={open === 1 ? "to-do" : "to-dos"} />
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={flight ? {} : { view: "bookings" }}
        className="hn-chip hn-chip-2"
      >
        <span className="hn-chip-icon">
          <Plane className="size-4" aria-hidden />
        </span>
        {flight ? (
          <Stat
            big={parts?.code ?? flight.title}
            small={[parts?.route, shortDay(flight.day_date)].filter(Boolean).join(" · ")}
          />
        ) : (
          <Stat big="Flight" small="Not added yet" />
        )}
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={{ prep: "packing" }}
        className="hn-chip hn-chip-4"
      >
        <span className="hn-chip-icon">
          <Luggage className="size-4" aria-hidden />
        </span>
        <span className="w-full min-w-0">
          <Stat big={packed} small={packing ? "packed" : "Packing list"} />
          <span
            aria-hidden
            className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-[var(--stat-track)]"
          >
            <span
              className="block h-full rounded-full bg-[image:var(--stat-fill)]"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>
      </Link>
    </section>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[16px] font-bold leading-tight">{big}</span>
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
    <section data-guide="home-trip">
      <div className="hn-hero -mx-4" style={{ height: ON_TRIP_H }}>
        {route.length > 0 ? (
          <AerialBanner
            places={route}
            label={`Map of the trip: ${route.map((s) => s.city).join(", ")}`}
            height={ON_TRIP_H}
            current={current}
            done={behind}
            top={190}
            bottom={ON_TRIP_H - 80}
            footInset={66}
            terrain={terrain?.art ?? null}
            scene={sceneFor(trip, cityNames)}
          />
        ) : (
          <TripPicture trip={trip} photos={photos} cities={cityNames} />
        )}
        <span aria-hidden className="hn-haze" style={{ "--haze-end": "140px" } as CSSProperties} />
        <BannerWords trip={trip} kicker={kicker} title={withStop(trip.title)} />
        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          viewTransition
          aria-label={`Today on ${trip.title}`}
          className="hn-glass-btn absolute bottom-[58px] right-4 z-[2]"
        >
          <Navigation className="size-5" aria-hidden />
        </Link>
      </div>
      <div className="hn-panel -mx-4 space-y-3 px-4 pt-4">
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
 * Home with no trip (mockup "No trip"): "Where to next?" over the terrain of
 * the cities the traveller has saved places in, seen from above, a heart tag
 * at each opening Recs. Only cities the map can place are drawn.
 */
export function HomeNextNoTrip({
  greeting,
  date,
  cities,
}: {
  greeting: string;
  date: string;
  cities: SavedCity[];
}) {
  const placed = useMemo(
    () =>
      cities
        .filter(
          (c): c is SavedCity & { lat: number; lon: number } => c.lat !== null && c.lon !== null,
        )
        .slice(0, 6),
    [cities],
  );
  const places = useMemo(
    () => placed.map((c) => ({ city: c.city, lat: c.lat, lon: c.lon })),
    [placed],
  );
  return (
    <section data-guide="home-trip" className="hn-hero -mx-4" style={{ height: NO_TRIP_H }}>
      <AerialBanner
        places={places}
        label={`Map of your saved cities: ${placed.map((c) => c.city).join(", ")}`}
        height={NO_TRIP_H}
        top={170}
        bottom={NO_TRIP_H - 40}
        mode="pins"
        spread={[0.1, 0.62]}
      >
        {(pins, width) => {
          const widths = placed.map((c) => Math.min(200, 70 + c.city.length * 9.5));
          const boxes = calloutBoxes(
            pins,
            widths,
            { width, top: 0, bottom: NO_TRIP_H - 20 },
            {
              height: 44,
              keepClear: [{ x: 0, y: 0, width: Math.min(280, width * 0.72), height: 150 }],
            },
          );
          return placed.map((c, i) => {
            const box = boxes[i];
            if (!box) return null;
            return (
              <Link
                key={`${c.city}-${c.country}`}
                to="/recommendations"
                aria-label={`${c.city}: ${c.count} saved ${c.count === 1 ? "place" : "places"}`}
                className="hn-tag absolute z-[1]"
                style={{
                  left: `${(box.x / width) * 100}%`,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                }}
              >
                <Heart className="size-4 shrink-0 text-[var(--acc)]" weight="fill" aria-hidden />
                <span className="min-w-0 truncate">{c.city}</span>
                <span className="ms-auto shrink-0 text-[13px] font-medium text-muted-foreground">
                  {c.count}
                </span>
              </Link>
            );
          });
        }}
      </AerialBanner>
      <span aria-hidden className="hn-haze" style={{ "--haze-end": "140px" } as CSSProperties} />
      <div className="relative z-[2] px-5 pt-3">
        <p className="hn-kicker">{greeting}</p>
        <h2 className="hn-title mt-1.5">Where to next?</h2>
        <p className="mt-1.5 text-[15px] font-medium text-foreground/80">{date}</p>
      </div>
    </section>
  );
}
