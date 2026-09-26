import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { TripBanner } from "@/components/TripBanner";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripRow } from "@/hooks/useTrips";
import type { TripGlance } from "@/hooks/useTripGlances";
import { useTripStops } from "@/hooks/useTripStops";
import { pickTripPhoto } from "@/lib/trip-card";
import { beaTripNote } from "@/lib/trip-note";
import { timeForRail } from "@/lib/timeline-kind";
import { stripEmbeddedMapsUrl } from "@/lib/timeline-directions";
import { toLocalISODate } from "@/lib/trip-dates";

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

function Fact({
  label,
  aside,
  title,
  note,
  children,
}: {
  label: string;
  aside?: string;
  title?: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        {aside ? (
          <span className="font-mono tracking-normal text-foreground/80">{aside}</span>
        ) : null}
      </p>
      {title ? (
        <p className="mt-1 truncate text-[14.5px] font-semibold leading-snug">{title}</p>
      ) : null}
      {children}
      {note ? <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/**
 * A trip in the list: its picture, then the three things you check before
 * you go — how you get there, where you sleep, how packed you are — and a
 * way into the itinerary.
 *
 * The banner carries the same `view-transition-name` as the one on the trip's
 * own page, so tapping it hands the picture to the destination rather than
 * cutting. On a browser without same-document transitions this degrades to
 * the ordinary navigation.
 */
export function TripCard({
  trip,
  photos,
  glance,
  peopleCount,
  detail = true,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  peopleCount: number;
  /** False on Home's later trips: the banner and nothing under it. */
  detail?: boolean;
}) {
  const cities = useTripStops(trip.id, null);
  const cityNames = cities.stops.map((stop) => stop.city);
  const banner = pickTripPhoto(photos, {
    city: trip.city,
    country: trip.country,
    cities: cityNames,
  });
  const stopCount = glance?.items.length ?? 0;

  const flight = glance?.flight;
  const lodging = glance?.lodging;
  const packing = glance?.packing;
  const first = glance?.firstStop;
  const quote = quoteFor(trip, cities.stops.length, glance ? glance.items.length : null);

  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      className="group block overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <TripBanner
        title={trip.title}
        city={trip.city}
        country={trip.country}
        cities={cityNames}
        startDate={trip.start_date}
        endDate={trip.end_date}
        tentative={trip.dates_status === "tentative"}
        photo={banner}
        stopCount={stopCount}
        peopleCount={peopleCount}
        viewTransitionName={`trip-photo-${trip.id}`}
      />
      {detail ? (
        <div className="px-4 pb-3.5 pt-3.5">
          {flight || lodging || packing || first ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-x-5 gap-y-3.5">
              {flight ? (
                <Fact
                  label="Transit"
                  title={[flight.title, timeForRail(flight.time_label)].filter(Boolean).join(" · ")}
                  note={stripEmbeddedMapsUrl(flight.detail) || flight.address || ""}
                />
              ) : null}
              {lodging ? (
                <Fact
                  label="Stay"
                  title={lodging.title}
                  note={stripEmbeddedMapsUrl(lodging.detail) || lodging.address || ""}
                />
              ) : null}
              {packing ? (
                <Fact
                  label="Packing"
                  aside={`${packing.packed}/${packing.total}`}
                  note={first ? `First: ${first.title}` : ""}
                >
                  <div
                    role="progressbar"
                    aria-label="Packed"
                    aria-valuemin={0}
                    aria-valuemax={packing.total}
                    aria-valuenow={packing.packed}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated"
                  >
                    <div
                      className="h-full rounded-full bg-[#b89b78]"
                      style={{ width: `${Math.round(packing.ratio * 100)}%` }}
                    />
                  </div>
                </Fact>
              ) : first ? (
                <Fact label="First stop" title={first.title} note={first.day_date ?? ""} />
              ) : null}
            </div>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">
              {cities.stops.length
                ? `${cities.stops.length} ${cities.stops.length === 1 ? "place" : "places"} so far. Nothing on the timeline yet.`
                : "Open it to start planning."}
            </p>
          )}

          <div className="mt-3.5 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:gap-3">
            {quote ? (
              <p className="line-clamp-2 min-w-0 flex-1 font-display text-[16px] italic leading-snug text-muted-foreground sm:line-clamp-1">
                “{quote}”
              </p>
            ) : null}
            <span className="flex shrink-0 items-center gap-1.5 self-end text-[14px] font-semibold sm:ml-auto sm:self-auto">
              View itinerary
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </div>
        </div>
      ) : null}
    </Link>
  );
}
