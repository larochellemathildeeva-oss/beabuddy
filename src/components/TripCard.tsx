import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { Bed, ChevronRight, ListChecks, Luggage, MapPin, Plane, Users } from "@/components/icons";
import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import type { TripRow } from "@/hooks/useTrips";
import type { TripGlance } from "@/hooks/useTripGlances";
import { useTripStops } from "@/hooks/useTripStops";
import { pickTripPhoto, tripDateLine } from "@/lib/trip-card";
import { beaTripNote } from "@/lib/trip-note";
import { timeForRail } from "@/lib/timeline-kind";
import { toLocalISODate } from "@/lib/trip-dates";
import { routeLine } from "@/lib/trip-glance";
import { currentLeg, isPastTrip } from "@/lib/home-trip";
import { liveSummary } from "@/lib/companion";

/** "Sep 7": the day a flight leaves, when it has one. */
function flightDay(day: string | null): string {
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

/** One figure under a trip: an icon, the value, and what it is. */
function Stat({
  icon: Icon,
  value,
  label,
  large,
}: {
  icon: ComponentType<{ className?: string }>;
  value: string;
  label: string;
  large: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 first:pl-0 last:pr-0">
      <Icon className={`${large ? "size-5" : "size-4"} shrink-0 text-primary`} aria-hidden />
      <span className="min-w-0 leading-tight">
        <span className={`block truncate font-bold ${large ? "text-[14px]" : "text-[13px]"}`}>
          {value}
        </span>
        <span className="block truncate text-[11.5px] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

/**
 * A trip in the list, as the master draws it: its picture on the left, then
 * the name, dates and places, and three figures — the flight, the to-dos left
 * and how packed you are. `large` is the "Next up" trip, which also carries
 * where you are today, the live stop and Béa's line about it.
 *
 * The picture carries the same `view-transition-name` as the one on the
 * trip's own page, so tapping hands the picture across instead of cutting.
 */
export function TripCard({
  trip,
  photos,
  glance,
  peopleCount,
  large = false,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  peopleCount: number;
  large?: boolean;
}) {
  const cities = useTripStops(trip.id, null);
  const cityNames = cities.stops.map((stop) => stop.city);
  const photo = pickTripPhoto(photos, {
    city: trip.city,
    country: trip.country,
    cities: cityNames,
  });
  const photoUrl = useSignedPhoto(photo?.storage_path ?? null);
  const art = bannerArtUrl(
    bannerSceneFor(
      [trip.title, ...cityNames, trip.city, trip.country],
      trip.title || trip.city || "",
    ),
  );

  const today = toLocalISODate(new Date());
  // Several cities: the one that matters today, with its own flight and stay.
  const leg = glance ? currentLeg(cities.stops, glance.items, today) : null;
  // On a day of the trip: the live tracker's progress, one tap from the card.
  const live = glance ? liveSummary(glance.items, today) : null;
  const notStarted = !isPastTrip(trip, today) && !(trip.start_date && trip.start_date <= today);
  const flight = leg ? leg.flight : glance?.flight;
  const lodging = (leg ? leg.lodging : glance?.lodging) ?? glance?.booked.lodging ?? null;
  // Nothing on the timeline, but a confirmation in Trip documents: booked.
  const bookedFlight = flight ? null : (glance?.booked.flight ?? null);
  const packing = glance?.packing;
  const openTodos = glance?.todos.open ?? 0;
  const quote = large
    ? quoteFor(trip, cities.stops.length, glance ? glance.items.length : null)
    : "";

  const dates = tripDateLine(trip.start_date, trip.end_date);
  const names = cityNames.map((c) => (c.split(",")[0] ?? "").trim()).filter(Boolean);
  const places =
    names.length > 1
      ? [...new Set(names)].slice(0, 3).join(" · ")
      : routeLine(cityNames) || trip.city?.split(",")[0] || trip.country || "";

  const flightValue = flight
    ? flightDay(flight.day_date) || timeForRail(flight.time_label) || "Saved"
    : bookedFlight
      ? "Booked"
      : notStarted
        ? "None yet"
        : "—";
  const stats = (
    <div className="flex divide-x divide-border border-t border-border px-3.5 py-2.5">
      <Stat
        icon={Plane}
        value={flightValue}
        label={notStarted ? "Flight" : "Next flight"}
        large={large}
      />
      <Stat
        icon={ListChecks}
        value={openTodos ? `${openTodos} left` : "All done"}
        label="To-dos"
        large={large}
      />
      <Stat
        icon={Luggage}
        value={packing ? `${packing.packed}/${packing.total}` : "—"}
        label="Packing"
        large={large}
      />
    </div>
  );

  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      className="plain-card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="flex">
        <div
          className={`relative shrink-0 bg-[#2a2026] ${large ? "w-[40%] min-h-[150px]" : "w-[34%] min-h-[112px]"}`}
          style={{ viewTransitionName: `trip-photo-${trip.id}` }}
        >
          <img
            src={photoUrl ?? art}
            alt=""
            decoding="async"
            className="art-dim absolute inset-0 size-full object-cover"
          />
          {peopleCount > 1 ? (
            <span
              aria-label={`${peopleCount} people on this trip`}
              className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/92 px-2 py-0.5 text-[11px] font-bold text-[#28231f]"
            >
              <Users className="size-3" aria-hidden />
              {peopleCount}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`line-clamp-2 break-words font-display leading-tight ${large ? "text-[28px]" : "text-[24px]"}`}
              >
                {trip.title}
              </p>
              {dates ? (
                <p className={`text-muted-foreground ${large ? "text-[15px]" : "text-[14px]"}`}>
                  {dates}
                  {trip.dates_status === "tentative" ? " · tentative" : ""}
                </p>
              ) : (
                <p className="text-[14px] text-muted-foreground">No dates yet</p>
              )}
            </div>
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-elevated transition-transform group-hover:translate-x-0.5"
            >
              <ChevronRight className="size-4.5" />
            </span>
          </div>
          {places ? (
            <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{places}</span>
            </p>
          ) : null}
          {leg ? (
            <p className="mt-1.5 truncate text-[12px] font-bold uppercase tracking-[0.08em] text-primary">
              {leg.label} · <span className="normal-case tracking-normal">{leg.city}</span>
            </p>
          ) : null}
          {live ? (
            <p className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-primary-soft px-2 py-1 text-[12.5px]">
              <span className="relative flex size-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              <span className="shrink-0 font-bold text-primary">
                Stop {live.step} of {live.total}
              </span>
              <span className="min-w-0 truncate">{live.title}</span>
            </p>
          ) : null}
          {large && lodging ? (
            <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
              <Bed className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{lodging.title}</span>
            </p>
          ) : null}
          {quote ? (
            <p className="mt-2.5 line-clamp-2 border-t border-border pt-2 font-display text-[16px] italic leading-snug text-muted-foreground">
              “{quote}”
            </p>
          ) : null}
        </div>
      </div>
      {stats}
    </Link>
  );
}
