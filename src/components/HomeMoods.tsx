import { useMemo, type CSSProperties } from "react";
import { useThemeName } from "@/hooks/useThemeName";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Heart, MapPin } from "@/components/icons";
import { StopArt } from "@/components/day/stop-bits";
import { HomeTripBanner } from "@/components/HomeTripBanner";
import { TownPhotoCredit } from "@/components/TownPhotoCredit";
import type { TripGlance } from "@/hooks/useTripGlances";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import { useTownPicture } from "@/hooks/useTownPicture";
import { useTripStops } from "@/hooks/useTripStops";
import type { TripRow } from "@/hooks/useTrips";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { savedSummary, todaysCompanion, untilLabel, type SavedCity } from "@/lib/home-now";
import { timeForRail } from "@/lib/timeline-kind";
import { toLocalISODate } from "@/lib/trip-dates";
import { heroTags } from "@/lib/trip-glance";

const SOFT_SHADOW = "";
const SAVED_HERO_H = 250;
const TAG_H = 44;

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
 * Home while a trip is under way: the trip as the short strip the trip page
 * opens with, then the current stop and the next one as two cards. Where you
 * are comes from the taps on the Companion ("I'm here", "Leaving"), never
 * from the clock.
 */
export function HomeOnTrip({
  trip,
  photos,
  glance,
  showStops = true,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  /** The "Current / Next stop" module (Customize home). */
  showStops?: boolean;
}) {
  const { stops } = useTripStops(trip.id, null);
  const cityNames = useMemo(() => stops.map((s) => s.city).filter(Boolean), [stops]);
  const tags = heroTags(trip.start_date, trip.end_date, trip.dates_status === "tentative");

  return (
    <section>
      <HomeTripBanner trip={trip} photos={photos} cities={cityNames} />
      <div className="trip-panel -mx-4 space-y-3 px-4 pt-4">
        {showStops && <NowCards trip={trip} glance={glance} day={tags.when} />}
      </div>
    </section>
  );
}

export function NowCards({
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
        className={`block rounded-[var(--r-card)] bg-card p-4 ${SOFT_SHADOW}`}
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
    <>
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
    </>
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
      className={`block rounded-[var(--r-card)] bg-card p-4 ${SOFT_SHADOW}`}
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
      <p className="mt-1.5 flex items-center gap-2 text-[17px] font-semibold leading-snug">
        <span
          aria-hidden
          className={`size-2.5 shrink-0 rounded-full ${live ? "bg-[var(--acc)]" : "bg-[var(--acc-done)]"}`}
        />
        <span className="min-w-0 break-words">{stop.title}</span>
      </p>
      <div className="mt-3 flex items-center gap-3">
        <StopArt item={stop} className="size-[84px] rounded-[var(--r-card)]" />
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

/**
 * Home with no trip (mockup, "No trip"): "Where to next?" over the terrain of
 * the cities the traveller has saved places in, a heart at each. Only cities
 * the map can place are drawn.
 */
export function HomeNoTripHero({
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
  const theme = useThemeName();
  return (
    <section data-guide="home-trip" className="trip-hero -mx-4" style={{ height: SAVED_HERO_H }}>
      <img
        src={`/art/coast-${theme}.webp`}
        alt=""
        decoding="async"
        className="art-dim absolute inset-0 size-full object-cover"
      />
      <span
        aria-hidden
        className="trip-hero-haze"
        style={{ "--haze-end": "130px" } as CSSProperties}
      />
      <div className="relative px-5 pt-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-foreground/75">
          {greeting}
        </p>
        <h2 className="mt-1 font-display text-[38px] leading-[1] tracking-[-0.02em]">
          Where to next?
        </h2>
        <p className="mt-1.5 text-[14px] font-medium text-foreground/80">{date}</p>
      </div>
      {placed.length > 0 ? (
        <ul className="no-scrollbar absolute inset-x-0 bottom-3 flex gap-2 overflow-x-auto px-4">
          {placed.map((c) => (
            <li key={`${c.city}-${c.country}`} className="shrink-0">
              <Link
                to="/recommendations"
                aria-label={`${c.city}: ${c.count} saved ${c.count === 1 ? "place" : "places"}`}
                className="trips-tag flex h-11 items-center gap-1.5 px-3 text-[15px] font-semibold"
              >
                <Heart className="size-4 shrink-0 text-[var(--acc)]" aria-hidden />
                <span className="truncate">{c.city}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** "16 saved places in 3 cities are waiting for a trip." with the way into planning one. */
export function HomeSavedCard({ cities }: { cities: SavedCity[] }) {
  if (cities.length === 0) return null;
  const { strong, rest } = savedSummary(cities);
  return (
    <section
      className={`flex items-center justify-between gap-3 rounded-[var(--r-card)] bg-card p-4 ${SOFT_SHADOW}`}
    >
      <p className="min-w-0 text-[16px] leading-snug">
        <strong className="font-bold">{strong}</strong>
        {rest}
      </p>
      <Link
        to="/trips/plan"
        className="btn-primary flex shrink-0 items-center justify-center px-5 text-[15px]"
      >
        Plan a trip
      </Link>
    </section>
  );
}

/** The cities with the most saved, three to a row: a photo of each and how many are waiting. */
export function HomeWaiting({ cities }: { cities: SavedCity[] }) {
  const top = cities.slice(0, 3);
  if (top.length === 0) return null;
  return (
    <section data-guide="home-waiting">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-[22px] leading-none">Waiting for a trip</h2>
        <Link
          to="/recommendations"
          className="-me-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 px-2 text-[14px] font-medium"
        >
          See all
          <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {top.map((city) => (
          <CityTile key={`${city.city}-${city.country}`} city={city} />
        ))}
      </div>
    </section>
  );
}

function CityTile({ city }: { city: SavedCity }) {
  const town = useTownPicture(false, city.city, city.country);
  const art = bannerArtUrl(bannerSceneFor([city.city, city.country], city.city));
  return (
    <Link
      to="/recommendations"
      className="group relative aspect-[3/4] overflow-hidden rounded-[var(--r-card)] bg-muted"
    >
      <img
        src={town.photo?.url ?? art}
        alt=""
        decoding="async"
        referrerPolicy={town.photo ? "no-referrer" : undefined}
        onError={town.onError}
        className="art-dim absolute inset-0 size-full object-cover transition-transform duration-(--t-move) motion-safe:group-hover:scale-[1.03]"
      />
      {town.photo ? <TownPhotoCredit photo={town.photo} /> : null}
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_35%,rgb(0_0_0/0.65))]"
      />
      <span className="absolute inset-x-2.5 bottom-2.5 text-white">
        <span className="block truncate font-display text-[19px] leading-tight">{city.city}</span>
        <span className="flex items-center gap-1 text-[13px] leading-tight">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {city.count} {city.count === 1 ? "place" : "places"}
        </span>
      </span>
    </Link>
  );
}
