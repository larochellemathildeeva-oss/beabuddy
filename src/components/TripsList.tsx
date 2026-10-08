import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ImageIcon, MapIcon } from "@/components/icons";
import { TownPhotoCredit } from "@/components/TownPhotoCredit";
import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { useTownPicture } from "@/hooks/useTownPicture";
import { useTripStops } from "@/hooks/useTripStops";
import type { TripRow } from "@/hooks/useTrips";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { pickTripPhoto, tripDateLine } from "@/lib/trip-card";
import { routeLine } from "@/lib/trip-glance";
import type { TripPicture } from "@/lib/trip-picture";
import { type TripsLayout } from "@/lib/trips-page";

const short = (city: string) => (city.split(",")[0] ?? "").trim();

/** The trip's picture: a photo of the traveller's own, of the town, else Béa's illustration. */
function TripPictureFill({
  trip,
  photos,
  cityNames,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  cityNames: string[];
}) {
  const photo = pickTripPhoto(photos, {
    city: trip.city,
    country: trip.country,
    cities: cityNames,
  });
  const photoUrl = useSignedPhoto(photo?.storage_path ?? null);
  const town = useTownPicture(!!photo, trip.city || cityNames[0], trip.country);
  const art = bannerArtUrl(
    bannerSceneFor(
      [trip.title, ...cityNames, trip.city, trip.country],
      trip.title || trip.city || "",
    ),
  );
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

/**
 * The top of Trips, as the minimalist design draws it: a small label, "Your
 * trips." in bold over a rule. The ways to start a trip sit under the tabs
 * and the list, so the top carries no map.
 */
export function TripsHero({ section }: { section?: string | undefined }) {
  return (
    <section data-guide="trips-header" className="page-title-rule border-b border-border pb-4">
      <p className="label-caps">{section ? `Trips / ${section}` : "Trips"}</p>
      <h1 className="mt-3 font-display text-[28px] font-bold leading-[1.2]">Your trips.</h1>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section heads and the two device switches                           */
/* ------------------------------------------------------------------ */

export function TripsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rise">
      <h2 className="border-t border-border pt-2 text-[12px] font-normal leading-[17px]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The next trip, as a big banner                                      */
/* ------------------------------------------------------------------ */

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

/**
 * The next trip, as the minimalist design draws it: its name, its places, its
 * dates, its picture and one black "View trip". Flights, to-dos, packing and
 * bookings are inside the trip.
 */
export function TripFeature({ trip, photos }: { trip: TripRow; photos: TripPhotoRow[] }) {
  const { stops } = useTripStops(trip.id, null);
  const cityNames = stops.map((s) => s.city);
  const places = placesLine(trip, cityNames);
  return (
    <article className="trips-feature overflow-hidden rounded-[var(--r-card)] border border-border bg-card">
      <div className="space-y-1 px-4 pt-4">
        <h3 className="line-clamp-2 break-words text-[28px] font-bold leading-[1.2]">
          {trip.title}
        </h3>
        {places ? <p className="text-[20px] leading-[28px]">{places}</p> : null}
        <p className="text-[12px] leading-[17px]">
          {tripDateLine(trip.start_date, trip.end_date)}
          {trip.dates_status === "tentative" ? " · tentative" : ""}
        </p>
      </div>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        aria-hidden
        tabIndex={-1}
        className="relative mt-2 block h-[145px] overflow-hidden rounded-[var(--r-card)] bg-muted"
        style={{ viewTransitionName: `trip-photo-${trip.id}` }}
      >
        <TripPictureFill trip={trip} photos={photos} cityNames={cityNames} />
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        aria-label={`View trip ${trip.title}`}
        className="mt-2 flex min-h-[52px] items-center justify-center rounded-[var(--r-button)] bg-foreground text-[14px] font-medium text-background"
      >
        View trip
      </Link>
    </article>
  );
}

/** "Tokyo & Kyoto": the trip's places, or its city or country. */
function placesLine(trip: TripRow, cityNames: string[]): string {
  const names = [...new Set(cityNames.map(short).filter(Boolean))];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length > 2) return names.slice(0, 3).join(", ");
  return routeLine(cityNames) || short(trip.city ?? "") || trip.country || "";
}

/* ------------------------------------------------------------------ */
/* A trip as a row                                                     */
/* ------------------------------------------------------------------ */

/**
 * A trip as a row, as the design draws "Later": its name, then its places
 * and dates, on a hairline. The whole row opens the trip.
 */
export function TripListRow({ trip }: { trip: TripRow }) {
  const { stops } = useTripStops(trip.id, null);
  const places = placesLine(
    trip,
    stops.map((s) => s.city),
  );
  const dates =
    trip.start_date || trip.end_date
      ? tripDateLine(trip.start_date, trip.end_date)
      : "No dates yet";
  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      className="block border-b border-border py-3"
    >
      <span className="block text-[16px] leading-[22px]">{trip.title}</span>
      <span className="mt-1 block text-[14px] leading-[20px] text-muted-foreground">
        {[places, dates].filter(Boolean).join(" / ")}
        {trip.dates_status === "tentative" && trip.start_date ? " · tentative" : ""}
      </span>
    </Link>
  );
}
