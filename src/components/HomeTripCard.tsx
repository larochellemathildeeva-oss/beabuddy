import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "../integrations/supabase/client";
import { useTrips, type TripRow } from "../hooks/useTrips";
import { formatTripLocation } from "../lib/place-label";

type NextItem = { id: string; day_date: string | null; time_label: string | null; title: string; kind: string };

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

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function HomeTripCard() {
  const { trips, loading } = useTrips();
  const trip = useMemo(() => pickActiveTrip(trips), [trips]);
  const [items, setItems] = useState<NextItem[]>([]);
  const [stops, setStops] = useState<{ city: string | null; country: string | null }[]>([]);

  useEffect(() => {
    if (!trip) {
      setItems([]);
      setStops([]);
      return;
    }
    let active = true;
    void (async () => {
      const today = startOfToday().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("itinerary_items")
        .select("id, day_date, time_label, title, kind")
        .eq("trip_id", trip.id)
        .order("day_date", { ascending: true })
        .order("position", { ascending: true });
      if (!active) return;
      const all = (data ?? []) as NextItem[];
      const ahead = all.filter((i) => !i.day_date || i.day_date >= today);
      setItems((ahead.length ? ahead : all).slice(0, 3));

      const { data: s } = await supabase
        .from("trip_stops")
        .select("city, country")
        .eq("trip_id", trip.id)
        .order("position", { ascending: true });
      if (active) setStops(s ?? []);
    })();
    return () => {
      active = false;
    };
  }, [trip]);

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
        : `In ${countdown} day${countdown > 1 ? "s" : ""}`
      : "Coming up";

  const countryTags = Array.from(
    new Set(stops.map((s) => s.country).filter(Boolean) as string[]),
  );

  return (
    <section data-guide="home-trip" className="rise">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="label-caps text-foreground">{started ? "Your trip right now" : "Your next trip"}</p>
        <span className="text-[11px] text-muted-foreground">{status}</span>
      </div>

      <div className="card-soft p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] leading-tight">{trip.title}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {formatTripLocation(trip.city, trip.country) || "Destination to be decided"}
            </p>
          </div>
          {trip.start_date && (
            <div className="shrink-0 rounded-xl bg-elevated px-3 py-2 text-center">
              <p className="font-display text-[18px] leading-none">{fmt(trip.start_date)}</p>
              {trip.end_date && (
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  to {fmt(trip.end_date)}
                </p>
              )}
              {trip.dates_status === "tentative" && (
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Tentative
                </p>
              )}
            </div>
          )}
        </div>

        {countryTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {countryTags.map((c) => (
              <span
                key={c}
                className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-border/60 pt-3">
            {items.map((i) => (
              <li key={i.id} className="flex items-baseline gap-2 text-[13px]">
                <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                  {i.day_date ? fmt(i.day_date) : i.time_label || "Anytime"}
                </span>
                <span className="truncate">{i.title}</span>
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/trips"
          className="mt-4 block rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-primary-foreground"
        >
          Open this trip
        </Link>
      </div>
    </section>
  );
}
