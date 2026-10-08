import { useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "@/components/icons";
import { HomeTripBanner } from "@/components/HomeTripBanner";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripRow } from "@/hooks/useTrips";
import type { TripGlance } from "@/hooks/useTripGlances";
import { useTripStops } from "@/hooks/useTripStops";
import { flightParts } from "@/lib/home-route-map";
import { placeArtUrl } from "@/lib/place-art";

const SOFT_SHADOW = "";

/** The top of Home with a trip ahead: the trip as the short strip the trip page opens with. */
export function HomeUpcoming({ trip, photos }: { trip: TripRow; photos: TripPhotoRow[] }) {
  const { stops } = useTripStops(trip.id, null);
  const stopCities = useMemo(() => stops.map((s) => s.city).filter(Boolean), [stops]);

  return (
    <section>
      <HomeTripBanner trip={trip} photos={photos} cities={stopCities} kicker="Upcoming trip" />
    </section>
  );
}

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
 * The trip in three numbers: to-dos left, the flight, how packed. Each opens
 * its own list.
 */
export function HomeTripStats({ trip, glance }: { trip: TripRow; glance: TripGlance | undefined }) {
  const open = glance?.todos.open ?? 0;
  const flight = glance?.flight ?? null;
  const parts = flight ? flightParts(`${flight.title} ${flight.detail ?? ""}`) : null;
  const packing = glance?.packing ?? null;
  const percent = packing ? Math.round(packing.ratio * 100) : 0;
  const packed = packing
    ? new Intl.NumberFormat(undefined, { style: "percent" }).format(percent / 100)
    : "—";
  const cell = "flex min-h-11 min-w-0 flex-col justify-center p-4";

  return (
    <section
      data-guide="home-next"
      aria-label="This trip at a glance"
      className="grid grid-cols-[0.8fr_1.4fr_1fr] divide-x divide-border border border-border bg-card"
    >
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={{ prep: "todo" }}
        className={cell}
      >
        <Stat big={String(open)} small={open === 1 ? "to-do" : "to-dos"} />
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={flight ? {} : { view: "bookings" }}
        className={cell}
      >
        {flight ? (
          <Stat
            big={parts?.code ?? flight.title}
            small={
              <>
                {parts?.route ? <span className="block truncate">{parts.route}</span> : null}
                {shortDay(flight.day_date) ? (
                  <span className="block truncate">{shortDay(flight.day_date)}</span>
                ) : null}
              </>
            }
          />
        ) : (
          <Stat big="Flight" small="Not added yet" />
        )}
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={{ prep: "packing" }}
        className={cell}
      >
        <Stat big={packed} small={packing ? "packed" : "Packing list"} />
      </Link>
    </section>
  );
}

function Stat({ big, small }: { big: string; small: ReactNode }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[28px] font-bold leading-[1.2]">{big}</span>
      <span className="mt-1 block whitespace-nowrap text-[12px] leading-[1.4]">{small}</span>
    </span>
  );
}

/** "Where to next?": the way into planning another trip. */
export function HomeWhereNext() {
  return (
    <Link
      to="/trips/plan"
      className="home-where-next flex h-[52px] items-center gap-3 border border-border px-4"
    >
      <span className="flex-1 text-[14px] text-muted-foreground">Where to next?</span>
      <ArrowRight className="size-[18px] shrink-0" aria-hidden />
    </Link>
  );
}

/**
 * Three ideas for the trip. Each opens Plan with Béa with the request already
 * written for the trip's city; nothing is asked until the traveller sends it.
 */
export function HomeSuggested({
  trip,
  here,
}: {
  trip: TripRow;
  /** The town the traveller is in today (or the trip starts in), and its country. */
  here: { city: string; stopCountry?: string | null };
}) {
  const city = here.city || trip.city?.split(",")[0]?.trim() || trip.title;
  // Only a country known to belong to this town: a multi-country trip must not inherit the first one.
  const country = here.stopCountry || "";
  const ideas = [
    {
      label: "Iconic Landmarks",
      art: placeArtUrl("landmark"),
      ask: `Add the iconic landmarks of ${city} that are worth the time.`,
    },
    {
      label: "Cafés & Coffee",
      art: placeArtUrl("cafe"),
      ask: `Add a few good cafés and coffee places in ${city}, near what we are already doing.`,
    },
    {
      label: "Day Trips",
      art: placeArtUrl("viewpoint"),
      ask: `Suggest a day trip from ${city} that fits a free day${country ? `, without leaving ${country}` : ""}.`,
    },
  ];
  return (
    <section data-guide="home-suggested">
      <p className="label-caps mb-1">Béa suggests</p>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2>Suggested for your trip</h2>
        <Link
          to="/recommendations"
          className="-me-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 px-2 text-[14px] font-medium"
        >
          See all
          <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {ideas.map((idea) => (
          <Link
            key={idea.label}
            to="/trips/$tripId"
            params={{ tripId: trip.id }}
            search={{ plan: "build", ask: idea.ask }}
            className="group relative aspect-square overflow-hidden rounded-[var(--r-card)] bg-muted"
          >
            <img
              src={idea.art}
              alt=""
              decoding="async"
              className="art-dim absolute inset-0 size-full object-cover transition-transform duration-(--t-move) group-hover:scale-[1.03]"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_35%,rgb(0_0_0/0.62))]"
            />
            <span className="absolute bottom-2.5 left-2.5 right-7 text-[13.5px] font-bold leading-[1.15] text-white">
              {idea.label}
            </span>
            <span className="absolute bottom-2 right-1.5 grid size-[26px] place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm">
              <ArrowRight className="size-[15px]" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
