import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bed,
  CalendarDays,
  Car,
  ChevronRight,
  FileText,
  ListChecks,
  ListOrdered,
  Luggage,
  Map as MapIcon,
  MapPin,
  Plane,
  Ticket,
} from "@/components/icons";
import { SavedForTrip } from "@/components/SavedForTrip";
import type { ItineraryRow } from "@/hooks/useTrips";
import { useTripGlances } from "@/hooks/useTripGlances";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { companionState, companionStops } from "@/lib/companion";
import { routeStopOn } from "@/lib/import-stop";
import { isDayTrip, shortCity } from "@/lib/trip-cities";
import { parseLocalDate } from "@/lib/trip-dates";
import {
  beforeYouGoLine,
  bookingKind,
  cityStretches,
  countBookings,
  missingStays,
  overviewDayStatus,
  overviewMoment,
  stretchDates,
  tripBookings,
  unnamedStayNights,
  type BookingKind,
} from "@/lib/trip-overview";
import type { TripDocument } from "@/lib/trip-documents";
import type { TimelineDayGroup } from "@/lib/timeline-groups";
import type { PrepTab } from "@/components/TripPrep";

const KINDS: {
  kind: BookingKind;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { kind: "flight", label: "Flights", icon: Plane },
  { kind: "stay", label: "Stays", icon: Bed },
  { kind: "transport", label: "Transport", icon: Car },
  { kind: "activity", label: "Activities", icon: Ticket },
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
 * The trip at a glance, in the order the overview mockup sets: Right now
 * while the trip is underway, otherwise Before you go; then the days, the
 * booked strip, a missing stay, and places already saved. To-dos, packing,
 * the timeline, the map, documents and finding cities stay — a tile for
 * each, opening the same place it opened before.
 */
export function TripOverview({
  tripId,
  items,
  cities,
  country,
  onFindCities,
  findingCities = false,
  groups,
  days,
  route,
  bookingDocs,
  startDate,
  endDate,
  today,
  onOpenCompanion,
  onOpenBookings,
  onOpenTimeline,
  onOpenMap,
  onPrep,
}: {
  tripId: string;
  items: ItineraryRow[];
  /** The trip's destinations, in order. */
  cities: { city: string; country: string | null }[];
  /** The trip's own country, for a destination saved without one. */
  country?: string | null;
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
  startDate?: string | null;
  endDate?: string | null;
  /** YYYY-MM-DD on the phone, so Today is the traveller's day. */
  today: string;
  onOpenCompanion: () => void;
  /** The trip's bookings list, open on one kind, or every kind. */
  onOpenBookings: (kind: BookingKind | "all") => void;
  onOpenTimeline: (dayKey?: string) => void;
  onOpenMap: (dayKey: string) => void;
  onPrep: (tab: PrepTab) => void;
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
  const bookings = tripBookings(items, bookingDocs);
  const bookedByKind = countBookings(bookings);
  const booked = bookings.length;
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
  const clock = parseLocalDate(today) ?? new Date();
  const moment = overviewMoment(startDate, endDate, clock);
  const stretches = cityStretches(days, route, items);
  const undatedCities = route.filter((c) => !stretches.some((s) => s.city === c));
  const undated = items.filter((item) => !item.day_date).length;
  const placeCountry = (c: RouteCity) =>
    (c.country || c.city.split(",").slice(1).pop() || country || "").trim();
  const manyCountries = countries.size > 1;
  const dates = days.length ? `${days.length} ${days.length === 1 ? "day" : "days"}` : "No dates";
  const gaps = missingStays(stretches, items);
  const unnamedNights = unnamedStayNights(days, gaps, items);
  const flight = items
    .filter((item) => bookingKind(item) === "flight")
    .sort(
      (a, b) =>
        (a.day_date ?? "9999").localeCompare(b.day_date ?? "9999") || a.position - b.position,
    )[0];

  const essentials: {
    key: string;
    icon: ComponentType<{ className?: string }>;
    title: string;
    note: string;
    onClick: () => void;
  }[] = [
    ...(moment === "before"
      ? []
      : [
          {
            key: "todo",
            icon: ListChecks,
            title: "To-do",
            note: todos ? `${todos} left` : "All done",
            onClick: () => onPrep("todo"),
          },
          {
            key: "packing",
            icon: Luggage,
            title: "Packing",
            note: packing ? `${packing.packed} / ${packing.total}` : "No list yet",
            onClick: () => onPrep("packing"),
          },
        ]),
    {
      key: "timeline",
      icon: ListOrdered,
      title: "Timeline",
      note: `${items.length} ${items.length === 1 ? "stop" : "stops"}`,
      onClick: () => onOpenTimeline(),
    },
    {
      key: "map",
      icon: MapIcon,
      title: "Map",
      note: dated[0] ? "See the pins" : "No days yet",
      onClick: () => onOpenMap(dated[0]?.key ?? ""),
    },
  ];

  return (
    <div className="space-y-6">
      {moment === "now" ? (
        <RightNow items={items} today={today} onOpenCompanion={onOpenCompanion} />
      ) : null}
      {moment === "before" ? (
        <section aria-labelledby="before-you-go">
          <Head
            id="before-you-go"
            title="Before you go"
            aside={
              <span className="text-[14px] text-muted-foreground">
                {beforeYouGoLine(startDate, clock)}
              </span>
            }
          />
          <div className="grid grid-cols-3 gap-2">
            <Glance
              tone={1}
              icon={ListChecks}
              kicker="To-do"
              value={String(todos)}
              note={todos ? "left before you go" : "All done"}
              onClick={() => onPrep("todo")}
            />
            <Glance
              tone={2}
              icon={Plane}
              kicker="Flight"
              value={flight?.time_label?.trim() || "—"}
              note={flight ? flight.title : "None yet"}
              detail={flight?.day_date ? stretchDates(flight.day_date, flight.day_date) : undefined}
              onClick={() => onOpenBookings("flight")}
            />
            <Glance
              tone={3}
              icon={Luggage}
              kicker="Packing"
              value={packing ? `${packing.packed}/${packing.total}` : "—"}
              note={packing ? "ready" : "No list yet"}
              onClick={() => onPrep("packing")}
            />
          </div>
        </section>
      ) : null}

      <div className="plain-card flex divide-x divide-border py-3">
        <Stat icon={CalendarDays} value={dates} label={names.length ? names[0]! : "Trip"} />
        <Stat
          icon={MapPin}
          value={`${items.length} ${items.length === 1 ? "stop" : "stops"}`}
          label={where}
        />
        <Stat icon={Ticket} value={`${booked} booked`} label="Bookings" />
      </div>

      {onFindCities && names.length === 0 && (
        <div className="plain-card flex items-center justify-between gap-3 p-3.5">
          <p className="text-[16px] leading-snug text-muted-foreground">
            This trip has no cities yet. Béa can find them from your stops.
          </p>
          <button
            type="button"
            onClick={onFindCities}
            disabled={findingCities}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-3.5 text-[16px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {findingCities ? "Finding…" : "Find cities"}
          </button>
        </div>
      )}

      <section aria-labelledby="your-days">
        <Head
          id="your-days"
          title="Your days"
          aside={
            <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              <span className="text-[14px] text-muted-foreground">
                {dates}
                {items.length ? ` · ${items.length} ${items.length === 1 ? "stop" : "stops"}` : ""}
              </span>
              {dated[0] ? (
                <button
                  type="button"
                  onClick={() => onOpenMap(dated[0]!.key)}
                  className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-primary"
                >
                  <MapIcon className="size-4" aria-hidden />
                  See on map
                </button>
              ) : null}
            </span>
          }
        />
        {days.length === 0 && undatedCities.length === 0 ? (
          <p className="plain-card p-4 text-[16px] leading-snug text-muted-foreground">
            {items.length
              ? `${items.length} ${items.length === 1 ? "stop" : "stops"} with no dates yet. Give the trip its dates to see where you are each day.`
              : "Nothing planned yet. Add stops, or let Béa draft the days from a plan you already have."}
          </p>
        ) : (
          <div className="space-y-2">
            {days.map((day, i) => {
              const place = routeStopOn(route, day);
              const dayItems = items.filter((item) => item.day_date === day);
              const titles = companionStops(dayItems).map((item) => item.title);
              const status = overviewDayStatus(day, today, moment === "now", dayItems);
              const note = [
                place && isDayTrip(place) ? "Day trip" : "",
                place && manyCountries ? placeCountry(place) : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <DayCard
                  key={day}
                  picture={bannerArtUrl(
                    bannerSceneFor([place?.city, place?.country, country], place?.city || day),
                  )}
                  kicker={`Day ${i + 1} · ${stretchDates(day, day)}`}
                  title={place ? shortCity(place.city) : "No city set"}
                  note={note}
                  body={
                    titles.length
                      ? titles.join(" · ")
                      : dayItems.length
                        ? `${dayItems.length} ${dayItems.length === 1 ? "stop" : "stops"}`
                        : "Nothing planned yet"
                  }
                  status={status}
                  onClick={() => onOpenTimeline(day)}
                />
              );
            })}
            {undatedCities.map((c) => (
              <DayCard
                key={`city-${c.city}-${c.arrive_on ?? ""}`}
                picture={bannerArtUrl(bannerSceneFor([c.city, c.country], c.city))}
                kicker="No dates yet"
                title={shortCity(c.city)}
                note={isDayTrip(c) ? "Day trip" : ""}
                body="Give this city its dates to see its days."
                status={null}
                onClick={() => onOpenTimeline()}
              />
            ))}
            {undated ? (
              <button
                type="button"
                onClick={() => onOpenTimeline("")}
                className="plain-card flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-[16px] text-muted-foreground"
              >
                {undated} {undated === 1 ? "stop" : "stops"} without a day
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="booked-strip">
        <Head
          id="booked-strip"
          title="Booked"
          aside={
            <button
              type="button"
              onClick={() => onOpenBookings("all")}
              className="inline-flex min-h-11 items-center text-[14px] font-semibold text-primary"
            >
              All bookings
            </button>
          }
        />
        <div className="grid grid-cols-4 gap-2">
          {KINDS.map(({ kind, label, icon }, i) => {
            const row = byKind.get(kind);
            const bookedCount = bookedByKind[kind];
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onOpenBookings(kind)}
                className={`tile-card-${i + 1} flex min-h-20 flex-col items-center justify-center gap-0.5 px-1 py-2 text-center`}
              >
                <KindIcon icon={icon} />
                <span className="font-display text-[22px] leading-none">{bookedCount}</span>
                <span className="text-[13px] font-semibold leading-tight">{label}</span>
                <span className="text-[13px] leading-tight text-muted-foreground">
                  {bookedCount ? "booked" : row ? `${row.all} planned` : "None yet"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {gaps.map((gap) => (
        <StayGapNote
          key={gap.start}
          title={`No stay in ${gap.city} yet.`}
          detail={gap.nights === 1 ? "One night there." : `${gap.nights} nights there.`}
          onAdd={() => onOpenBookings("stay")}
        />
      ))}
      {unnamedNights > 0 ? (
        <StayGapNote
          title="No place to stay is on the plan yet."
          detail={
            unnamedNights === 1
              ? "One night on this trip."
              : `${unnamedNights} nights on this trip.`
          }
          onAdd={() => onOpenBookings("stay")}
        />
      ) : null}

      <section aria-labelledby="trip-essentials">
        <Head id="trip-essentials" title="Trip essentials" />
        <div className="grid grid-cols-3 gap-2">
          {essentials.map((e, i) => (
            <Tile
              key={e.key}
              icon={e.icon}
              title={e.title}
              note={e.note}
              onClick={e.onClick}
              tone={(i % 5) + 1}
            />
          ))}
          <Link
            to="/profile/documents"
            className={`tile-card-${(essentials.length % 5) + 1} ${TILE}`}
          >
            <FileText className="size-5 text-primary" aria-hidden />
            <TileText title="Travel docs" note="View details" />
          </Link>
        </div>
      </section>

      <SavedForTrip places={cities} country={country ?? null} />
    </div>
  );
}

function RightNow({
  items,
  today,
  onOpenCompanion,
}: {
  items: ItineraryRow[];
  today: string;
  onOpenCompanion: () => void;
}) {
  const stops = companionStops(items.filter((item) => item.day_date === today));
  const state = stops.length ? companionState(stops) : null;
  const focus =
    state?.phase === "at" ? state.current : state?.phase === "done" ? null : (state?.next ?? null);
  const index = focus ? stops.indexOf(focus) : Math.max(stops.length - 1, 0);
  const title =
    state?.phase === "done" ? "That's the day." : (focus?.title ?? "Nothing planned for today.");
  const time = focus?.time_label?.trim() ?? "";
  const kicker =
    state?.phase === "at"
      ? "You are here"
      : state?.phase === "between"
        ? "On the way"
        : state?.phase === "done"
          ? "Day done"
          : "First up";
  const next = state?.phase === "at" ? state.next : null;

  return (
    <section aria-labelledby="right-now">
      <Head
        id="right-now"
        title="Right now"
        aside={
          stops.length ? (
            <span className="text-[14px] text-muted-foreground">
              Stop {index + 1} of {stops.length}
            </span>
          ) : null
        }
      />
      <div className="plain-card p-3.5">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
          {kicker}
        </p>
        <h3 className="mt-1 font-display text-[28px] leading-[1.1]">{title}</h3>
        {time ? <p className="mt-1 text-[14px] text-muted-foreground">{time}</p> : null}
        {next ? (
          <p className="mt-3 text-[16px] leading-snug">
            <span className="font-semibold">
              Next · {next.time_label?.trim() ? `${next.time_label.trim()} ` : ""}
              {next.title}
            </span>
          </p>
        ) : null}
        <button type="button" onClick={onOpenCompanion} className="btn-primary mt-3 w-full">
          Open Companion
        </button>
      </div>
    </section>
  );
}

function StayGapNote({
  title,
  detail,
  onAdd,
}: {
  title: string;
  detail: string;
  onAdd: () => void;
}) {
  return (
    <div className="plain-card flex items-center gap-3 p-3.5">
      <Bed className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 text-[16px] leading-snug">
        <span className="font-semibold">{title}</span> {detail}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-card px-3.5 text-[16px] font-semibold"
      >
        Add
      </button>
    </div>
  );
}

function DayCard({
  picture,
  kicker,
  title,
  note,
  body,
  status,
  onClick,
}: {
  picture: string;
  kicker: string;
  title: string;
  note: string;
  body: string;
  status: "today" | "done" | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="plain-card relative flex min-h-24 w-full overflow-hidden text-left"
    >
      <span className="place-art relative block w-28 shrink-0 self-stretch">
        <img src={picture} alt="" className="absolute inset-0 size-full object-cover" />
      </span>
      <span className={`min-w-0 flex-1 py-2.5 pl-3 ${status ? "pr-16" : "pr-3"}`}>
        <span className="block text-[13px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          {kicker}
        </span>
        <span className="mt-0.5 block font-display text-[18px] leading-tight">{title}</span>
        {note ? (
          <span className="mt-0.5 block text-[14px] text-muted-foreground">{note}</span>
        ) : null}
        <span className="mt-1 line-clamp-2 text-[16px] leading-snug text-muted-foreground">
          {body}
        </span>
      </span>
      {status ? (
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[13px] font-semibold ${
            status === "today"
              ? "bg-primary text-primary-foreground"
              : "bg-elevated text-muted-foreground"
          }`}
        >
          {status === "today" ? "Today" : "Done"}
        </span>
      ) : null}
    </button>
  );
}

function Glance({
  tone,
  icon: Icon,
  kicker,
  value,
  note,
  detail,
  onClick,
}: {
  tone: number;
  icon: ComponentType<{ className?: string }>;
  kicker: string;
  value: string;
  note: string;
  detail?: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tile-card-${tone} flex min-h-28 flex-col items-start gap-1 p-2.5 text-left`}
    >
      <span className="flex items-center gap-1 text-[13px] font-semibold">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        {kicker}
      </span>
      <span className="font-display text-[22px] leading-none">{value}</span>
      <span className="text-[14px] leading-snug text-muted-foreground">{note}</span>
      {detail ? <span className="text-[13px] text-muted-foreground">{detail}</span> : null}
    </button>
  );
}

function KindIcon({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return <Icon className="size-4 text-foreground" aria-hidden />;
}

function Head({ id, title, aside }: { id?: string; title: string; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 id={id} className="font-display text-[22px] leading-tight">
        {title}
      </h2>
      {aside}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
      <Icon className="size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 leading-tight">
        <span className="block text-[16px] font-semibold leading-tight">{value}</span>
        <span className="block text-[14px] leading-tight text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

/** A tile in the essentials grid: three across, the same size each. */
const TILE = "flex min-h-24 min-w-0 flex-col justify-between gap-2 p-2.5 text-left";

function TileText({ title, note }: { title: string; note: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[16px] font-semibold leading-tight">{title}</span>
      <span className="block text-[14px] leading-tight text-muted-foreground">{note}</span>
    </span>
  );
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
    <button type="button" onClick={onClick} className={`tile-card-${tone} ${TILE}`}>
      <Icon className="size-5 text-primary" aria-hidden />
      <TileText title={title} note={note} />
    </button>
  );
}
