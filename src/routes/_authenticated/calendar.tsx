import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useTrips, type ItineraryRow } from "@/hooks/useTrips";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Trip calendar — Béa" },
      {
        name: "description",
        content:
          "A month-by-month calendar of your trips, flights, hotels and reservations so you can plan before you leave home.",
      },
      { property: "og:title", content: "Trip calendar — Béa" },
      {
        property: "og:description",
        content: "Every trip, flight, hotel and reservation on one calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

const KIND_ICON: Record<string, string> = {
  Flight: "✈️",
  Hotel: "🏨",
  Stay: "🏨",
  Reservation: "🍽️",
  Food: "🍽️",
  Plan: "📍",
  Transport: "🚆",
};

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function pretty(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function daysBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (d <= last && out.length < 400) {
    out.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function CalendarPage() {
  const { trips, loading } = useTrips();
  const [items, setItems] = useState<ItineraryRow[]>([]);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(() => iso(new Date()));

  useEffect(() => {
    const run = async () => {
      if (!trips.length) {
        setItems([]);
        return;
      }
      const { data } = await supabase
        .from("itinerary_items")
        .select(
          "id, trip_id, day_date, time_label, kind, title, detail, position, updated_by, updated_at",
        )
        .in(
          "trip_id",
          trips.map((t) => t.id),
        )
        .order("day_date", { ascending: true })
        .order("position", { ascending: true });
      setItems((data ?? []) as ItineraryRow[]);
    };
    void run();
  }, [trips]);

  const tripByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of trips) {
      if (!t.start_date) continue;
      for (const day of daysBetween(t.start_date, t.end_date ?? t.start_date)) {
        map.set(day, [...(map.get(day) ?? []), t.id]);
      }
    }
    return map;
  }, [trips]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ItineraryRow[]>();
    for (const it of items) {
      if (!it.day_date) continue;
      map.set(it.day_date, [...(map.get(it.day_date) ?? []), it]);
    }
    return map;
  }, [items]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday first
    const cells: (string | null)[] = Array.from({ length: startOffset }, () => null);
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d += 1) {
      cells.push(iso(new Date(cursor.getFullYear(), cursor.getMonth(), d)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const upcoming = useMemo(() => {
    const today = iso(new Date());
    return items
      .filter((i) => i.day_date && i.day_date >= today)
      .slice(0, 8);
  }, [items]);

  const tripTitle = (id: string) => trips.find((t) => t.id === id)?.title ?? "Trip";
  const dayItems = itemsByDay.get(selected) ?? [];
  const dayTrips = (tripByDay.get(selected) ?? []).map(tripTitle);

  return (
    <AppShell eyebrow="Trip calendar" title="Plan it before you leave home.">
      <div className="space-y-5">
        <div className="card-soft p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-xl border border-border px-3 py-1.5 text-[13px]"
            >
              ‹
            </button>
            <p className="font-display text-[20px]">{monthLabel(cursor)}</p>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-xl border border-border px-3 py-1.5 text-[13px]"
            >
              ›
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={`${d}-${i}`} className="label-caps py-1">
                {d}
              </span>
            ))}
            {grid.map((day, i) => {
              if (!day) return <span key={`empty-${i}`} />;
              const onTrip = tripByDay.has(day);
              const hasItems = itemsByDay.has(day);
              const isToday = day === iso(new Date());
              const isSelected = day === selected;
              return (
                <button
                  key={day}
                  onClick={() => setSelected(day)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-[13px] transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : onTrip
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent"
                  } ${isToday && !isSelected ? "font-bold underline" : ""}`}
                >
                  {Number(day.slice(8))}
                  <span
                    className={`mt-0.5 size-1.5 rounded-full ${
                      hasItems ? (isSelected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <section className="card-soft p-4">
          <p className="label-caps">{pretty(selected)}</p>
          {dayTrips.length > 0 && (
            <p className="mt-1 text-[13px] text-muted-foreground">On trip: {dayTrips.join(", ")}</p>
          )}
          {dayItems.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Nothing planned. Add flights, hotels and reservations to a trip timeline and they land
              here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dayItems.map((it) => (
                <li
                  key={it.id}
                  className="rounded-xl border border-border bg-elevated px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span>{KIND_ICON[it.kind] ?? "📍"}</span>
                    <p className="text-[14px] font-semibold">{it.title}</p>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    {it.time_label ? `${it.time_label} · ` : ""}
                    {it.kind} · {tripTitle(it.trip_id)}
                  </p>
                  {it.detail && <p className="mt-1 text-[12px]">{it.detail}</p>}
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/trips"
            className="mt-3 inline-block rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
          >
            Open trips
          </Link>
        </section>

        <section className="card-soft p-4">
          <p className="label-caps">Coming up</p>
          {loading && <p className="mt-2 text-[13px] text-muted-foreground">Loading…</p>}
          {!loading && upcoming.length === 0 && (
            <p className="mt-2 text-[13px] text-muted-foreground">
              No future plans saved yet.
            </p>
          )}
          <ul className="mt-2 space-y-2">
            {upcoming.map((it) => (
              <li key={it.id} className="flex items-start gap-3">
                <span className="w-24 shrink-0 text-[12px] text-muted-foreground">
                  {it.day_date ? pretty(it.day_date) : ""}
                </span>
                <span className="text-[13px]">
                  {KIND_ICON[it.kind] ?? "📍"} {it.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
