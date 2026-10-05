import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bed,
  ChevronRight,
  ListChecks,
  Luggage,
  MapPin,
  MoreHorizontal,
  Plane,
  Users,
} from "@/components/icons";
import { TownPhotoCredit } from "@/components/TownPhotoCredit";
import { AerialBanner } from "@/components/next/AerialBanner";
import { supabase } from "@/integrations/supabase/client";
import { useAerialRoute } from "@/hooks/useAerialRoute";
import { useCityPositions } from "@/hooks/useCityPositions";
import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { useTownPicture } from "@/hooks/useTownPicture";
import type { TripGlance } from "@/hooks/useTripGlances";
import type { MemberRow, TripRow } from "@/hooks/useTrips";
import { calloutBoxes, trailPath } from "@/lib/aerial-route";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { knownCityPosition } from "@/lib/city-locate";
import { cityKey, hasPosition, tripCityStop, type CityStop } from "@/lib/city-position";
import { liveSummary } from "@/lib/companion";
import { currentLeg, isPastTrip } from "@/lib/home-trip";
import type { RouteStop } from "@/lib/home-route-map";
import { terrainFor, TERRAIN_ART, type TerrainRegistry } from "@/lib/terrain-art";
import { timeForRail } from "@/lib/timeline-kind";
import { pickTripPhoto, tripDateLine } from "@/lib/trip-card";
import { toLocalISODate } from "@/lib/trip-dates";
import { routeLine } from "@/lib/trip-glance";
import { beaTripNote } from "@/lib/trip-note";
import type { TripPicture } from "@/lib/trip-picture";
import { groupByPlace, tripCountdown, tripMonth, tripRowTag, type RowTag } from "@/lib/trips-page";

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

/**
 * The trip's picture: its route from above (Stops), else its photo — your
 * own, else the town's (with "Real photos"), else Béa's painting.
 */
function TripFill({
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
  registry,
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
  registry: TerrainRegistry;
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
    const terrain = terrainFor(
      [trip.title, ...route.map((s) => s.city), trip.country],
      route,
      registry,
    );
    return (
      <AerialBanner
        places={route}
        label={`Map of the trip: ${route.map((s) => s.city).join(", ")}`}
        height={height}
        top={top}
        bottom={bottom}
        current={current}
        done={done}
        compact={compact}
        showLabels={!compact}
        terrain={terrain?.art ?? null}
        scene={art}
        spread={compact ? [0.22, 0.78] : [0.16, 0.84]}
        footInset={height - bottom + 8}
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

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

const HERO_H = 340;
const TAG_H = 44;

/** The first placed city of each trip, read in one go for the header (as Trips does). */
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
 * The top of Trips (mockup `renderTrips`, the "Your trips." references):
 * "Your trips." over the trips' part of the world seen from above, a tag at
 * each place with its month ("Now" while on it) opening the trip, and the
 * dotted flight trail joining them in date order with its little plane. The
 * calendar and New trip sit at the top right. Without a placed trip the
 * title stands on the page alone.
 */
export function TripsNextHero({
  trips,
  today,
  actions,
}: {
  trips: TripRow[];
  today: string;
  actions: ReactNode;
}) {
  const places = useHeroPlaces(trips);
  const groups = useMemo(() => groupByPlace(places), [places]);
  const points = useMemo(
    () => groups.map(([first]) => ({ city: first!.city, lat: first!.lat, lon: first!.lon })),
    [groups],
  );
  // The trail flies from place to place in the order of the trips' dates.
  const order = useMemo(
    () =>
      groups
        .map((g, i) => ({ i, at: g[0]!.trip.start_date ?? "9999" }))
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((g) => g.i),
    [groups],
  );
  const hasMap = places.length > 0;
  return (
    <section
      data-guide="trips-header"
      className={`tn-hero -mx-4 -mt-3 ${hasMap ? "" : "!bg-transparent"}`}
      style={{ height: hasMap ? HERO_H : 150 }}
    >
      {hasMap ? (
        <AerialBanner
          places={points}
          label={`Map of your trips: ${points.map((p) => p.city).join(", ")}`}
          height={HERO_H}
          top={124}
          bottom={HERO_H - 84}
          mode="pins"
          spread={[0.1, 0.66]}
          footInset={64}
        >
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
              return Math.min(180, 44 + Math.max(first.city.length * 8.6, second.length * 7.6));
            });
            const boxes = calloutBoxes(
              pins,
              widths,
              { width, top: 0, bottom: HERO_H - 60 },
              {
                height: TAG_H,
                gap: 6,
                // "Your trips." and the calendar / New trip buttons stay clear.
                keepClear: [
                  { x: 0, y: 0, width: Math.min(230, width * 0.6), height: 116 },
                  { x: width - 124, y: 0, width: 124, height: 76 },
                ],
              },
            );
            const trail = trailPath(order.map((i) => pins[i]!));
            return (
              <>
                {trail.d ? (
                  <svg
                    aria-hidden
                    viewBox={`0 0 ${width} ${HERO_H}`}
                    className="pointer-events-none absolute inset-0 size-full"
                  >
                    <path d={trail.d} className="tn-trail" />
                    {trail.plane ? (
                      <g
                        transform={`translate(${trail.plane.x} ${trail.plane.y}) rotate(${trail.plane.angle})`}
                      >
                        <path
                          d="M8 0 L-5 -2.2 L-8 -8 L-10.5 -8 L-8 -1.6 L-12 -1.2 L-13.5 -4 L-15 -4 L-14 0 L-15 4 L-13.5 4 L-12 1.2 L-8 1.6 L-10.5 8 L-8 8 L-5 2.2 Z"
                          className="tn-plane"
                        />
                      </g>
                    ) : null}
                  </svg>
                ) : null}
                {groups.map((group, i) => {
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
                      className="tn-tag absolute z-[1]"
                      style={{
                        left: `${(box.x / width) * 100}%`,
                        top: box.y,
                        width: box.width,
                        height: box.height,
                      }}
                    >
                      <MapPin
                        className={`size-4 shrink-0 ${live ? "tn-pin-live" : "tn-pin"}`}
                        weight="fill"
                        aria-hidden
                      />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-[14px] font-semibold">
                          {first.city}
                        </span>
                        <span className="block truncate text-[13px] text-muted-foreground">
                          {second}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </>
            );
          }}
        </AerialBanner>
      ) : null}
      {hasMap ? (
        <span aria-hidden className="hn-haze" style={{ ["--haze-end" as string]: "112px" }} />
      ) : null}
      <div className="relative z-[2] flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="hn-kicker">Trip folders</p>
          <h1 className="hn-title mt-1.5">Your trips.</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>
      </div>
    </section>
  );
}

/** Plan with Béa / Join with a code: a pastel tile with its icon in a bubble. */
export function TripsActionTile({
  icon: Icon,
  title,
  sub,
  tone,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  tone: 1 | 2 | 3 | 4 | 5;
  children: (content: ReactNode, className: string) => ReactNode;
}) {
  return children(
    <>
      <span className="tn-action-icon">
        <Icon className="size-[22px]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[19px] leading-tight">{title}</span>
        <span className="block text-[13px] leading-snug text-muted-foreground">{sub}</span>
      </span>
    </>,
    `tn-action tile-fill-${tone}`,
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
      className={`hn-chip hn-chip-stack hn-chip-${tone} min-w-0 flex-1 basis-0`}
    >
      <span className="hn-chip-icon">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="w-full min-w-0 leading-tight">
        <span className="line-clamp-2 block break-words text-[15px] font-bold">{value}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{label}</span>
      </span>
    </Link>
  );
}

/**
 * The next trip (mockup `nextUpHTML`): its route from above (or its photo)
 * with who is going or the live stop, a glass panel with its name, places
 * and the countdown, its cities in order with their dates, chips for the
 * flight (or the stay once under way), to-dos and packing that open those
 * parts, and Béa's line with "View itinerary". The same data as Trips'
 * `TripFeature`.
 */
export function TripNextFeature({
  trip,
  photos,
  glance,
  peopleCount,
  picture,
  registry = TERRAIN_ART,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  peopleCount: number;
  picture: TripPicture;
  registry?: TerrainRegistry;
}) {
  const { stops, route } = useAerialRoute(trip, true);
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
    <article className="tn-feature overflow-hidden">
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        aria-label={`Open ${trip.title}`}
        className="relative block h-[320px] overflow-hidden bg-muted"
        style={{ viewTransitionName: `trip-photo-${trip.id}` }}
      >
        <TripFill
          trip={trip}
          photos={photos}
          cityNames={cityNames}
          route={route}
          picture={picture}
          height={320}
          top={78}
          bottom={204}
          current={current}
          done={done}
          registry={registry}
        />
        {live ? (
          <span className="tn-live absolute left-3 top-3 z-[1]">
            <span className="size-2 rounded-full bg-current" aria-hidden />
            Live · Stop {live.step} of {live.total}
          </span>
        ) : peopleCount > 1 ? (
          <span className="tn-pill absolute left-3 top-3 z-[1]">
            <Users className="size-4" aria-hidden />
            {peopleCount} travellers
          </span>
        ) : null}
        <span className="tn-glass absolute inset-x-3 bottom-3 z-[1] flex items-center gap-3 p-3">
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 break-words font-display text-[25px] leading-[1.08]">
              {trip.title}
            </span>
            <span className="mt-0.5 block truncate text-[14px] text-muted-foreground">
              {[places, tripDateLine(trip.start_date, trip.end_date)].filter(Boolean).join(" · ")}
              {trip.dates_status === "tentative" ? " · tentative" : ""}
            </span>
          </span>
          {count ? (
            <span aria-label={count.label} className="tn-count">
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
          <ArrowRight className="size-4 text-[var(--acc-ink,var(--primary))]" aria-hidden />
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
    <span className="trips-row-tag" data-tone={tag.tone}>
      {tag.tone === "live" ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {tag.text}
    </span>
  );
}

/** The ⋯ menu on a row: the trip's parts one tap away (as Trips' rows). */
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

/** Who is going: a disc with each traveller's initial (from their member names), and how many more. */
function Faces({
  people,
  count,
  me,
}: {
  people: readonly MemberRow[];
  count: number;
  me?: { id: string | null; name: string };
}) {
  if (count <= 1) return null;
  const shown = people.slice(0, 3);
  return (
    <span
      className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
      aria-label={`${count} travellers`}
    >
      <Users className="size-4" aria-hidden />
      <span className="flex -space-x-2" aria-hidden>
        {shown.map((m) => (
          <span key={m.id} className="hn-face hn-face-sm">
            {(m.display_name?.trim() || (m.user_id === me?.id ? me.name : "") || "T")
              .charAt(0)
              .toUpperCase()}
          </span>
        ))}
      </span>
      {count > shown.length ? <span aria-hidden>+{count - shown.length}</span> : null}
    </span>
  );
}

/**
 * A trip as a row (mockup `t4Row`, the references' "Upcoming trips"): its
 * little map from above or its photo, the name, dates and places, who is
 * going, a tag for how soon (or live, or draft), and ⋯ for its parts.
 */
export function TripNextRow({
  trip,
  photos,
  glance,
  peopleCount,
  people = [],
  me,
  picture,
  registry = TERRAIN_ART,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  peopleCount: number;
  /** The trip's member rows, for their initials. */
  people?: readonly MemberRow[];
  me?: { id: string | null; name: string };
  picture: TripPicture;
  registry?: TerrainRegistry;
}) {
  const { stops, route } = useAerialRoute(trip, false);
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
    <div className="tn-row relative flex min-h-[120px] overflow-hidden">
      <div className="relative m-2 w-[36%] max-w-[156px] shrink-0 overflow-hidden rounded-[16px] bg-muted">
        <TripFill
          trip={trip}
          photos={photos}
          cityNames={cityNames}
          route={route}
          picture={picture}
          height={104}
          top={20}
          bottom={86}
          compact
          registry={registry}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-3 pl-1.5 pr-12">
        <p className="line-clamp-2 break-words font-display text-[21px] leading-tight">
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
          <Faces people={people} count={peopleCount} {...(me ? { me } : {})} />
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
  registry,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  picture: TripPicture;
  registry: TerrainRegistry;
}) {
  const { stops, route } = useAerialRoute(trip, false);
  const month = tripMonth(trip.start_date, trip.end_date);
  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      className="tn-past relative block h-[150px] overflow-hidden text-white"
    >
      <TripFill
        trip={trip}
        photos={photos}
        cityNames={stops.map((s) => s.city)}
        route={route}
        picture={picture}
        height={150}
        top={20}
        bottom={84}
        compact
        done={route.length}
        registry={registry}
      />
      <span aria-hidden className="tn-past-fade absolute inset-0" />
      <span className="absolute inset-x-0 bottom-0 p-2.5">
        <span className="line-clamp-2 break-words font-display text-[18px] leading-[1.05]">
          {trip.title}
        </span>
        {month ? <span className="block text-[13px] text-white/90">{month}</span> : null}
      </span>
    </Link>
  );
}

export function PastNextTiles({
  trips,
  photos,
  picture,
  registry = TERRAIN_ART,
}: {
  trips: TripRow[];
  photos: TripPhotoRow[];
  picture: TripPicture;
  registry?: TerrainRegistry;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {trips.map((trip) => (
        <PastTile key={trip.id} trip={trip} photos={photos} picture={picture} registry={registry} />
      ))}
    </div>
  );
}

/** A section of Trips: serif heading and whatever sits beside it. */
export function TripsNextSection({
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
        <h2 className="font-display text-[24px] leading-none">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
