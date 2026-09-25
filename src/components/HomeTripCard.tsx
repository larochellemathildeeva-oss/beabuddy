import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BedDouble, CalendarDays, ChevronRight, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTrips, type TripRow } from "@/hooks/useTrips";
import { formatTripLocation } from "@/lib/place-label";
import { tripCompanionsLine } from "@/lib/trip-copy";
import { tripDateLine, tripLengthLabel, tripMonogram } from "@/lib/trip-card";
import { timeForRail } from "@/lib/timeline-kind";
import { stripEmbeddedMapsUrl } from "@/lib/timeline-directions";
import { laterHeading, packingReadiness, tripHighlights } from "@/lib/home-trip";

type NextItem = {
  id: string;
  day_date: string | null;
  time_label: string | null;
  title: string;
  kind: string;
  detail: string | null;
  address: string | null;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(iso: string) {
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - startOfToday().getTime()) / 86_400_000);
}

/** The trip happening now, otherwise the soonest one still to come. */
export function pickActiveTrip(trips: TripRow[]): TripRow | null {
  const today = startOfToday().toISOString().slice(0, 10);
  const current = trips
    .filter((t) => t.start_date && t.start_date <= today && (!t.end_date || t.end_date >= today))
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))[0];
  if (current) return current;
  const upcoming = trips
    .filter((t) => t.start_date && t.start_date > today)
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))[0];
  if (upcoming) return upcoming;
  return trips.find((t) => t.status === "in_progress" || t.status === "upcoming") ?? null;
}

/** The trips after the active one, soonest first. */
function laterTrips(trips: TripRow[], active: TripRow | null): TripRow[] {
  const today = startOfToday().toISOString().slice(0, 10);
  return trips
    .filter((t) => t.id !== active?.id && t.start_date && t.start_date > today)
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
    .slice(0, 3);
}

/** "Open LA Itinerary": the trip's short name, or its city, never a sentence. */
function shortName(trip: TripRow): string {
  const first = trip.title.split(/\s[·|–-]\s/)[0]?.trim() ?? "";
  if (first && first.length <= 18) return first;
  return trip.city?.split(",")[0]?.trim() || "trip";
}

/** "LA" for "LA · Coastal Sun & Art"; otherwise the trip's first letter. */
function monogram(trip: TripRow): string {
  const short = shortName(trip);
  return /^[\p{Lu}\d]{2,3}$/u.test(short) ? short : tripMonogram(trip.title, trip.city);
}

/**
 * Home's "Your next trip", as in the prototype: when and with whom, where and
 * how much is planned, the flight out and where you are staying when the plan
 * has them, how packed you are, and a way straight into the itinerary. The
 * trips after it sit underneath, each one tap from its own page.
 */
export function HomeTripCard() {
  const { trips, loading, members, uid } = useTrips();
  const trip = useMemo(() => pickActiveTrip(trips), [trips]);
  const later = useMemo(() => laterTrips(trips, trip), [trips, trip]);
  const [items, setItems] = useState<NextItem[]>([]);
  const [packing, setPacking] = useState<{ packed: boolean }[]>([]);
  const [stopCounts, setStopCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!trip) {
      setItems([]);
      setPacking([]);
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("itinerary_items")
        .select("id, day_date, time_label, title, kind, detail, address")
        .eq("trip_id", trip.id)
        .order("day_date", { ascending: true })
        .order("position", { ascending: true });
      if (!active) return;
      setItems((data ?? []) as NextItem[]);

      // How packed: every list made for this trip, counted together.
      const { data: lists } = await supabase
        .from("packing_lists")
        .select("id")
        .eq("trip_id", trip.id);
      const ids = (lists ?? []).map((l) => l.id);
      if (!active) return;
      if (ids.length === 0) {
        setPacking([]);
        return;
      }
      const { data: packed } = await supabase
        .from("packing_items")
        .select("packed")
        .in("list_id", ids);
      if (active) setPacking((packed ?? []).map((p) => ({ packed: Boolean(p.packed) })));
    })();
    return () => {
      active = false;
    };
  }, [trip]);

  // How many stops each later trip has planned, for its one line.
  useEffect(() => {
    if (later.length === 0) {
      setStopCounts({});
      return;
    }
    let active = true;
    void supabase
      .from("itinerary_items")
      .select("trip_id")
      .in(
        "trip_id",
        later.map((t) => t.id),
      )
      .then(({ data }) => {
        if (!active) return;
        const counts: Record<string, number> = {};
        for (const row of data ?? []) counts[row.trip_id] = (counts[row.trip_id] ?? 0) + 1;
        setStopCounts(counts);
      });
    return () => {
      active = false;
    };
  }, [later]);

  if (loading || !trip) return null;

  const started = trip.start_date ? daysBetween(trip.start_date) <= 0 : false;
  const countdown = trip.start_date ? daysBetween(trip.start_date) : null;
  const daysLeft = trip.end_date ? daysBetween(trip.end_date) : null;

  const status = started
    ? daysLeft != null && daysLeft >= 0
      ? daysLeft === 0
        ? "Last day"
        : `${daysLeft} day${daysLeft > 1 ? "s" : ""} to go`
      : "Happening now"
    : countdown != null
      ? countdown === 0
        ? "Leaving today"
        : countdown === 1
          ? "Leaving tomorrow"
          : `Leaving in ${countdown} days`
      : "Coming up";

  const companions = tripCompanionsLine(
    members.filter((m) => m.trip_id === trip.id),
    uid,
  );
  const whenLine = [
    trip.start_date || trip.end_date ? tripDateLine(trip.start_date, trip.end_date) : "",
    companions,
  ]
    .filter(Boolean)
    .join(" · ");
  const planned = [
    tripLengthLabel(trip.start_date, trip.end_date),
    items.length ? `${items.length} scheduled ${items.length === 1 ? "stop" : "stops"}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const whereLine = [
    formatTripLocation(trip.city, trip.country) || "Destination to be decided",
    planned,
  ]
    .filter(Boolean)
    .join(" · ");
  const { flight, lodging } = tripHighlights(items);
  const ready = packingReadiness(packing);
  const tiles = [
    flight && {
      key: "flight",
      icon: Plane,
      label: "Flight out",
      title: [flight.title, timeForRail(flight.time_label)].filter(Boolean).join(" · "),
      note: stripEmbeddedMapsUrl(flight.detail) || flight.day_date || "",
    },
    lodging && {
      key: "lodging",
      icon: BedDouble,
      label: "Lodging",
      title: lodging.title,
      note: stripEmbeddedMapsUrl(lodging.detail) || lodging.address || "",
    },
  ].filter(Boolean) as {
    key: string;
    icon: typeof Plane;
    label: string;
    title: string;
    note: string;
  }[];

  return (
    <section data-guide="home-trip" className="rise space-y-5">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="label-caps text-foreground">
            {started ? "Your trip right now" : "Your next trip"}
          </p>
          <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {status}
          </span>
        </div>

        <div className="card-soft p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {whenLine && (
                <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{whenLine}</span>
                </p>
              )}
              <h2 className="mt-1 break-words font-display text-[26px] leading-tight">
                {trip.title}
              </h2>
              <p className="mt-1 text-[14px] text-muted-foreground">{whereLine}</p>
            </div>
            <span
              aria-hidden
              className="grid size-14 shrink-0 place-items-center rounded-2xl border border-border bg-elevated font-display text-[24px]"
            >
              {monogram(trip)}
            </span>
          </div>

          {tiles.length > 0 && (
            <div
              className={`mt-4 grid gap-2.5 ${tiles.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {tiles.map(({ key, icon: Icon, label, title, note }) => (
                <div key={key} className="min-w-0 rounded-2xl border border-border bg-elevated p-3">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
                    <Icon className="size-4 text-primary" aria-hidden />
                    {label}
                  </p>
                  <p className="mt-1 break-words text-[14.5px] font-semibold leading-snug">
                    {title}
                  </p>
                  {note && (
                    <p className="mt-0.5 line-clamp-2 break-words text-[12.5px] text-muted-foreground">
                      {note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {ready && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[14px] font-semibold">Packing readiness</p>
                <p className="text-[13.5px] font-bold tabular-nums text-primary">
                  {ready.packed} / {ready.total} items
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Packing readiness"
                aria-valuemin={0}
                aria-valuemax={ready.total}
                aria-valuenow={ready.packed}
                className="mt-2 h-2 overflow-hidden rounded-full bg-elevated"
              >
                <div
                  className="h-full rounded-full bg-nexttime transition-[width] duration-500"
                  style={{ width: `${Math.round(ready.ratio * 100)}%` }}
                />
              </div>
            </div>
          )}

          <Link
            to="/trips/$tripId"
            params={{ tripId: trip.id }}
            className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-2xs transition-all active:scale-95"
          >
            Open {shortName(trip)} itinerary
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      {later.length > 0 && (
        <div>
          <p className="label-caps mb-3 text-foreground">
            {laterHeading(later.map((t) => t.start_date))}
          </p>
          <ul className="space-y-2">
            {later.map((t) => {
              const count = stopCounts[t.id] ?? 0;
              const line = [
                tripDateLine(t.start_date, t.end_date),
                tripLengthLabel(t.start_date, t.end_date),
                count
                  ? `${count} ${count === 1 ? "stop" : "stops"} planned`
                  : "Nothing planned yet",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={t.id}>
                  <Link
                    to="/trips/$tripId"
                    params={{ tripId: t.id }}
                    className="card-soft flex items-center gap-3 p-3.5"
                  >
                    <span
                      aria-hidden
                      className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-elevated font-display text-[18px]"
                    >
                      {monogram(t)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[18px] leading-tight">
                        {t.title}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        {line}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-primary">Plan →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
