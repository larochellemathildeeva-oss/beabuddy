import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ImageIcon, MapIcon } from "@/components/icons";
import { BrandMark } from "@/components/PageHeader";
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

/** Banner heights: the Map view keeps more of the screen for its map. */
const TALL = 420;
const SHORT = 300;
/** Room kept for the route between the words and the switch at the foot. */
const ROUTE_ROOM = { tall: 130, short: 90 };
/** From the foot of the banner: the switch and the panel rising over it. */
const FOOT = 104;

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
  actions,
  tools,
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
  /** The round buttons at the top right (pins to check, to do, trip menu). */
  actions: ReactNode;
  /** At the foot of the picture, beside the switch: Plan with Béa, Add stop. */
  tools?: ReactNode;
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
  const routeTop = wordsEnd + 24;
  const height = Math.max(
    short ? SHORT : TALL,
    Math.round(routeTop + (short ? ROUTE_ROOM.short : ROUTE_ROOM.tall) + FOOT),
  );

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
          bottom={height - FOOT}
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

      <div className="relative flex h-full flex-col px-4 pb-12 pt-3">
        <div className="flex items-center justify-between gap-2">
          <BrandMark />
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        <div ref={setWords} className="mt-2 min-w-0">
          {kicker && (
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-foreground/75">
              {kicker}
            </p>
          )}
          <h1
            className={`mt-1 line-clamp-2 break-words font-display leading-[1.05] tracking-[-0.02em] ${
              short ? "text-[34px]" : "text-[40px]"
            }`}
          >
            {title}
          </h1>
          <p className="mt-1.5 text-[14px] font-medium text-foreground/80">
            {[where, dates, tentative ? "tentative" : ""].filter(Boolean).join(" · ")}
          </p>
          {companions && !short && <p className="text-[14px] text-foreground/75">{companions}</p>}
          {footer}
        </div>

        <div className="mt-auto">
          {credited ? (
            <p
              title={photoCredit(credited)}
              className="mb-2 w-fit max-w-full truncate rounded-full bg-black/80 px-2.5 py-1 text-[13px] text-white"
            >
              {photoCredit(credited)}
            </p>
          ) : null}
          <div className="flex items-end justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">{tools}</div>
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
