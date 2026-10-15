import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Search } from "@/components/icons";
import { HomeTripBanner } from "@/components/HomeTripBanner";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripRow } from "@/hooks/useTrips";
import { useTripStops } from "@/hooks/useTripStops";
import { placeArtUrl } from "@/lib/place-art";

const SOFT_SHADOW = "";

/** The top of Home with a trip ahead: the trip as the short strip the trip page opens with. */
export function HomeUpcoming({ trip, photos }: { trip: TripRow; photos: TripPhotoRow[] }) {
  const { stops } = useTripStops(trip.id, null);
  const stopCities = useMemo(() => stops.map((s) => s.city).filter(Boolean), [stops]);

  return (
    <section className="flex flex-col">
      <HomeTripBanner trip={trip} photos={photos} cities={stopCities} kicker="Upcoming trip" />
    </section>
  );
}

/** "Where to next?": the way into planning another trip. */
export function HomeWhereNext() {
  return (
    <Link
      to="/trips/plan"
      className="flex h-[52px] items-center gap-3 rounded-full border border-border bg-card px-4"
    >
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1 text-[15px] font-medium">Where to next?</span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
        <ArrowRight className="size-[18px]" aria-hidden />
      </span>
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
            className="flex flex-col gap-2 rounded-[var(--r-card)] border border-border bg-card p-1.5 pb-2.5"
          >
            <span className="relative block aspect-[4/3] overflow-hidden rounded-[6px] bg-muted">
              <img
                src={idea.art}
                alt=""
                decoding="async"
                className="art-dim absolute inset-0 size-full object-cover"
              />
            </span>
            <span className="px-1 text-[14px] font-bold leading-[1.15]">{idea.label}</span>
            <ArrowRight className="mx-1 size-4" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}
