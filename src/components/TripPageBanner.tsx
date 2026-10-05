import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ImageIcon, MapIcon } from "@/components/icons";
import { TripBannerMap } from "@/components/TripRouteMap";
import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { useStopPictures } from "@/hooks/useStopPictures";
import { useTownPhoto } from "@/hooks/useTownPhoto";
import type { RouteStop } from "@/lib/home-route-map";
import { formatTripLocation } from "@/lib/place-label";
import { tripDateLine, tripPlacesLine } from "@/lib/trip-card";
import { bannerPill } from "@/lib/trip-glance";
import type { TripPicture } from "@/lib/trip-picture";
import { creditedOnPhoto, photoCredit } from "@/lib/wikimedia";

/** Room kept for the route between the words and the foot (Stops picture). */
const ROUTE_ROOM = { tall: 44, short: 36 };
/** Under the foot's content: the banner's own bottom padding. */
const FOOT_PAD = 8;

/**
 * The top of the trip page, as the UI revamp's mockup draws it (`tripHero`):
 * the picture fills the width, the trip's name sits over it in a haze of the
 * page's colour, and the panel under it rises over its foot with rounded
 * corners (`.trip-panel`, in TripDetail).
 *
 * The picture is the traveller's choice, on this device: **Stops**, the trip's
 * cities joined by a line over the same terrain as Home's map, or **Photo**,
 * the trip's own photo, else a photo of its town (Pexels, then Wikimedia
 * Commons, credited), else Béa's illustration of the place. Stops falls back
 * to the photo while no city has a position yet.
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
  route,
  current,
  done,
  picture,
  onPicture,
  short = false,
  tracker,
  footer,
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
  /** The trip's cities with a position, for Stops. */
  route: RouteStop[];
  /** Index into `route` of the city you are in, ringed; -1 for none. */
  current: number;
  /** How many of `route` are behind you. */
  done: number;
  picture: TripPicture;
  onPicture: (next: TripPicture) => void;
  /** The Map view: a shorter banner. */
  short?: boolean;
  /** Under the dates, inside the banner: the trip's day-by-day progress. */
  tracker?: ReactNode;
  /** Under the dates: the day the page is showing. */
  footer?: ReactNode;
  viewTransitionName?: string;
}) {
  const own = useSignedPhoto(photo?.storage_path ?? null);
  // "No pictures" (You → Appearance) still leaves the map: it is the route,
  // not a picture of the place.
  const [pictures] = useStopPictures();
  // Photo is the traveller's own choice for this banner (owner decision for
  // the revamp), so it shows a real photo whatever "Real photos" says for
  // stop and place pictures; only "No pictures" turns it off.
  const showStops = picture === "stops" && route.length > 0;
  const wantPhoto = !showStops && pictures !== "none";
  const town = useTownPhoto(city || cities[0], country, wantPhoto && !photo);
  const [brokenTown, setBrokenTown] = useState<string | null>(null);
  const commons = !photo && town && town.url !== brokenTown ? town : null;
  const imageUrl = wantPhoto ? (own ?? commons?.url ?? art) : null;
  const credited = wantPhoto && !own && commons && creditedOnPhoto(commons) ? commons : null;
  // The words over the top can run to several lines (a long name, a day
  // line); the route is drawn below wherever they end, and the banner grows
  // rather than letting a city sit under them.
  const [words, setWords] = useState<HTMLDivElement | null>(null);
  const wordsEnd = useBottom(words);
  // The foot (credit, picture switch, tracker) is measured too, so the banner
  // is only as tall as its content; Stops adds room for the route between.
  const [foot, setFoot] = useState<HTMLDivElement | null>(null);
  const footHeight = useHeight(foot);
  const routeTop = wordsEnd + 8;
  const routeRoom = showStops ? (short ? ROUTE_ROOM.short : ROUTE_ROOM.tall) : 0;
  const height = Math.round(routeTop + routeRoom + footHeight + FOOT_PAD);

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
  const kicker = bannerPill(startDate, endDate, tentative);
  const mapLabel = `Map of the trip: ${route.map((s) => s.city).join(", ")}`;

  return (
    <section
      className="trip-hero"
      style={{ height, ...(viewTransitionName ? { viewTransitionName } : {}) }}
    >
      {showStops ? (
        <TripBannerMap
          stops={route}
          label={mapLabel}
          height={height}
          current={current}
          done={done}
          top={routeTop}
          bottom={height - footHeight - FOOT_PAD}
        />
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="art-dim absolute inset-0 size-full object-cover"
          referrerPolicy={commons && !own ? "no-referrer" : undefined}
          onError={commons && !own ? () => setBrokenTown(commons.url) : undefined}
        />
      ) : null}
      <span
        aria-hidden
        className="trip-hero-haze"
        style={wordsEnd ? ({ "--haze-end": `${wordsEnd}px` } as CSSProperties) : undefined}
      />

      {tracker && (
        <span
          aria-hidden
          className="trip-hero-shade"
          style={{ height: footHeight + FOOT_PAD + 60 }}
        />
      )}

      <div className="relative flex h-full flex-col px-4 pb-2 pt-2">
        <div ref={setWords} className="min-w-0">
          {kicker && (
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-foreground/75">
              {kicker}
            </p>
          )}
          <h1
            className={`mt-1 line-clamp-2 break-words font-display leading-[1.05] tracking-[-0.02em] ${
              short ? "text-[26px]" : "text-[28px]"
            }`}
          >
            {title}
          </h1>
          <p className="mt-1 truncate text-[14px] font-medium text-foreground/80">
            {[where, dates, tentative ? "tentative" : "", short ? "" : (companions ?? "")]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {footer}
        </div>

        <div ref={setFoot} className="mt-auto">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              {credited ? (
                <p
                  title={photoCredit(credited)}
                  className="w-fit max-w-full truncate rounded-full bg-black/80 px-2.5 py-1 text-[13px] text-white"
                >
                  {photoCredit(credited)}
                </p>
              ) : null}
            </div>
            <div role="group" aria-label="Trip picture" className="trip-hero-switch shrink-0">
              <button
                type="button"
                aria-pressed={picture === "stops"}
                aria-label="Stops"
                onClick={() => onPicture("stops")}
                title="Show the trip's stops on a map"
              >
                <MapIcon className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-pressed={picture === "photo"}
                aria-label="Photo"
                onClick={() => onPicture("photo")}
                title="Show a photo of the place"
              >
                <ImageIcon className="size-5" aria-hidden />
              </button>
            </div>
          </div>
          {tracker && <div className="mt-1">{tracker}</div>}
        </div>
      </div>
    </section>
  );
}

/** Where an element ends, from the top of its positioned parent; 0 before it is drawn. */
function useBottom(el: HTMLElement | null): number {
  const [bottom, setBottom] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    const read = () => setBottom(el.offsetTop + el.offsetHeight);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, [el]);
  return bottom;
}

/** How tall an element is; 0 before it is drawn. */
function useHeight(el: HTMLElement | null): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    const read = () => setHeight(el.offsetHeight);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, [el]);
  return height;
}
