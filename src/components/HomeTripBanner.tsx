import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { TripPageBanner } from "@/components/TripPageBanner";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripRow } from "@/hooks/useTrips";
import { useTripBanner } from "@/hooks/useTripBanner";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { bannerPhotos } from "@/lib/trip-banner";

/**
 * The trip on Home: the same short strip as the top of the trip page, in the
 * look the traveller chose (You → Appearance → Trip banner), opening the trip.
 * With the compact look the strip is a header, so its buttons do the opening.
 */
export function HomeTripBanner({
  trip,
  photos,
  cities,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  cities: string[];
}) {
  const [look] = useTripBanner();
  const navigate = useNavigate();
  const own = useMemo(
    () => bannerPhotos([], photos, { city: trip.city, country: trip.country, cities }),
    [photos, trip.city, trip.country, cities],
  );
  const art = bannerArtUrl(
    bannerSceneFor([trip.title, ...cities, trip.city, trip.country], trip.title || trip.city || ""),
  );
  const open = () => void navigate({ to: "/trips/$tripId", params: { tripId: trip.id } });
  const banner = (
    <TripPageBanner
      title={trip.title}
      city={trip.city}
      country={trip.country}
      cities={cities}
      startDate={trip.start_date}
      endDate={trip.end_date}
      tentative={trip.dates_status === "tentative"}
      look={look}
      own={own}
      art={art}
      actions={{
        primary: { label: "Open trip", onClick: open },
        secondary: {
          label: "Plan with Béa",
          onClick: () =>
            void navigate({
              to: "/trips/$tripId",
              params: { tripId: trip.id },
              search: { plan: "build" },
            }),
        },
      }}
    />
  );
  return (
    <div className="-mx-4" data-guide="home-trip">
      {look === "compact" ? (
        banner
      ) : (
        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          viewTransition
          aria-label={`Open ${trip.title}`}
          className="block"
        >
          {banner}
        </Link>
      )}
    </div>
  );
}
