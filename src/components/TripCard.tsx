import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bed, ChevronRight, ListChecks, MapPin, Plane } from "lucide-react";
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
import { dueLine } from "@/lib/trip-glance";
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

/** Which pastels a card and its fact boxes take in Colorful. */
const TONES = [1, 4, 3, 5, 2] as const;

function Fact({
  icon: Icon,
  label,
  aside,
  title,
  note,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  aside?: string;
  title?: string;
  note?: string;
  tone: number;
}) {
  return (
    <div className={`tile-fill-${tone}`}>
      <p className="flex items-center gap-1.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        {aside ? (
          <span className="ml-auto shrink-0 font-mono text-[11px] font-bold text-foreground/80">
            {aside}
          </span>
        ) : null}
      </p>
      {title ? (
        <p className="mt-1.5 line-clamp-3 break-words text-[14px] font-semibold leading-snug">
          {title}
        </p>
      ) : null}
      {note ? (
        <p className="mt-0.5 line-clamp-2 break-words text-[12.5px] text-muted-foreground">
          {note}
        </p>
      ) : null}
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
  index = 0,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  peopleCount: number;
  /** False on Home's later trips: the banner and nothing under it. */
  detail?: boolean;
  /** Its place in the list: in Colorful, neighbouring cards differ in colour. */
  index?: number;
}) {
  const cities = useTripStops(trip.id, null);
  const cityNames = cities.stops.map((stop) => stop.city);
  const banner = pickTripPhoto(photos, {
    city: trip.city,
    country: trip.country,
    cities: cityNames,
  });
  const stopCount = glance?.stops ?? 0;

  const today = toLocalISODate(new Date());
  // Several cities: the one that matters today, with its own flight and stay.
  const leg = glance ? currentLeg(cities.stops, glance.items, today) : null;
  // On a day of the trip: the live tracker's progress, one tap from the card.
  const live = glance ? liveSummary(glance.items, today) : null;
  // Before the trip starts, a missing flight is worth a nudge; after, it is not.
  const notStarted = !isPastTrip(trip, today) && !(trip.start_date && trip.start_date <= today);
  const flight = leg ? leg.flight : glance?.flight;
  const lodging = leg ? leg.lodging : glance?.lodging;
  const packing = glance?.packing;
  const first = glance?.firstStop;
  const todo = glance?.todos.next;
  const openTodos = glance?.todos.open ?? 0;
  const quote = quoteFor(trip, cities.stops.length, glance ? glance.items.length : null);

  const tone = TONES[index % TONES.length]!;
  const factTones = TONES.filter((t) => t !== tone);
  const showFlight = Boolean(flight) || (notStarted && !leg);
  // A fourth column is too narrow on a phone: the first stop moves to the
  // line under the facts when there is no packing bar there.
  const columns = [showFlight, Boolean(lodging), Boolean(todo)].filter(Boolean).length;
  const firstAsColumn = !packing && first && columns < 3;
  const firstAsLine = !packing && first && !firstAsColumn;
  let nextTone = 0;
  const factTone = () => factTones[nextTone++ % factTones.length]!;

  if (!detail) {
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
      </Link>
    );
  }

  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      className="tile-card-1 group block overflow-hidden transition-shadow hover:shadow-md"
    >
      <TripBanner
        variant="feature"
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
      <div className={`tile-fill-${tone} relative -mt-5 rounded-t-[22px] px-4 pb-4 pt-4`}>
        {leg ? (
          <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
            {leg.label} · <span className="normal-case tracking-normal">{leg.city}</span>
          </p>
        ) : null}
        {live ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-[13.5px]">
            <span className="relative flex size-2 shrink-0" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span className="shrink-0 font-semibold text-primary">
              Live · Stop {live.step} of {live.total}
            </span>
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">{live.label}: </span>
              {live.title}
            </span>
          </div>
        ) : null}
        {showFlight || lodging || packing || first || todo ? (
          <>
            {showFlight || lodging || todo || firstAsColumn ? (
              <div className="fact-row">
                {flight ? (
                  <Fact
                    icon={Plane}
                    tone={factTone()}
                    label={notStarted ? "First flight" : "Next flight"}
                    title={[flight.title, timeForRail(flight.time_label)]
                      .filter(Boolean)
                      .join(" · ")}
                    note={
                      [flightDay(flight.day_date), stripEmbeddedMapsUrl(flight.detail)]
                        .filter(Boolean)
                        .join(" · ") ||
                      flight.address ||
                      ""
                    }
                  />
                ) : showFlight ? (
                  <Fact
                    icon={Plane}
                    tone={factTone()}
                    label="First flight"
                    title="None saved yet"
                    note="Add it to the itinerary"
                  />
                ) : null}
                {lodging ? (
                  <Fact
                    icon={Bed}
                    tone={factTone()}
                    label="Stay"
                    title={lodging.title}
                    note={stripEmbeddedMapsUrl(lodging.detail) || lodging.address || ""}
                  />
                ) : null}
                {firstAsColumn && first ? (
                  <Fact
                    icon={MapPin}
                    tone={factTone()}
                    label="First stop"
                    title={first.title}
                    note={first.day_date ?? ""}
                  />
                ) : null}
                {todo ? (
                  <Fact
                    icon={ListChecks}
                    tone={factTone()}
                    label="To do"
                    aside={openTodos > 1 ? String(openTodos) : ""}
                    title={todo.title}
                    note={
                      dueLine(todo.due_on) || (openTodos > 1 ? `and ${openTodos - 1} more` : "")
                    }
                  />
                ) : null}
              </div>
            ) : null}
            {packing ? (
              <div className="mt-3 flex items-center gap-3 rounded-full bg-elevated px-3 py-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Packing
                </span>
                <div
                  role="progressbar"
                  aria-label="Packed"
                  aria-valuemin={0}
                  aria-valuemax={packing.total}
                  aria-valuenow={packing.packed}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-card"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(packing.ratio * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] font-bold text-foreground/80">
                  {packing.packed}/{packing.total}
                </span>
              </div>
            ) : firstAsLine && first ? (
              <p className="mt-3 flex items-center gap-2 rounded-full bg-elevated px-3 py-1.5 text-[13px]">
                <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  First stop
                </span>
                <span className="min-w-0 truncate font-semibold">{first.title}</span>
                {first.day_date ? (
                  <span className="ml-auto shrink-0 text-muted-foreground">{first.day_date}</span>
                ) : null}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[13.5px] text-muted-foreground">
            {cities.stops.length
              ? `${cities.stops.length} ${cities.stops.length === 1 ? "place" : "places"} so far. Nothing on the timeline yet.`
              : "Open it to start planning."}
          </p>
        )}

        <div className="mt-3.5 flex items-center gap-3 border-t border-border pt-3">
          {quote ? (
            <p className="line-clamp-3 min-w-0 flex-1 font-display text-[16px] italic leading-snug text-muted-foreground">
              “{quote}”
            </p>
          ) : (
            <span className="flex-1" />
          )}
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-elevated px-3.5 py-2 text-[13px] font-semibold">
            View itinerary
            <ChevronRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
