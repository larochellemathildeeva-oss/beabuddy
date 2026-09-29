import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  ListChecks,
  Luggage,
  Users,
} from "@/components/icons";
import type { TripRow } from "@/hooks/useTrips";
import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripGlance } from "@/hooks/useTripGlances";
import { useTripStops } from "@/hooks/useTripStops";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { useTownPicture } from "@/hooks/useTownPicture";
import { TownPhotoCredit } from "@/components/TownPhotoCredit";
import { pickTripPhoto, tripDateLine } from "@/lib/trip-card";
import { timeForRail } from "@/lib/timeline-kind";
import { toLocalISODate } from "@/lib/trip-dates";
import { dueLine, heroTags, nextOnPlan, routeLine } from "@/lib/trip-glance";
import { isUnderway } from "@/lib/trip-card";

/** A serif heading with one quiet link beside it, as on the master Home. */
export function HomeSectionTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[27px] leading-none">{title}</h2>
      {aside ? (
        <div className="flex shrink-0 items-center gap-0.5 text-[14px] font-semibold text-primary">
          {aside}
          <ChevronRight className="size-4" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A trip's picture: your own photo of the place, else — with "Real photos" —
 * a credited photo of its town, else its painted scene.
 */
export function TripPicture({
  trip,
  photos,
  cities,
  className = "",
  creditAt = "bottom",
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  cities: string[];
  className?: string;
  /** Where a town photo's credit sits: clear of the words laid over the picture. */
  creditAt?: "top" | "bottom";
}) {
  const photo = pickTripPhoto(photos, { city: trip.city, country: trip.country, cities });
  const url = useSignedPhoto(photo?.storage_path ?? null);
  const town = useTownPicture(!!photo, trip.city || cities[0], trip.country);
  const art = bannerArtUrl(
    bannerSceneFor([trip.title, ...cities, trip.city, trip.country], trip.title || trip.city || ""),
  );
  return (
    <>
      <img
        src={url ?? town.photo?.url ?? art}
        alt=""
        decoding="async"
        referrerPolicy={town.photo ? "no-referrer" : undefined}
        onError={town.onError}
        className={`art-dim absolute inset-0 size-full object-cover ${className}`}
      />
      {town.photo ? (
        <TownPhotoCredit
          photo={town.photo}
          className={creditAt === "top" ? "top-0.5 bottom-auto" : ""}
        />
      ) : null}
    </>
  );
}

/**
 * Home's current or next trip, as the master draws it: a big painted (or
 * photographed) card, what kind of moment it is and how soon, the name in
 * large serif, dates and route, and a round arrow into the trip.
 */
export function HomeTripHero({
  trip,
  photos,
  peopleCount,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  peopleCount: number;
}) {
  const stops = useTripStops(trip.id, null);
  const cities = stops.stops.map((s) => s.city);
  const tags = heroTags(trip.start_date, trip.end_date, trip.dates_status === "tentative");
  const dates = tripDateLine(trip.start_date, trip.end_date);
  const where = routeLine(cities) || trip.city?.split(",")[0] || trip.country || "";

  return (
    <section data-guide="home-trip" className="rise">
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        aria-label={`${trip.title}: ${[tags.label, tags.when, dates, where].filter(Boolean).join(", ")}`}
        className="group relative block h-[208px] overflow-hidden rounded-[var(--r-card)] bg-[#2a2026] text-white shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{ viewTransitionName: `trip-photo-${trip.id}` }}
      >
        <TripPicture trip={trip} photos={photos} cities={cities} />
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(18,12,10,0.55), rgba(18,12,10,0.15) 55%, rgba(18,12,10,0) 75%), linear-gradient(to top, rgba(18,12,10,0.45), rgba(18,12,10,0) 45%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="flex items-center gap-1.5">
            <span className="rounded-full bg-white/92 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#28231f]">
              {tags.label}
            </span>
            {peopleCount > 1 ? (
              <span
                aria-label={`${peopleCount} people on this trip`}
                className="flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[11px] font-bold text-[#28231f]"
              >
                <Users className="size-3" aria-hidden />
                {peopleCount}
              </span>
            ) : null}
          </span>
          {tags.when ? (
            <span className="rounded-full bg-white/92 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary">
              {tags.when}
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="line-clamp-2 break-words font-display text-[44px] leading-[0.98] [text-shadow:0_1px_12px_rgba(0,0,0,0.35)]">
              {trip.title}
            </p>
            {dates ? <p className="mt-1 text-[14px] font-semibold">{dates}</p> : null}
            {where ? <p className="truncate text-[14px] text-white/90">{where}</p> : null}
          </div>
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/92 text-[#28231f] transition-transform group-hover:translate-x-0.5"
          >
            <ChevronRight className="size-5" />
          </span>
        </div>
      </Link>
    </section>
  );
}

/**
 * "Before Brazil · 3 things left": the trip's open to-dos in one line, and the
 * one due soonest. While the trip is on, the next thing on the plan instead.
 * Opens the to-do list.
 */
export function HomeBeforeTrip({
  trip,
  glance,
}: {
  trip: TripRow;
  glance: TripGlance | undefined;
}) {
  const underway = isUnderway(trip.start_date, trip.end_date);
  const open = glance?.todos.open ?? 0;
  const next = glance?.todos.next ?? null;
  const planned = underway ? nextOnPlan(glance?.items ?? [], toLocalISODate(new Date())) : null;

  if (underway && planned) {
    const when = [
      planned.day_date
        ? new Date(`${planned.day_date}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })
        : "",
      timeForRail(planned.time_label),
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <Row
        to={{ tripId: trip.id }}
        icon={<CalendarClock className="size-6" aria-hidden />}
        title={`Next: ${planned.title}`}
        note={when}
      />
    );
  }

  const title = `${underway ? "During" : "Before"} ${trip.title}`;
  const note =
    open === 0
      ? "Nothing left to do"
      : `${open} ${open === 1 ? "thing" : "things"} left${
          next
            ? ` · ${next.title}${dueLine(next.due_on) ? `, ${dueLine(next.due_on).toLowerCase()}` : ""}`
            : ""
        }`;
  return (
    <Row
      to={{ tripId: trip.id, prep: "todo" }}
      icon={<CircleCheck className="size-6" aria-hidden />}
      title={title}
      note={note}
    />
  );
}

function Row({
  to,
  icon,
  title,
  note,
}: {
  to: { tripId: string; prep?: "todo" };
  icon: ReactNode;
  title: string;
  note: string;
}) {
  return (
    <Link
      data-guide="home-next"
      to="/trips/$tripId"
      params={{ tripId: to.tripId }}
      search={to.prep ? { prep: to.prep } : {}}
      className="rise plain-card flex items-center gap-3 px-4 py-3 transition-shadow hover:shadow-md"
    >
      <span className="shrink-0 text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{title}</span>
        {note ? (
          <span className="block truncate text-[13px] text-muted-foreground">{note}</span>
        ) : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/**
 * Four ways into the trip: its itinerary, to-dos (with how many are open),
 * packing, and the places you saved. Each a pastel of its own in Colorful.
 */
export function HomeShortcuts({ trip, glance }: { trip: TripRow; glance: TripGlance | undefined }) {
  const open = glance?.todos.open ?? 0;
  const tile =
    "relative flex min-h-[78px] flex-col items-center justify-center gap-1.5 px-1 py-2.5 text-center text-[12px] font-semibold transition-shadow hover:shadow-md";
  const icon = "size-[22px] text-primary";
  return (
    <nav
      data-guide="home-shortcuts"
      aria-label="Trip shortcuts"
      className="rise grid grid-cols-4 gap-2"
    >
      <Link to="/trips/$tripId" params={{ tripId: trip.id }} className={`tile-card-3 ${tile}`}>
        <CalendarDays className={icon} aria-hidden />
        Itinerary
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={{ prep: "todo" }}
        className={`tile-card-5 ${tile}`}
        aria-label={open ? `To-do, ${open} open` : "To-do"}
      >
        <ListChecks className={icon} aria-hidden />
        To-do
        {open > 0 ? (
          <span
            aria-hidden
            className="absolute right-2 top-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-5 text-primary-foreground"
          >
            {open}
          </span>
        ) : null}
      </Link>
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        search={{ prep: "packing" }}
        className={`tile-card-1 ${tile}`}
      >
        <Luggage className={icon} aria-hidden />
        Packing
      </Link>
      <Link to="/recommendations" className={`tile-card-2 ${tile}`}>
        <Bookmark className={icon} aria-hidden />
        Saved places
      </Link>
    </nav>
  );
}

/**
 * "Your trips": the others, coming first and then the ones you're back from,
 * as small painted tiles in a row that scrolls sideways.
 */
export function HomeYourTrips({ trips, photos }: { trips: TripRow[]; photos: TripPhotoRow[] }) {
  if (trips.length === 0) return null;
  return (
    <section data-guide="home-past" className="rise">
      <HomeSectionTitle title="Your trips" aside={<Link to="/trips">All trips</Link>} />
      <div className="-mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {trips.map((t) => (
          <Link
            key={t.id}
            to="/trips/$tripId"
            params={{ tripId: t.id }}
            viewTransition
            className="relative block h-[112px] w-[31%] min-w-[108px] shrink-0 snap-start overflow-hidden rounded-[var(--r-image)] bg-[#2a2026] text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <TripPicture trip={t} photos={photos} cities={[]} creditAt="top" />
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(to top, rgba(18,12,10,0.7), rgba(18,12,10,0) 60%)",
              }}
            />
            <span className="absolute inset-x-0 bottom-0 p-2">
              <span className="line-clamp-2 block break-words font-display text-[19px] leading-[1.05]">
                {t.title}
              </span>
              <span className="block truncate text-[11.5px] text-white/90">
                {tripDateLine(t.start_date, t.end_date)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
