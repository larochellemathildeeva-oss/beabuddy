import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bed,
  ChevronRight,
  ImageIcon,
  ListChecks,
  Luggage,
  MapIcon,
  MapPin,
  MoreHorizontal,
  Plane,
  Users,
} from "@/components/icons";
import { TripBannerMap, TripsWorldMap } from "@/components/TripRouteMap";
import { TownPhotoCredit } from "@/components/TownPhotoCredit";
import { supabase } from "@/integrations/supabase/client";
import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { useTownPicture } from "@/hooks/useTownPicture";
import { useTripStops } from "@/hooks/useTripStops";
import { useCityPositions } from "@/hooks/useCityPositions";
import type { TripRow } from "@/hooks/useTrips";
import type { TripGlance } from "@/hooks/useTripGlances";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { knownCityPosition } from "@/lib/city-locate";
import {
  cityKey,
  hasPosition,
  tripCityStop,
  withCityPositions,
  type CityStop,
  type Position,
} from "@/lib/city-position";
import { currentLeg, isPastTrip } from "@/lib/home-trip";
import { routeStops, type RouteStop } from "@/lib/home-route-map";
import { liveSummary } from "@/lib/companion";
import { pickTripPhoto, tripDateLine } from "@/lib/trip-card";
import { routeLine } from "@/lib/trip-glance";
import { beaTripNote } from "@/lib/trip-note";
import { timeForRail } from "@/lib/timeline-kind";
import { toLocalISODate } from "@/lib/trip-dates";
import type { TripPicture } from "@/lib/trip-picture";
import {
  groupByPlace,
  placeTags,
  tripCountdown,
  tripMonth,
  tripRowTag,
  type RowTag,
  type TripsLayout,
} from "@/lib/trips-page";

const short = (city: string) => (city.split(",")[0] ?? "").trim();

/** "Sep 7": the day a flight leaves, when it has one. */
function dayLabel(day: string | null | undefined): string {
  if (!day) return "";
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** The trip's own description, first line only, or Béa's line about it. */
function quoteFor(trip: TripRow, stopCount: number, planned: number | null): string {
  const own = (trip.notes ?? "").split("\n")[0]?.trim();
  if (own) return own.length > 140 ? `${own.slice(0, 139)}…` : own;
  return (
    beaTripNote(
      { startDate: trip.start_date, endDate: trip.end_date, stopCount, plannedCount: planned },
      toLocalISODate(new Date()),
    ) ?? ""
  );
}

/** Positions this phone already knows for a city: no lookup. */
function knownPositions(stops: readonly CityStop[]): ReadonlyMap<string, Position> {
  const found = new Map<string, Position>();
  for (const stop of stops) {
    if (hasPosition(stop) || !stop.city.trim()) continue;
    const key = cityKey(stop.city, stop.country);
    const at = knownCityPosition(key);
    if (at) found.set(key, at);
  }
  return found;
}

/**
 * A trip's cities and their route. `lookUp` finds the cities typed rather
 * than picked by name (one lookup each, kept on the phone), as Home does for
 * its one trip; rows only draw what is already known, so a long list never
 * asks the map for every trip at once.
 */
function useTripRoute(trip: TripRow, lookUp: boolean) {
  const { stops, loading } = useTripStops(trip.id, null);
  const cityStops = useMemo(
    (): readonly CityStop[] => (stops.length || loading ? stops : tripCityStop(trip)),
    [stops, loading, trip],
  );
  const looked = useCityPositions(lookUp ? cityStops : []);
  const route = useMemo(() => {
    const known = new Map([...knownPositions(cityStops), ...looked]);
    return routeStops(withCityPositions(cityStops, known));
  }, [cityStops, looked]);
  return { stops, route };
}

/** The trip's picture: its route on terrain (Stops), else its photo. */
function TripPictureFill({
  trip,
  photos,
  cityNames,
  route,
  picture,
  height,
  top,
  bottom,
  compact = false,
  current = -1,
  done = 0,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  cityNames: string[];
  route: RouteStop[];
  picture: TripPicture;
  height: number;
  top: number;
  bottom: number;
  compact?: boolean;
  current?: number;
  done?: number;
}) {
  const showStops = picture === "stops" && route.length > 0;
  const photo = pickTripPhoto(photos, {
    city: trip.city,
    country: trip.country,
    cities: cityNames,
  });
  const photoUrl = useSignedPhoto(showStops ? null : (photo?.storage_path ?? null));
  const town = useTownPicture(showStops || !!photo, trip.city || cityNames[0], trip.country);
  const art = bannerArtUrl(
    bannerSceneFor(
      [trip.title, ...cityNames, trip.city, trip.country],
      trip.title || trip.city || "",
    ),
  );
  if (showStops) {
    return (
      <TripBannerMap
        stops={route}
        label={`Map of the trip: ${route.map((s) => s.city).join(", ")}`}
        height={height}
        top={top}
        bottom={bottom}
        current={current}
        done={done}
        compact={compact}
      />
    );
  }
  return (
    <>
      <img
        src={photoUrl ?? town.photo?.url ?? art}
        alt=""
        decoding="async"
        referrerPolicy={town.photo ? "no-referrer" : undefined}
        onError={town.onError}
        className="art-dim absolute inset-0 size-full object-cover"
      />
      {town.photo ? <TownPhotoCredit photo={town.photo} /> : null}
    </>
  );
}

/** Which city of the trip you are in today, and how many are behind you. */
function whereToday(stops: readonly CityStop[], route: RouteStop[], today: string) {
  let current = -1;
  let done = 0;
  route.forEach((city, i) => {
    const stop = stops.find((s) => short(s.city) === short(city.city));
    if (!stop) return;
    const arrive = stop.arrive_on ?? "";
    const depart = stop.depart_on ?? arrive;
    if (depart && depart < today) done = i + 1;
    else if (arrive && arrive <= today && today <= depart && current === -1) current = i;
  });
  return { current, done };
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

const HERO_H = 300;
const TAG_H = 50;

/** The first placed city of each trip, read in one go for the header. */
function useHeroPlaces(trips: TripRow[]) {
  const ids = trips.map((t) => t.id).join(",");
  const [firstStops, setFirstStops] = useState<Record<string, CityStop>>({});
  useEffect(() => {
    if (!ids) return;
    let live = true;
    void supabase
      .from("trip_stops")
      .select("trip_id, city, country, lat, lon, position")
      .in("trip_id", ids.split(","))
      .order("position", { ascending: true })
      .then(({ data, error }) => {
        if (!live || error) return;
        const first: Record<string, CityStop> = {};
        for (const row of (data ?? []) as (CityStop & { trip_id: string })[]) {
          if (!ids.split(",").includes(row.trip_id)) continue;
          if (!first[row.trip_id] || (!hasPosition(first[row.trip_id]!) && hasPosition(row)))
            first[row.trip_id] = row;
        }
        setFirstStops(first);
      });
    return () => {
      live = false;
    };
  }, [ids]);
  // A trip with no placed city is found by its own city's name.
  const asked = useMemo(
    () =>
      trips.flatMap((t) => {
        const stop = firstStops[t.id];
        return stop && hasPosition(stop) ? [] : tripCityStop(t);
      }),
    [trips, firstStops],
  );
  const found = useCityPositions(asked);
  return useMemo(
    () =>
      trips.flatMap((trip) => {
        const stop = firstStops[trip.id];
        if (stop && hasPosition(stop))
          return [{ trip, city: short(stop.city), lat: stop.lat!, lon: stop.lon! }];
        const own = tripCityStop(trip)[0];
        if (!own) return [];
        const at =
          found.get(cityKey(own.city, own.country)) ??
          knownCityPosition(cityKey(own.city, own.country));
        return at ? [{ trip, city: own.city, lat: at.lat, lon: at.lon }] : [];
      }),
    [trips, firstStops, found],
  );
}

/**
 * The top of Trips (mockup `renderTrips`): "Your trips." over the terrain of
 * the places the traveller is going and has been, a tag at each naming the
 * place and the month, each opening its trip. The calendar and New trip sit
 * at the top right. Without a placed trip the title stands on the page alone.
 */
export function TripsHero({
  trips,
  today,
  actions,
}: {
  trips: TripRow[];
  today: string;
  actions: ReactNode;
}) {
  const places = useHeroPlaces(trips);
  // Trips to one place share a tag, so none sits on top of another.
  const groups = useMemo(() => groupByPlace(places), [places]);
  const points = useMemo(
    () => groups.map(([first]) => ({ lat: first!.lat, lon: first!.lon })),
    [groups],
  );
  const hasMap = places.length > 0;
  return (
    <section
      data-guide="trips-header"
      className={`trip-hero -mx-4 -mt-3 ${hasMap ? "" : "!bg-transparent"}`}
      style={{ height: hasMap ? HERO_H : 150 }}
    >
      {hasMap ? (
        <TripsWorldMap points={points} height={HERO_H} top={118} bottom={HERO_H - 34}>
          {(pins, width) => {
            const label = (group: (typeof places)[number][]) => {
              const first = group[0]!;
              const live = isPastTrip(first.trip, today)
                ? false
                : !!(first.trip.start_date && first.trip.start_date <= today);
              const second =
                group.length > 1
                  ? `${group.length} trips`
                  : live
                    ? "Now"
                    : tripMonth(first.trip.start_date, first.trip.end_date);
              return { first, live, second };
            };
            const widths = groups.map((group) => {
              const { first, second } = label(group);
              return Math.min(200, 48 + Math.max(first.city.length * 9.2, second.length * 8));
            });
            const boxes = placeTags(pins, widths, { width, top: 104, bottom: HERO_H - 30 }, TAG_H);
            return groups.map((group, i) => {
              const box = boxes[i];
              if (!box) return null;
              const { first, live, second } = label(group);
              return (
                <Link
                  key={first.trip.id}
                  to="/trips/$tripId"
                  params={{ tripId: first.trip.id }}
                  viewTransition
                  aria-label={
                    group.length > 1
                      ? `Open ${first.trip.title}, one of ${group.length} trips to ${first.city}`
                      : `Open ${first.trip.title}`
                  }
                  className="trips-tag absolute"
                  style={{
                    left: `${(box.x / width) * 100}%`,
                    top: box.y,
                    width: box.width,
                    height: box.height,
                  }}
                >
                  <MapPin
                    className={`size-4 shrink-0 ${live ? "text-primary" : "text-warning"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[14px] font-semibold">{first.city}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {second}
                    </span>
                  </span>
                </Link>
              );
            });
          }}
        </TripsWorldMap>
      ) : null}
      {hasMap ? (
        <span
          aria-hidden
          className="trip-hero-haze"
          style={{ ["--haze-end" as string]: "104px" }}
        />
      ) : null}
      <div className="relative flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-foreground/75">
            Trip folders
          </p>
          <h1 className="mt-1 font-display text-[44px] leading-[1] tracking-[-0.02em]">
            Your trips.
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section heads and the two device switches                           */
/* ------------------------------------------------------------------ */

export function TripsSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rise">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="font-display text-[26px] leading-none">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Big banner or List, for the trips ahead. */
export function LayoutSwitch({
  layout,
  onLayout,
}: {
  layout: TripsLayout;
  onLayout: (next: TripsLayout) => void;
}) {
  return (
    <div role="group" aria-label="Trips layout" className="trips-switch">
      <button
        type="button"
        aria-pressed={layout === "big"}
        aria-label="Big banner for the next trip"
        title="Big banner for the next trip"
        onClick={() => onLayout("big")}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="11" rx="2.5" />
          <path d="M3 19h18" />
        </svg>
      </button>
      <button
        type="button"
        aria-pressed={layout === "list"}
        aria-label="List"
        title="Every trip as a row"
        onClick={() => onLayout("list")}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <rect x="3" y="4" width="6" height="6" rx="1.5" />
          <rect x="3" y="14" width="6" height="6" rx="1.5" />
          <path d="M12 7h9M12 17h9" />
        </svg>
      </button>
    </div>
  );
}

/** Stops or Photo, for every trip picture (the same setting as the trip page). */
export function PictureSwitch({
  picture,
  onPicture,
}: {
  picture: TripPicture;
  onPicture: (next: TripPicture) => void;
}) {
  return (
    <div role="group" aria-label="Trip pictures" className="trips-switch">
      <button
        type="button"
        aria-pressed={picture === "stops"}
        onClick={() => onPicture("stops")}
        title="Show each trip's stops on a map"
      >
        <MapIcon className="size-4" aria-hidden />
        Stops
      </button>
      <button
        type="button"
        aria-pressed={picture === "photo"}
        onClick={() => onPicture("photo")}
        title="Show a photo of each place"
      >
        <ImageIcon className="size-4" aria-hidden />
        Photo
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The next trip, as a big banner                                      */
/* ------------------------------------------------------------------ */

function Chip({
  icon: Icon,
  value,
  label,
  tone,
  to,
}: {
  icon: ComponentType<{ className?: string }>;
  value: string;
  label: string;
  tone: 1 | 2 | 4;
  to: { tripId: string; prep?: "todo" | "packing" };
}) {
  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: to.tripId }}
      search={to.prep ? { prep: to.prep } : {}}
      className={`tile-fill-${tone} flex min-h-[56px] min-w-0 flex-1 items-center gap-1.5 rounded-2xl border border-border/60 px-2 py-2`}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-card text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[14px] font-bold">{value}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{label}</span>
      </span>
    </Link>
  );
}

/**
 * The next trip (mockup `nextUpHTML`): its picture with how many are going or
 * the live stop, a glass panel with its name, places and the countdown, then
 * its cities in order with their dates, the flight, to-dos and packing (each
 * opening its part of the trip), and Béa's line with "View itinerary".
 */
export function TripFeature({
  trip,
  photos,
  glance,
  peopleCount,
  picture,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  peopleCount: number;
  picture: TripPicture;
}) {
  const { stops, route } = useTripRoute(trip, true);
  const cityNames = stops.map((s) => s.city);
  const today = toLocalISODate(new Date());
  const leg = glance ? currentLeg(stops, glance.items, today) : null;
  const live = glance ? liveSummary(glance.items, today) : null;
  const started = !!(trip.start_date && trip.start_date <= today);
  const flight = leg ? leg.flight : glance?.flight;
  const lodging = (leg ? leg.lodging : glance?.lodging) ?? glance?.booked.lodging ?? null;
  const bookedFlight = flight ? null : (glance?.booked.flight ?? null);
  const packing = glance?.packing;
  const openTodos = glance?.todos.open ?? 0;
  const count = tripCountdown(trip.start_date, trip.end_date);
  const quote = quoteFor(trip, stops.length, glance ? glance.items.length : null);
  const { current, done } = whereToday(stops, route, today);

  const names = [...new Set(cityNames.map(short).filter(Boolean))];
  const places =
    names.length > 1
      ? names.slice(0, 3).join(" · ")
      : routeLine(cityNames) || short(trip.city ?? "") || trip.country || "";
  // The ribbon: each city once, in order, with the day you get there.
  const ribbon = useMemo(() => {
    const seen = new Set<string>();
    return stops.filter((s) => {
      const k = short(s.city).toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [stops]);

  const flightValue = flight
    ? dayLabel(flight.day_date) || timeForRail(flight.time_label) || "Saved"
    : bookedFlight
      ? "Booked"
      : started
        ? "—"
        : "None yet";
  const stayFirst = started && lodging;

  return (
    <article className="trips-feature overflow-hidden">
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        aria-label={`Open ${trip.title}`}
        className="relative block h-[300px] overflow-hidden bg-muted"
        style={{ viewTransitionName: `trip-photo-${trip.id}` }}
      >
        <TripPictureFill
          trip={trip}
          photos={photos}
          cityNames={cityNames}
          route={route}
          picture={picture}
          height={300}
          top={70}
          bottom={190}
          current={current}
          done={done}
        />
        {live ? (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[13px] font-bold text-primary-foreground">
            <span className="size-2 rounded-full bg-primary-foreground" aria-hidden />
            Live · Stop {live.step} of {live.total}
          </span>
        ) : peopleCount > 1 ? (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-card/92 px-3 py-1.5 text-[13px] font-semibold text-foreground shadow-sm">
            <Users className="size-4" aria-hidden />
            {peopleCount} travellers
          </span>
        ) : null}
        <span className="trips-glass absolute inset-x-3 bottom-3 flex items-center gap-3 p-3">
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 break-words font-display text-[24px] leading-[1.1]">
              {trip.title}
            </span>
            <span className="mt-0.5 block truncate text-[14px] text-muted-foreground">
              {[places, tripDateLine(trip.start_date, trip.end_date)].filter(Boolean).join(" · ")}
              {trip.dates_status === "tentative" ? " · tentative" : ""}
            </span>
          </span>
          {count ? (
            <span
              aria-label={count.label}
              className="grid size-[60px] shrink-0 place-items-center rounded-full bg-primary text-center text-primary-foreground"
            >
              <span className="leading-none">
                <span
                  className={`block font-display ${count.unit ? "text-[24px]" : "text-[17px]"}`}
                >
                  {count.value}
                </span>
                {count.unit ? (
                  <span className="block text-[13px] font-semibold">{count.unit}</span>
                ) : null}
              </span>
            </span>
          ) : null}
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-elevated"
          >
            <ChevronRight className="size-5" />
          </span>
        </span>
      </Link>

      {ribbon.length > 1 ? (
        <ol className="trips-ribbon" aria-label="Cities on this trip">
          {ribbon.slice(0, 4).map((stop, i) => {
            const state = i < done ? "done" : i === current ? "here" : "";
            return (
              <li key={stop.id ?? i} data-state={state || undefined}>
                <i aria-hidden />
                <b className="block truncate text-[14px] font-semibold">{short(stop.city)}</b>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {state === "here" ? "You are here" : dayLabel(stop.arrive_on) || " "}
                </span>
              </li>
            );
          })}
        </ol>
      ) : leg ? (
        <p className="px-4 pt-3 text-[13px] font-bold uppercase tracking-[0.08em] text-foreground/80">
          {leg.label} · <span className="normal-case tracking-normal">{short(leg.city)}</span>
        </p>
      ) : null}

      <div className="flex gap-2 px-3 pt-3">
        {stayFirst ? (
          <Chip
            icon={Bed}
            value={short(lodging.title)}
            label="Stay"
            tone={2}
            to={{ tripId: trip.id }}
          />
        ) : (
          <Chip
            icon={Plane}
            value={flightValue}
            label={started ? "Next flight" : "Flight"}
            tone={2}
            to={{ tripId: trip.id }}
          />
        )}
        <Chip
          icon={ListChecks}
          value={openTodos ? `${openTodos} left` : "All done"}
          label="To-dos"
          tone={1}
          to={{ tripId: trip.id, prep: "todo" }}
        />
        <Chip
          icon={Luggage}
          value={packing ? `${packing.packed}/${packing.total}` : "—"}
          label="Packed"
          tone={4}
          to={{ tripId: trip.id, prep: "packing" }}
        />
      </div>
      {!stayFirst && lodging ? (
        <p className="flex items-center gap-1.5 px-4 pt-2.5 text-[14px] text-muted-foreground">
          <Bed className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{lodging.title}</span>
        </p>
      ) : null}

      <div className="mt-3 flex items-end gap-3 border-t border-border px-4 py-3">
        {quote ? (
          <p className="min-w-0 flex-1 font-display text-[17px] italic leading-snug text-muted-foreground">
            “{quote}”
          </p>
        ) : (
          <span className="flex-1" />
        )}
        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          viewTransition
          className="flex min-h-11 shrink-0 items-center gap-1 text-[15px] font-semibold text-foreground underline-offset-4 hover:underline"
        >
          View itinerary
          <ArrowRight className="size-4 text-primary" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* A trip as a row                                                     */
/* ------------------------------------------------------------------ */

function Tag({ tag }: { tag: RowTag }) {
  return (
    <span className={`trips-row-tag`} data-tone={tag.tone}>
      {tag.tone === "live" ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {tag.text}
    </span>
  );
}

/** The ⋯ menu on a row: the trip's parts one tap away. */
function RowMenu({ trip }: { trip: TripRow }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const item =
    "flex min-h-11 items-center rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-accent";
  return (
    <div ref={ref} className="absolute right-1.5 top-1.5 z-10">
      <button
        type="button"
        aria-label={`More for ${trip.title}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className="grid size-11 place-items-center rounded-full text-muted-foreground"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-1 top-11 w-52 rounded-2xl border border-border bg-card p-1.5 shadow-lg"
        >
          <Link
            role="menuitem"
            to="/trips/$tripId"
            params={{ tripId: trip.id }}
            viewTransition
            className={item}
          >
            Open trip
          </Link>
          <Link
            role="menuitem"
            to="/trips/$tripId"
            params={{ tripId: trip.id }}
            search={{ prep: "todo" }}
            className={item}
          >
            To-dos
          </Link>
          <Link
            role="menuitem"
            to="/trips/$tripId"
            params={{ tripId: trip.id }}
            search={{ prep: "packing" }}
            className={item}
          >
            Packing
          </Link>
          <Link
            role="menuitem"
            to="/trips/$tripId"
            params={{ tripId: trip.id }}
            search={{ view: "bookings" }}
            className={item}
          >
            Bookings
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A trip as a row (mockup `t4Row`): its little map or photo, the name, the
 * dates and places, who is going, and a tag for how soon (or live, or draft).
 * The whole row opens the trip; ⋯ opens its parts.
 */
export function TripListRow({
  trip,
  photos,
  glance,
  peopleCount,
  picture,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  peopleCount: number;
  picture: TripPicture;
}) {
  const { stops, route } = useTripRoute(trip, false);
  const cityNames = stops.map((s) => s.city);
  const today = toLocalISODate(new Date());
  const live = glance ? liveSummary(glance.items, today) : null;
  const leg = glance ? currentLeg(stops, glance.items, today) : null;
  const tag: RowTag | null = live
    ? { text: `Live · Stop ${live.step} of ${live.total}`, tone: "live" }
    : isPastTrip(trip, today)
      ? null
      : tripRowTag(trip);
  const names = [...new Set(cityNames.map(short).filter(Boolean))];
  const places =
    names.length > 1
      ? names.slice(0, 3).join(" · ")
      : routeLine(cityNames) || short(trip.city ?? "") || trip.country || "";
  const dates =
    trip.start_date || trip.end_date
      ? tripDateLine(trip.start_date, trip.end_date)
      : "No dates yet";

  return (
    <div className="trips-row relative flex min-h-[116px] overflow-hidden">
      <div className="relative w-[34%] max-w-[150px] shrink-0 overflow-hidden bg-muted">
        <TripPictureFill
          trip={trip}
          photos={photos}
          cityNames={cityNames}
          route={route}
          picture={picture}
          height={116}
          top={22}
          bottom={98}
          compact
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-3 pl-3 pr-12">
        <p className="line-clamp-2 break-words font-display text-[20px] leading-tight">
          {trip.title}
        </p>
        <p className="truncate text-[14px] text-muted-foreground">
          {dates}
          {trip.dates_status === "tentative" && trip.start_date ? " · tentative" : ""}
        </p>
        {places ? <p className="truncate text-[13px] text-muted-foreground">{places}</p> : null}
        {leg && !live ? (
          <p className="truncate text-[13px] font-semibold text-foreground/80">
            {leg.label} · {short(leg.city)}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {peopleCount > 1 ? (
            <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
              <Users className="size-4" aria-hidden />
              {peopleCount} travellers
            </span>
          ) : null}
          {tag ? <Tag tag={tag} /> : null}
        </div>
      </div>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        aria-label={`Open ${trip.title}`}
        className="absolute inset-0"
        style={{ viewTransitionName: `trip-photo-${trip.id}` }}
      />
      <RowMenu trip={trip} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Past trips as three tiles                                           */
/* ------------------------------------------------------------------ */

function PastTile({
  trip,
  photos,
  picture,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  picture: TripPicture;
}) {
  const { stops, route } = useTripRoute(trip, false);
  const month = tripMonth(trip.start_date, trip.end_date);
  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      className="relative block h-[132px] overflow-hidden rounded-[var(--r-image)] bg-[#2a2026] text-white shadow-sm"
    >
      <TripPictureFill
        trip={trip}
        photos={photos}
        cityNames={stops.map((s) => s.city)}
        route={route}
        picture={picture}
        height={132}
        top={18}
        bottom={70}
        compact
        done={route.length}
      />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(to top, rgba(18,12,10,0.78), rgba(18,12,10,0) 62%)",
        }}
      />
      <span className="absolute inset-x-0 bottom-0 p-2">
        <span className="line-clamp-2 break-words font-display text-[17px] leading-[1.05]">
          {trip.title}
        </span>
        {month ? <span className="block text-[13px] text-white/90">{month}</span> : null}
      </span>
    </Link>
  );
}

export function PastTiles({
  trips,
  photos,
  picture,
}: {
  trips: TripRow[];
  photos: TripPhotoRow[];
  picture: TripPicture;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {trips.map((trip) => (
        <PastTile key={trip.id} trip={trip} photos={photos} picture={picture} />
      ))}
    </div>
  );
}
