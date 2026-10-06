import { useState, type ReactNode } from "react";
import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { useStopPictures } from "@/hooks/useStopPictures";
import { useTownPhoto } from "@/hooks/useTownPhoto";
import { formatTripLocation } from "@/lib/place-label";
import { tripDateLine, tripPlacesLine } from "@/lib/trip-card";
import { bannerPill } from "@/lib/trip-glance";
import { creditedOnPhoto, photoCredit } from "@/lib/wikimedia";

/**
 * The top of the trip page: one short strip, the same on every tab. The
 * picture carries the trip's name and its dates; the countdown is a pill in
 * the corner; the trip's days (or the day's stops) run in one row under it, on
 * the page rather than over the picture, so nothing is dead space.
 *
 * The picture is the trip's own photo, else a photo of its town (Pexels, then
 * Wikimedia Commons, credited), else Béa's illustration of the place.
 */
export function TripPageBanner({
  title,
  city,
  country,
  cities,
  startDate,
  endDate,
  tentative,
  companions,
  photo,
  art,
  tracker,
  viewTransitionName,
}: {
  title: string;
  city?: string | null;
  country?: string | null;
  cities: string[];
  startDate?: string | null;
  endDate?: string | null;
  tentative?: boolean;
  /** "with Sam & Ana". */
  companions?: string;
  photo: TripPhotoRow | null;
  /** Béa's illustration of the trip or the day's city: the last fallback. */
  art: string;
  /** Under the picture: the trip's day-by-day progress. */
  tracker?: ReactNode;
  viewTransitionName?: string;
}) {
  const own = useSignedPhoto(photo?.storage_path ?? null);
  const [pictures] = useStopPictures();
  const wantPhoto = pictures !== "none";
  const town = useTownPhoto(city || cities[0], country, wantPhoto && !photo);
  const [brokenTown, setBrokenTown] = useState<string | null>(null);
  const commons = !photo && town && town.url !== brokenTown ? town : null;
  const imageUrl = wantPhoto ? (own ?? commons?.url ?? art) : null;
  const credited = wantPhoto && !own && commons && creditedOnPhoto(commons) ? commons : null;

  // formatTripLocation, not a plain join: the city field often already ends
  // in the country ("Kyoto, Kyoto Prefecture, Japan").
  const distinct = new Set(
    cities.map((c) => (c.split(",")[0] ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const where =
    distinct.size > 1
      ? tripPlacesLine(cities.map((c) => (c.split(",")[0] ?? "").trim()))
      : formatTripLocation(city?.split(",")[0], country) || tripPlacesLine(cities);
  const dates = startDate || endDate ? tripDateLine(startDate, endDate) : "";
  const pill = bannerPill(startDate, endDate, tentative);

  return (
    <section className="trip-strip" aria-label={title}>
      <div
        className="trip-strip-photo"
        style={viewTransitionName ? { viewTransitionName } : undefined}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="art-dim absolute inset-0 size-full object-cover"
            referrerPolicy={commons && !own ? "no-referrer" : undefined}
            onError={commons && !own ? () => setBrokenTown(commons.url) : undefined}
          />
        ) : null}
        <span aria-hidden className="trip-strip-shade" />
        {credited ? (
          <p
            title={photoCredit(credited)}
            className="absolute start-3 top-2 max-w-[60%] truncate rounded-full bg-black/70 px-2.5 py-0.5 text-[13px] text-white"
          >
            {photoCredit(credited)}
          </p>
        ) : null}
        {pill ? <span className="trip-strip-pill">{pill}</span> : null}
        <div className="relative min-w-0 px-4 pb-2.5 pt-12 text-white">
          <h1 className="line-clamp-2 break-words font-display text-[28px] leading-[1.05] tracking-[-0.02em] [text-wrap:balance]">
            {title}
          </h1>
          <p className="mt-1 truncate text-[14px] text-white/90">
            {[dates, tentative ? "tentative" : "", companions ?? ""].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="px-4 pb-1 pt-2">
        <p className="truncate text-[14px] text-muted-foreground">{where}</p>
        {tracker}
      </div>
    </section>
  );
}
