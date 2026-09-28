import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bed,
  CalendarDays,
  Car,
  ChevronRight,
  FileText,
  ListChecks,
  Luggage,
  Map as MapIcon,
  MapPin,
  Plane,
  Ticket,
} from "@/components/icons";
import type { ItineraryRow } from "@/hooks/useTrips";
import { useTripGlances } from "@/hooks/useTripGlances";
import { bookingKind, type BookingKind } from "@/lib/trip-overview";
import { PlacePicture } from "@/components/PlacePicture";
import { timeForRail } from "@/lib/timeline-kind";
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

/**
 * The trip at a glance, as the master's Trip Overview: the route, bookings by
 * kind, prep, documents, and the days with their first stops. Every tile opens
 * something that exists — the Timeline for a kind of booking, the to-do and
 * packing sheet, the day on the map.
 */
export function TripOverview({
  tripId,
  items,
  cities,
  groups,
  onOpenTimeline,
  onOpenMap,
  onPrep,
}: {
  tripId: string;
  items: ItineraryRow[];
  cities: string[];
  groups: TimelineDayGroup<ItineraryRow>[];
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
  const booked = items.filter((i) => i.booked).length;
  const names = [...new Set(cities.map((c) => (c.split(",")[0] ?? "").trim()).filter(Boolean))];
  const todos = glance?.todos.open ?? 0;
  const packing = glance?.packing;
  const dated = groups.filter((g) => g.key);

  const dates = dated.length
    ? `${dated.length} ${dated.length === 1 ? "day" : "days"}`
    : "No dates";
  const essentials: {
    key: string;
    icon: ComponentType<{ className?: string }>;
    title: string;
    note: string;
    onClick: () => void;
  }[] = [
    ...KINDS.map(({ kind, label, icon }) => {
      const row = byKind.get(kind);
      return {
        key: kind,
        icon,
        title: label,
        note: row ? `${row.booked || row.all} ${row.booked ? "booked" : "planned"}` : "None yet",
        onClick: () => onOpenTimeline(),
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
  ];
  // The itinerary, numbered across the trip, as the master lists it.
  let n = 0;

  return (
    <div className="space-y-6">
      <div className="plain-card flex divide-x divide-border py-3">
        <Stat icon={CalendarDays} value={dates} label={names.length ? names[0]! : "Trip"} />
        <Stat
          icon={MapPin}
          value={`${items.length} ${items.length === 1 ? "stop" : "stops"}`}
          label={`${names.length || 0} ${names.length === 1 ? "place" : "places"}`}
        />
        <Stat icon={Ticket} value={`${booked} booked`} label="Bookings" />
      </div>

      <section>
        <Head title="Trip essentials" />
        <div className="-mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
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
            className="tile-card-3 flex min-h-[92px] w-[132px] shrink-0 snap-start flex-col justify-between p-3"
          >
            <FileText className="size-6 text-primary" aria-hidden />
            <span>
              <span className="block text-[14.5px] font-semibold">Travel docs</span>
              <span className="block text-[12px] text-muted-foreground">View details</span>
            </span>
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
        {groups.length === 0 ? (
          <p className="plain-card p-4 text-[14px] text-muted-foreground">
            Nothing planned yet. Add stops, or let Béa draft the days from a plan you already have.
          </p>
        ) : (
          <div className="plain-card divide-y divide-border overflow-hidden">
            {groups.map((group) =>
              group.items.map((item) => {
                n += 1;
                const when = [
                  group.key
                    ? new Date(`${group.key}T00:00:00`).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : "",
                  timeForRail(item.time_label),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenTimeline(group.key)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <span
                      className={`seq-${((n - 1) % 5) + 1} grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold`}
                    >
                      {n}
                    </span>
                    <PlacePicture
                      name={item.title}
                      kind={item.kind}
                      lat={item.lat}
                      lon={item.lon}
                      className="h-14 w-[72px] shrink-0 rounded-[12px]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block font-display text-[18px] leading-tight">
                        {item.title}
                      </span>
                      {when ? (
                        <span className="block text-[12.5px] text-muted-foreground">{when}</span>
                      ) : null}
                      {item.booked ? (
                        <span className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-semibold text-primary">
                          Booked
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                );
              }),
            )}
          </div>
        )}
        {dated[0] ? (
          <button
            type="button"
            onClick={() => onOpenMap(dated[0]!.key)}
            className="btn-primary mt-3 flex w-full items-center justify-center gap-2"
          >
            <MapIcon className="size-5" aria-hidden />
            Open on map
          </button>
        ) : null}
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
      className={`tile-card-${tone} flex min-h-[92px] w-[132px] shrink-0 snap-start flex-col justify-between p-3 text-left`}
    >
      <Icon className="size-6 text-primary" />
      <span>
        <span className="block text-[14.5px] font-semibold">{title}</span>
        <span className="block text-[12px] text-muted-foreground">{note}</span>
      </span>
    </button>
  );
}
