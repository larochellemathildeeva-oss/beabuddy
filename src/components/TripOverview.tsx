import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bed,
  ChevronRight,
  FileText,
  Heart,
  ListChecks,
  ListOrdered,
  Luggage,
  Map as MapIcon,
  Plane,
  Ticket,
  Car,
} from "@/components/icons";
import type { ItineraryRow } from "@/hooks/useTrips";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useTripGlances } from "@/hooks/useTripGlances";
import { PlacePicture } from "@/components/PlacePicture";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { companionState, companionStops, isDone, type CompanionState } from "@/lib/companion";
import { currentHighlights } from "@/lib/home-trip";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { timelineGlyph } from "@/lib/timeline-kind";
import { tripIsUnderway } from "@/lib/trip-perspective";
import {
  bookingKind,
  cityStretches,
  countBookings,
  leavingIn,
  missingStays,
  placesForTrip,
  stretchDates,
  tripBookings,
  type BookingKind,
} from "@/lib/trip-overview";
import { isDayTrip, shortCity } from "@/lib/trip-cities";
import type { TripDocument } from "@/lib/trip-documents";
import type { TimelineDayGroup } from "@/lib/timeline-groups";
import type { PrepTab } from "@/components/TripPrep";

const KINDS: {
  kind: BookingKind;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: number;
}[] = [
  { kind: "flight", label: "Flights", icon: Plane, tone: 2 },
  { kind: "stay", label: "Stays", icon: Bed, tone: 3 },
  { kind: "transport", label: "Transport", icon: Car, tone: 4 },
  { kind: "activity", label: "Activities", icon: Ticket, tone: 1 },
];

/** A city on the trip's route, as the recap reads it. */
type RouteCity = {
  city: string;
  country?: string | null;
  kind?: string | null;
  arrive_on?: string | null;
  depart_on?: string | null;
};

/**
 * The trip at a glance, in the order the trip page asks for: what is
 * happening now (or what is left before you leave), the days, what is
 * booked, then the places saved for these cities.
 *
 * Every tile still opens something that exists — Companion, the Timeline,
 * the map, bookings, to-dos, packing, Trip documents, Saved places.
 */
export function TripOverview({
  tripId,
  items,
  cities,
  country,
  homeCity,
  today,
  startDate,
  endDate,
  onFindCities,
  findingCities = false,
  groups,
  days,
  route,
  bookingDocs,
  bookingsOpen,
  onToggleBookings,
  onOpenBookings,
  onOpenTimeline,
  onOpenMap,
  onOpenCompanion,
  onOpenSaved,
  onPrep,
  bookings,
  travellers = [],
}: {
  tripId: string;
  items: ItineraryRow[];
  /** The trip's destinations, in order. */
  cities: { city: string; country: string | null }[];
  /** The trip's own country, for a destination saved without one. */
  country?: string | null;
  /** The trip's starting city, so saved places match before destinations exist. */
  homeCity?: string | null;
  today: string;
  startDate?: string | null;
  endDate?: string | null;
  /** Offered when the trip has stops with pins but no destinations. */
  onFindCities?: (() => void) | undefined;
  findingCities?: boolean | undefined;
  groups: TimelineDayGroup<ItineraryRow>[];
  /** Every day of the trip, in order, empty days too. */
  days: string[];
  /** The cities the trip moves between, day trips included. */
  route: RouteCity[];
  /** Trip documents filed to this trip: they are bookings too. */
  bookingDocs: TripDocument[];
  bookingsOpen: boolean;
  onToggleBookings: () => void;
  /** The trip's bookings list, open on one kind. */
  onOpenBookings: (kind: BookingKind) => void;
  onOpenTimeline: (dayKey?: string) => void;
  onOpenMap: (dayKey: string) => void;
  onOpenCompanion: () => void;
  onOpenSaved: () => void;
  onPrep: (tab: PrepTab) => void;
  /** The bookings list, shown under the booked strip when it is open. */
  bookings?: ReactNode;
  /** Names of everyone on the trip. */
  travellers?: string[];
}) {
  const { glances } = useTripGlances([tripId]);
  const glance = glances[tripId];
  const byKind = new Map<BookingKind, { all: number; booked: number }>();
  for (const item of items) {
    const kind = bookingKind(item);
    if (!kind) continue;
    const row = byKind.get(kind) ?? { all: 0, booked: 0 };
    row.all += 1;
    if (item.booked) row.booked += 1;
    byKind.set(kind, row);
  }
  const bookingsAll = tripBookings(items, bookingDocs);
  const bookedByKind = countBookings(bookingsAll);
  const booked = bookingsAll.length;
  const names = [
    ...new Set(cities.map((c) => (c.city.split(",")[0] ?? "").trim()).filter(Boolean)),
  ];
  const countries = new Set(
    cities
      .map((c) => (c.country || c.city.split(",").slice(1).pop() || country || "").trim())
      .filter(Boolean)
      .map((c) => c.toLowerCase()),
  );
  const where = names.length
    ? [
        `${names.length} ${names.length === 1 ? "city" : "cities"}`,
        countries.size ? `${countries.size} ${countries.size === 1 ? "country" : "countries"}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "No cities yet";
  const todos = glance?.todos.open ?? 0;
  const packing = glance?.packing;
  const dated = groups.filter((g) => g.key);
  const stretches = cityStretches(days, route, items);
  const undatedCities = route.filter((c) => !stretches.some((s) => s.city === c));
  const undated = items.filter((item) => !item.day_date).length;
  const placeCountry = (c: RouteCity) =>
    (c.country || c.city.split(",").slice(1).pop() || country || "").trim();
  const manyCountries = countries.size > 1;
  const dates = days.length ? `${days.length} ${days.length === 1 ? "day" : "days"}` : "No dates";
  const facts = [
    dates,
    `${items.length} ${items.length === 1 ? "stop" : "stops"}`,
    where,
    `${booked} booked`,
  ].join(" · ");

  const live = tripIsUnderway({ start_date: startDate, end_date: endDate }, today);
  const end = endDate || startDate || "";
  const past = Boolean(end && today > end);
  const ahead = !live && !past;
  const byDay = new Map(groups.map((group) => [group.key, group.items]));
  const todayStops = companionStops(byDay.get(today) ?? []);
  const now = companionState(todayStops);
  const lodgingItems = items.filter((item) => timelineGlyph(item) === "lodging");
  const gaps = missingStays(
    days,
    stretches,
    lodgingItems.flatMap((item) => (item.day_date ? [item.day_date] : [])),
    lodgingItems.length > 0 || bookedByKind.stay > 0,
  );
  const flight = currentHighlights(items, today).flight;
  const savedCities = [homeCity, ...cities.map((c) => c.city)].filter((city): city is string =>
    Boolean(city?.trim()),
  );

  const prepTiles = [
    {
      key: "todo",
      icon: ListChecks,
      title: "To-do",
      note: todos ? `${todos} left` : "All done",
      onClick: () => onPrep("todo"),
      tone: 5,
    },
    {
      key: "packing",
      icon: Luggage,
      title: "Packing",
      note: packing ? `${packing.packed} / ${packing.total}` : "No list yet",
      onClick: () => onPrep("packing"),
      tone: 4,
    },
  ];
  const toolTiles = [
    ...(ahead ? [] : prepTiles),
    {
      key: "timeline",
      icon: ListOrdered,
      title: "Timeline",
      note: `${items.length} ${items.length === 1 ? "stop" : "stops"}`,
      onClick: () => onOpenTimeline(),
      tone: 1,
    },
    {
      key: "map",
      icon: MapIcon,
      title: "Map",
      note: dated[0] ? "See the pins" : "No days yet",
      onClick: () => onOpenMap(dated[0]?.key ?? ""),
      tone: 2,
    },
  ];

  // The day the trip is on (0 before it starts, all of them once it is over).
  const dayNo = days.length
    ? Math.max(0, Math.min(days.length, days.filter((d) => d <= today).length))
    : 0;
  const upcoming = groups
    .filter((g) => g.key && g.key >= today)
    .flatMap((g) => g.items)
    .filter((item) => timelineGlyph(item) !== "lodging" && !isDone(item));
  const nextStop = upcoming[0];
  const highlights = upcoming.slice(0, 6);

  return (
    <div className="space-y-6">
      {days.length > 0 && (
        <div className="-mt-1 grid grid-cols-2 gap-3 overview-glance">
          <section className="overview-card col-span-2 flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Trip progress</p>
              <p className="mt-1 font-display text-[24px] leading-none">
                {dayNo} of {days.length} days
              </p>
              <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-elevated">
                <span
                  className="block h-full rounded-full bg-foreground"
                  style={{ width: `${Math.round((dayNo / days.length) * 100)}%` }}
                />
              </span>
            </div>
            {nextStop ? (
              <button
                type="button"
                onClick={() => onOpenTimeline(nextStop.day_date ?? undefined)}
                className="flex min-w-0 flex-1 items-center gap-2.5 border-s border-border ps-4 text-left"
              >
                <PlacePicture
                  name={nextStop.title}
                  kind={nextStop.kind}
                  lat={nextStop.lat}
                  lon={nextStop.lon}
                  className="size-12 shrink-0 rounded-xl"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-muted-foreground">Next up</span>
                  <span className="block truncate font-display text-[17px] leading-tight">
                    {nextStop.title}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {nextStop.day_date ? formatTimelineDayLabel(nextStop.day_date) : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </button>
            ) : null}
          </section>
          {travellers.length > 0 && (
            <section className="overview-card col-span-2 flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-[14px] font-semibold">Travellers</p>
                <p className="text-[13px] text-muted-foreground">
                  {travellers.length} {travellers.length === 1 ? "person" : "people"}
                </p>
              </div>
              <div className="flex -space-x-2">
                {travellers.slice(0, 5).map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    title={name}
                    className={`grid size-10 place-items-center rounded-full border-2 border-card text-[15px] font-semibold tile-fill-${(i % 5) + 1}`}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      {highlights.length > 0 && (
        <section>
          <SectionHead title="Upcoming highlights" />
          <ul className="no-scrollbar -mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-1">
            {highlights.map((item) => (
              <li key={item.id} className="w-[132px] shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => onOpenTimeline(item.day_date ?? undefined)}
                  className="relative block h-[128px] w-full overflow-hidden rounded-2xl text-left text-white"
                >
                  <PlacePicture
                    name={item.title}
                    kind={item.kind}
                    lat={item.lat}
                    lon={item.lon}
                    className="absolute inset-0 size-full"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
                  />
                  <span className="absolute inset-x-2.5 bottom-2 block">
                    <span className="line-clamp-2 block text-[14px] font-semibold leading-tight">
                      {item.title}
                    </span>
                    <span className="block text-[12px] text-white/80">
                      {item.day_date ? formatTimelineDayLabel(item.day_date) : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {live ? (
        <RightNow state={now} onOpenCompanion={onOpenCompanion} />
      ) : past ? (
        <SectionHead title="This trip" aside={facts} />
      ) : (
        <section>
          <SectionHead title="Before you go" aside={leavingIn(startDate, today) || undefined} />
          <div className="grid grid-cols-3 gap-2">
            <GlanceCard
              tone={5}
              icon={ListChecks}
              label="To-do"
              value={String(todos)}
              note={todos ? "before you go" : "All done"}
              onClick={() => onPrep("todo")}
            />
            <GlanceCard
              tone={2}
              icon={Plane}
              label={flight ? flight.title : "Flight"}
              value={
                flight?.time_label && /^\d{1,2}:\d{2}/.test(flight.time_label)
                  ? flight.time_label
                  : ""
              }
              note={
                flight
                  ? [flight.detail, flight.day_date ? formatTimelineDayLabel(flight.day_date) : ""]
                      .filter(Boolean)
                      .join(" · ") || "On the plan"
                  : "No flight yet"
              }
              onClick={() => onOpenBookings("flight")}
            />
            <GlanceCard
              tone={4}
              icon={Luggage}
              label="Packing"
              value={packing ? `${packing.packed}/${packing.total}` : ""}
              note={packing ? "ready" : "No list yet"}
              ratio={packing?.ratio}
              onClick={() => onPrep("packing")}
            />
          </div>
        </section>
      )}

      {!past && <p className="text-[14px] leading-snug text-muted-foreground">{facts}</p>}

      {onFindCities && names.length === 0 && (
        <div className="plain-card flex items-center justify-between gap-3 p-3.5">
          <p className="text-[16px] leading-snug text-muted-foreground">
            This trip has no cities yet. Béa can find them from your stops.
          </p>
          <button
            type="button"
            onClick={onFindCities}
            disabled={findingCities}
            className="btn-primary shrink-0 px-4 disabled:opacity-60"
          >
            {findingCities ? "Finding…" : "Find cities"}
          </button>
        </div>
      )}

      <section>
        <SectionHead
          title="Your days"
          aside={
            dated[0] ? (
              <button
                type="button"
                onClick={() => onOpenMap(dated[0]!.key)}
                className="inline-flex min-h-11 items-center gap-1 text-[16px] font-semibold text-primary"
              >
                <MapIcon className="size-4" aria-hidden />
                See on map
              </button>
            ) : (
              <span className="text-[14px] text-muted-foreground">
                {days.length} {days.length === 1 ? "day" : "days"} · {items.length}{" "}
                {items.length === 1 ? "stop" : "stops"}
              </span>
            )
          }
        />
        {stretches.length === 0 && undatedCities.length === 0 ? (
          <p className="plain-card p-4 text-[16px] leading-snug text-muted-foreground">
            {items.length
              ? `${items.length} ${items.length === 1 ? "stop" : "stops"} with no dates yet. Give the trip its dates to see where you are each day.`
              : "Nothing planned yet. Add stops, or let Béa draft the days from a plan you already have."}
          </p>
        ) : (
          <div className="space-y-2">
            {days.map((day, index) => {
              const stretch = stretches.find((s) => day >= s.start && day <= s.end);
              const place = stretch?.city ?? null;
              const dayItems = byDay.get(day) ?? [];
              const stops = companionStops(dayItems);
              const shown = stops.length ? stops : dayItems;
              const mark = dayMark(day, today, live, stops);
              const note = [
                place && isDayTrip(place) ? "Day trip" : "",
                place && manyCountries ? placeCountry(place) : "",
              ]
                .filter(Boolean)
                .join(" · ");
              const cityLabel = place ? shortCity(place.city) : "No city set";
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onOpenTimeline(day)}
                  className="plain-card relative flex w-full overflow-hidden text-left"
                >
                  <img
                    src={bannerArtUrl(
                      bannerSceneFor(
                        [place?.city, place?.country, country, homeCity],
                        place?.city || day,
                      ),
                    )}
                    alt=""
                    className="h-auto w-24 shrink-0 object-cover sm:w-28"
                  />
                  <span className="min-w-0 flex-1 px-3 py-3 pr-16">
                    <span className="label-caps block">
                      Day {index + 1} · {formatTimelineDayLabel(day)}
                    </span>
                    <span className="mt-1 block font-display text-[18px] leading-tight">
                      {cityLabel}
                    </span>
                    <span className="mt-1 line-clamp-2 text-[16px] leading-snug text-muted-foreground">
                      {shown.length
                        ? shown.map((stop) => stop.title).join(" · ")
                        : "Nothing planned yet"}
                    </span>
                    {note ? (
                      <span className="mt-1 block text-[14px] text-muted-foreground">{note}</span>
                    ) : null}
                  </span>
                  {mark ? (
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                        mark === "Today"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {mark}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {undatedCities.map((c) => (
              <button
                key={`${c.city}-${c.arrive_on ?? ""}`}
                type="button"
                onClick={() => onOpenTimeline()}
                className="plain-card flex min-h-11 w-full items-center gap-3 px-3 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[18px] leading-tight">
                    {shortCity(c.city)}
                  </span>
                  <span className="block text-[14px] text-muted-foreground">
                    {[
                      isDayTrip(c) ? "Day trip" : "",
                      manyCountries ? placeCountry(c) : "",
                      "No dates yet",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
            {undated ? (
              <button
                type="button"
                onClick={() => onOpenTimeline("")}
                className="plain-card flex min-h-11 w-full items-center justify-between gap-3 px-3 py-3 text-left text-[16px] text-muted-foreground"
              >
                {undated} {undated === 1 ? "stop" : "stops"} without a day
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section>
        <SectionHead
          title="Booked"
          aside={
            <button
              type="button"
              aria-expanded={bookingsOpen}
              aria-label={`Booked · ${booked}`}
              onClick={onToggleBookings}
              className="inline-flex min-h-11 items-center text-[16px] font-semibold text-primary"
            >
              All bookings
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map(({ kind, label, icon, tone }) => {
            const row = byKind.get(kind);
            const bookedCount = bookedByKind[kind];
            const note = bookedCount
              ? `${bookedCount} booked`
              : row
                ? `${row.all} planned`
                : "None yet";
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onOpenBookings(kind)}
                className={`tile-card-${tone} flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 py-2 text-center`}
              >
                <KindIcon icon={icon} />
                <span className="font-display text-[22px] leading-none">{bookedCount}</span>
                <span className="text-[16px] font-semibold leading-tight">{label}</span>
                <span className="text-[13px] leading-tight text-muted-foreground">{note}</span>
              </button>
            );
          })}
        </div>
        {gaps.length > 0 && (
          <div className="mt-2 space-y-2">
            {gaps.map((gap) => (
              <div
                key={`${gap.city ?? "trip"}-${gap.start ?? ""}`}
                className="plain-card flex items-start gap-3 p-3"
              >
                <Bed className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <p className="min-w-0 flex-1 text-[16px] leading-snug">
                  <span className="font-semibold">
                    {gap.city
                      ? `No stay in ${shortCity(gap.city)} yet.`
                      : "No place to stay is on the plan yet."}
                  </span>
                  {gap.start ? (
                    <span className="mt-0.5 block text-[14px] text-muted-foreground">
                      {stretchDates(gap.start, gap.end ?? gap.start)}
                    </span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenBookings("stay")}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-card px-3 text-[16px] font-semibold"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
        {bookings ? <div className="mt-3">{bookings}</div> : null}
      </section>

      <section>
        <SectionHead title="Trip essentials" />
        <div className="grid grid-cols-2 gap-2">
          {toolTiles.map(({ key, ...tile }) => (
            <Tile key={key} {...tile} />
          ))}
          <Link
            to="/profile/documents"
            className={`tile-card-${(toolTiles.length % 5) + 1} flex min-h-16 flex-col justify-between gap-2 p-3 text-left`}
          >
            <FileText className="size-5 text-primary" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[16px] font-semibold leading-tight">Travel docs</span>
              <span className="block text-[14px] text-muted-foreground">View details</span>
            </span>
          </Link>
        </div>
      </section>

      <SavedForTrip cities={savedCities} onOpen={onOpenSaved} />
    </div>
  );
}

function dayMark(
  day: string,
  today: string,
  live: boolean,
  stops: readonly { arrived_at?: string | null; left_at?: string | null }[],
): "Today" | "Done" | null {
  const done = stops.length > 0 && stops.every((stop) => isDone(stop));
  if (done && day <= today) return "Done";
  if (day === today && live) return "Today";
  return null;
}

function RightNow({
  state,
  onOpenCompanion,
}: {
  state: CompanionState<ItineraryRow>;
  onOpenCompanion: () => void;
}) {
  const { phase, current, next, reached, total } = state;
  const focus = phase === "at" ? current : phase === "done" ? null : next;
  const kicker =
    phase === "at"
      ? "You are here"
      : phase === "between"
        ? "On the way"
        : phase === "done"
          ? "That's the day."
          : "Up next";
  const title =
    phase === "done" ? "Every stop is reached." : focus ? focus.title : "Nothing on today's plan.";
  const time =
    phase === "between" && next?.time_label
      ? `arrive ${next.time_label}`
      : phase === "at" || phase === "not-started"
        ? (focus?.time_label ?? "")
        : "";

  return (
    <section>
      <SectionHead
        title="Right now"
        aside={
          total > 0 ? (
            <span className="text-[14px] text-muted-foreground">
              {reached} of {total} reached
            </span>
          ) : null
        }
      />
      <div className="plain-card p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
          <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          {kicker}
          {time ? (
            <span className="ml-auto text-[14px] font-medium normal-case tracking-normal text-muted-foreground">
              {time}
            </span>
          ) : null}
        </p>
        <h3 className="mt-2 font-display text-[22px] leading-tight">{title}</h3>
        {phase === "at" && next ? (
          <p className="mt-3 text-[16px] leading-snug">
            <span className="font-semibold">
              Next · {next.time_label ? `${next.time_label} ` : ""}
              {next.title}
            </span>
          </p>
        ) : null}
        <button type="button" onClick={onOpenCompanion} className="btn-primary mt-3 px-4">
          Open Companion
        </button>
      </div>
    </section>
  );
}

function GlanceCard({
  tone,
  icon: Icon,
  label,
  value,
  note,
  ratio,
  onClick,
}: {
  tone: number;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
  ratio?: number | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tile-card-${tone} flex min-h-28 flex-col items-start p-3 text-left`}
    >
      <span className="flex items-center gap-1.5 text-[16px] font-semibold leading-tight">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="line-clamp-2">{label}</span>
      </span>
      {value ? <span className="mt-1 font-display text-[28px] leading-none">{value}</span> : null}
      <span className="mt-1 text-[14px] leading-snug text-muted-foreground">{note}</span>
      {typeof ratio === "number" ? (
        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-[var(--acc-track)]">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </span>
      ) : null}
    </button>
  );
}

function SavedForTrip({ cities, onOpen }: { cities: string[]; onOpen: () => void }) {
  const { rows, loading } = useRecommendations();
  const matched = placesForTrip(rows, cities);
  const shown = matched.slice(0, 6);
  return (
    <section>
      <SectionHead
        title="Saved for this trip"
        aside={
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-11 items-center gap-1 text-[16px] font-semibold text-primary"
          >
            See all
            <ChevronRight className="size-4" aria-hidden />
          </button>
        }
      />
      {loading ? (
        <p className="text-[16px] text-muted-foreground">Loading your places…</p>
      ) : shown.length === 0 ? (
        <p className="plain-card p-4 text-[16px] leading-snug text-muted-foreground">
          No saved places in these cities yet. Save places in{" "}
          <Link to="/recommendations" className="font-semibold text-primary">
            Recs
          </Link>{" "}
          and they show up here.
        </p>
      ) : (
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {shown.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={onOpen}
              className="w-28 shrink-0 text-left"
            >
              <span className="relative block">
                <PlacePicture
                  name={place.name}
                  category={place.category}
                  lat={place.lat}
                  lon={place.lon}
                  className="h-24 w-28 rounded-2xl"
                />
                <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-card shadow-xs">
                  <Heart className="size-3.5 text-primary" aria-hidden />
                </span>
              </span>
              <span className="mt-1 line-clamp-2 block text-[16px] font-semibold leading-snug">
                {place.name}
              </span>
              {place.city ? (
                <span className="block text-[14px] text-muted-foreground">{place.city}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[22px] leading-tight">{title}</h2>
      {aside}
    </div>
  );
}

function KindIcon({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return <Icon className="size-4 text-foreground" aria-hidden />;
}

function Tile({
  icon: Icon,
  title,
  note,
  tone,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  note: string;
  tone: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tile-card-${tone} flex min-h-16 flex-col justify-between gap-2 p-3 text-left`}
    >
      <Icon className="size-5 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block text-[16px] font-semibold leading-tight">{title}</span>
        <span className="block text-[14px] text-muted-foreground">{note}</span>
      </span>
    </button>
  );
}
