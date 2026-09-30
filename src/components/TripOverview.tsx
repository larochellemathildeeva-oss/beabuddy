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
import type { ItineraryRow } from "@/hooks/useTrips";
import { useTripGlances } from "@/hooks/useTripGlances";
import {
  bookingKind,
  cityStretches,
  countBookings,
  stretchDates,
  tripBookings,
  type BookingKind,
} from "@/lib/trip-overview";
import type { TripDocument } from "@/lib/trip-documents";
import { isDayTrip, shortCity } from "@/lib/trip-cities";
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
 * The trip at a glance: bookings by kind, prep, documents, and a recap of
 * where the trip is when (a line per city, with its days), not every stop.
 * Every tile opens something that exists — the Timeline for a kind of
 * booking, the to-do and packing sheet, every stop on the Timeline or map.
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
  /** The trip's bookings list, open on one kind. */
  onOpenBookings: (kind: BookingKind) => void;
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

  const stretches = cityStretches(days, route, items);
  // Cities with no dates at all have no stretch: listed after, so none is lost.
  const undatedCities = route.filter((c) => !stretches.some((s) => s.city === c));
  const undated = items.filter((item) => !item.day_date).length;
  const placeCountry = (c: RouteCity) =>
    (c.country || c.city.split(",").slice(1).pop() || country || "").trim();
  const manyCountries = countries.size > 1;
  const dates = days.length ? `${days.length} ${days.length === 1 ? "day" : "days"}` : "No dates";
  const essentials: {
    key: string;
    icon: ComponentType<{ className?: string }>;
    title: string;
    note: string;
    onClick: () => void;
  }[] = [
    ...KINDS.map(({ kind, label, icon }) => {
      const row = byKind.get(kind);
      const bookedCount = bookedByKind[kind];
      return {
        key: kind,
        icon,
        title: label,
        note: bookedCount ? `${bookedCount} booked` : row ? `${row.all} planned` : "None yet",
        onClick: () => onOpenBookings(kind),
      };
    }),
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
          <p className="text-[13.5px] text-muted-foreground">
            This trip has no cities yet. Béa can find them from your stops.
          </p>
          <button
            type="button"
            onClick={onFindCities}
            disabled={findingCities}
            className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {findingCities ? "Finding…" : "Find cities"}
          </button>
        </div>
      )}

      <section>
        <Head title="Trip essentials" />
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

      <section>
        <Head
          title="Your itinerary"
          aside={
            dated[0] ? (
              <button
                type="button"
                onClick={() => onOpenMap(dated[0]!.key)}
                className="flex items-center gap-1 text-[14px] font-semibold text-primary"
              >
                <MapIcon className="size-4" aria-hidden />
                See on map
                <ChevronRight className="size-4" aria-hidden />
              </button>
            ) : null
          }
        />
        {stretches.length === 0 && undatedCities.length === 0 ? (
          <p className="plain-card p-4 text-[14px] text-muted-foreground">
            {items.length
              ? `${items.length} ${items.length === 1 ? "stop" : "stops"} with no dates yet. Give the trip its dates to see where you are each day.`
              : "Nothing planned yet. Add stops, or let Béa draft the days from a plan you already have."}
          </p>
        ) : (
          <div className="plain-card divide-y divide-border overflow-hidden">
            {stretches.map((s, i) => {
              const days =
                s.firstDay === s.lastDay ? `Day ${s.firstDay}` : `Days ${s.firstDay}–${s.lastDay}`;
              const note = [
                s.city && isDayTrip(s.city) ? "Day trip" : "",
                s.city && manyCountries ? placeCountry(s.city) : "",
                s.stops ? `${s.stops} ${s.stops === 1 ? "stop" : "stops"}` : "Nothing planned yet",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => onOpenTimeline(s.start)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left"
                >
                  <span
                    className={`seq-${(i % 5) + 1} grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-bold`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[20px] leading-tight">
                      {s.city ? shortCity(s.city.city) : "No city set"}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {note}
                    </span>
                  </span>
                  <span className="shrink-0 text-right leading-tight">
                    <span className="block text-[13.5px] font-semibold">{days}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      {stretchDates(s.start, s.end)}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              );
            })}
            {undatedCities.map((c, i) => (
              <button
                key={`${c.city}-${i}`}
                type="button"
                onClick={() => onOpenTimeline()}
                className="flex w-full items-center gap-3 px-3 py-3 text-left"
              >
                <span
                  className={`seq-${((stretches.length + i) % 5) + 1} grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-bold`}
                >
                  {stretches.length + i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[20px] leading-tight">
                  {shortCity(c.city)}
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground">No dates yet</span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
            {undated ? (
              <button
                type="button"
                onClick={() => onOpenTimeline("")}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] text-muted-foreground"
              >
                {undated} {undated === 1 ? "stop" : "stops"} without a day
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function Head({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-display text-[27px] leading-none">{title}</h2>
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
    <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
      <Icon className="size-6 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[14px] font-semibold">{value}</span>
        <span className="block truncate text-[12px] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

/** A tile in the essentials grid: three across, the same size each. */
const TILE = "flex min-h-[84px] min-w-0 flex-col justify-between gap-2 p-2.5 text-left";

function TileText({ title, note }: { title: string; note: string }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-[13.5px] font-semibold leading-tight">{title}</span>
      <span className="block truncate text-[11.5px] text-muted-foreground">{note}</span>
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
      <Icon className="size-5 text-primary" />
      <TileText title={title} note={note} />
    </button>
  );
}
