import { useMemo } from "react";
import { TripPageBanner } from "@/components/TripPageBanner";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripRow } from "@/hooks/useTrips";
import { useAuth } from "@/hooks/useAuth";
import { useStopPhotos } from "@/hooks/useStopPhotos";
import { useTripBanner } from "@/hooks/useTripBanner";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { bannerPhotos } from "@/lib/trip-banner";

/**
 * The trip on Home, as the minimalist design's card: its name, places and
 * dates, the picture the traveller chose for it (You → Appearance → Trip
 * banner: their photos, the town's, or Béa's illustration), and "View trip".
 */
export function HomeTripBanner({
  trip,
  photos,
  cities,
  kicker,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  cities: string[];
  /** "Upcoming trip", "Happening now". */
  kicker: string;
}) {
  const [look] = useTripBanner();
  const { user } = useAuth();
  const stopPhotos = useStopPhotos(trip.id, user?.id ?? null, trip);
  // The same photos, in the same order, as the top of the trip page.
  const own = useMemo(
    () =>
      bannerPhotos(
        stopPhotos.photos.filter((p) => p.user_id === user?.id),
        photos,
        { city: trip.city, country: trip.country, cities },
      ),
    [stopPhotos.photos, user?.id, photos, trip.city, trip.country, cities],
  );
  const art = bannerArtUrl(
    bannerSceneFor([trip.title, ...cities, trip.city, trip.country], trip.title || trip.city || ""),
  );
  return (
    <div data-guide="home-trip">
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
        card={{ kicker, tripId: trip.id }}
      />
    </div>
  );
}
