import { useEffect, useState, type ReactNode } from "react";
import { useSignedPhoto } from "@/hooks/useTripPhotos";
import { useStopPictures } from "@/hooks/useStopPictures";
import { useTownPhoto } from "@/hooks/useTownPhoto";
import { formatTripLocation } from "@/lib/place-label";
import { tripDateLine, tripPlacesLine } from "@/lib/trip-card";
import { bannerPill } from "@/lib/trip-glance";
import { nextBannerIndex, type BannerPhoto, type TripBanner } from "@/lib/trip-banner";
import { creditedOnPhoto, photoCredit } from "@/lib/wikimedia";

/**
 * The top of the trip page: one short strip, the same on every tab. The
 * picture carries the trip's name and its dates; the countdown is a pill in
 * the corner; the trip's days (or the day's stops) run in one row under it, on
 * the page rather than over the picture, so nothing is dead space.
 *
 * The look is the traveller's choice (You → Appearance → Trip banner): their
 * own photos of the trip one after another, a photo of the town (Pexels, then
 * Wikimedia Commons, credited), Béa's illustration, or a compact header with
 * a small picture and buttons instead of the photo block.
 */
/** How long each of the traveller's own photos stays up. */
const TURN_MS = 6000;

export type BannerAction = { label: string; onClick: () => void };

export function TripPageBanner({
  title,
  city,
  country,
  cities,
  startDate,
  endDate,
  tentative,
  companions,
  look,
  own,
  art,
  actions,
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
  look: TripBanner;
  /** The traveller's own photos of the trip, for "My photos". */
  own: BannerPhoto[];
  /** The compact look's buttons: what to do next, and Plan with Béa. */
  actions?: { primary: BannerAction; secondary: BannerAction };
  /** Béa's illustration of the trip or the day's city: the last fallback. */
  art: string;
  /** Under the picture: the trip's day-by-day progress. */
  tracker?: ReactNode;
  viewTransitionName?: string;
}) {
  const [pictures] = useStopPictures();
  const wantPhoto = pictures !== "none";
  const mine = look !== "illustration" && look !== "stock" && own.length > 0;
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (!mine || own.length < 2) return;
    // Reduced motion keeps the first photo still.
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset["motion"] === "reduce"
    )
      return;
    const id = window.setInterval(() => setTurn((t) => nextBannerIndex(t, own.length)), TURN_MS);
    return () => window.clearInterval(id);
  }, [mine, own.length]);
  const ownPath = mine ? (own[turn % own.length]?.storage_path ?? null) : null;
  const signed = useSignedPhoto(ownPath);
  const town = useTownPhoto(
    city || cities[0],
    country,
    wantPhoto && look !== "illustration" && !mine,
  );
  const [brokenTown, setBrokenTown] = useState<string | null>(null);
  const commons = !mine && look !== "illustration" && town && town.url !== brokenTown ? town : null;
  const imageUrl = !wantPhoto
    ? null
    : look === "illustration"
      ? art
      : mine
        ? signed
        : (commons?.url ?? art);
  const credited = wantPhoto && commons && creditedOnPhoto(commons) ? commons : null;

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
  const photoProps = {
    src: imageUrl ?? undefined,
    referrerPolicy: commons ? ("no-referrer" as const) : undefined,
    onError: commons ? () => setBrokenTown(commons.url) : undefined,
  };

  if (look === "compact") {
    return (
      <section className="px-4 pb-1 pt-3" aria-label={title}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {pill ? (
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {pill}
              </p>
            ) : null}
            <h1 className="line-clamp-2 break-words font-display text-[26px] leading-[1.05] tracking-[-0.02em] [text-wrap:balance]">
              {title}
            </h1>
            <p className="mt-1 truncate text-[14px] text-muted-foreground">
              {[where, dates, tentative ? "tentative" : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
          {imageUrl ? (
            <img
              {...photoProps}
              alt=""
              className="art-dim size-[84px] shrink-0 rounded-2xl object-cover"
            />
          ) : null}
        </div>
        {actions ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={actions.primary.onClick}
              className="trip-strip-btn is-primary"
            >
              {actions.primary.label}
            </button>
            <button type="button" onClick={actions.secondary.onClick} className="trip-strip-btn">
              {actions.secondary.label}
            </button>
          </div>
        ) : null}
        {credited ? (
          <p
            className="mt-1 truncate text-[13px] text-muted-foreground"
            title={photoCredit(credited)}
          >
            {photoCredit(credited)}
          </p>
        ) : null}
        {tracker ? <div className="mt-2">{tracker}</div> : null}
      </section>
    );
  }

  return (
    <section className="trip-strip" aria-label={title}>
      <div
        className="trip-strip-photo"
        style={viewTransitionName ? { viewTransitionName } : undefined}
      >
        {imageUrl ? (
          <img
            key={imageUrl}
            {...photoProps}
            alt=""
            className="art-dim trip-strip-img absolute inset-0 size-full object-cover"
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
