import { useEffect, useRef, useState } from "react";
import type { ItineraryRow } from "@/hooks/useTrips";
import { partOfDay, stopStatuses, type PartOfDay } from "@/lib/companion";
import { timeForRail } from "@/lib/timeline-kind";
import { stayLabel } from "@/lib/planned-stay";
import { isBooked } from "@/lib/bookings";
import { Compass } from "lucide-react";

type Filter = "all" | PartOfDay;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
];

/**
 * The day as a strip of cards you swipe along, from the prototype's
 * itinerary ribbon.
 *
 * Filters by part of the day using each stop's clock time. A stop with no
 * clock time ("Lunch") appears under All only; putting it in a part of the
 * day would be a guess. Part-of-day filters with nothing in them are not
 * offered.
 */
export function DayRibbon({
  stops,
  dayLabel,
  selectedId = null,
  onSelect,
}: {
  stops: ItineraryRow[];
  /** "Day 1", for the card's heading. */
  dayLabel?: string | undefined;
  /** The stop being looked at, from a tap here or on the tracker. */
  selectedId?: string | null;
  /** Tap a card to look at that stop; tap it again to stop looking. */
  onSelect?: ((id: string | null) => void) | undefined;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const strip = useRef<HTMLOListElement>(null);
  const statuses = stopStatuses(stops);
  const here = statuses.indexOf("here");
  const picked = selectedId ? stops.findIndex((s) => s.id === selectedId) : -1;
  const focusIndex = picked >= 0 ? picked : here >= 0 ? here : statuses.indexOf("next");

  // Open on where you are, not on the first stop of the day. Scrolls the
  // strip only, never the page.
  useEffect(() => {
    const list = strip.current;
    const card = list?.querySelector<HTMLElement>(`[data-index="${focusIndex}"]`);
    if (list && card) list.scrollLeft = Math.max(0, card.offsetLeft - list.offsetLeft - 16);
  }, [focusIndex, filter]);

  if (stops.length === 0) return null;

  const parts = stops.map((stop) => partOfDay(stop.time_label));
  const count = (f: Filter) => (f === "all" ? stops.length : parts.filter((p) => p === f).length);
  const offered = FILTERS.filter((f) => f.id === "all" || count(f.id) > 0);
  const shown = stops
    .map((stop, i) => ({ stop, i }))
    .filter(({ i }) => filter === "all" || parts[i] === filter);

  return (
    <section
      aria-label="The day at a glance"
      className="rounded-2xl border border-border bg-gradient-to-b from-card via-card to-elevated/60 p-3 shadow-sm"
    >
      <div className="mb-2.5 flex flex-col gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Compass className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-[12.5px] font-bold uppercase tracking-wider">
            {dayLabel ? `${dayLabel} itinerary ribbon` : "Itinerary ribbon"}
          </span>
          <span className="shrink-0 rounded-md border border-border bg-elevated px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {stops.length} {stops.length === 1 ? "stop" : "stops"}
          </span>
        </div>
        {offered.length > 1 && (
          <div
            role="group"
            aria-label="Part of the day"
            className="no-scrollbar flex gap-1 overflow-x-auto"
          >
            {offered.map((f) => {
              const on = f.id === filter;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.id)}
                  className={`min-h-8 shrink-0 rounded-lg px-2.5 text-[12px] font-semibold ${
                    on
                      ? "bg-foreground text-background shadow-sm"
                      : "border border-border bg-elevated text-muted-foreground"
                  }`}
                >
                  {f.label} ({count(f.id)})
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ol ref={strip} className="no-scrollbar flex snap-x gap-2.5 overflow-x-auto py-1">
        {shown.map(({ stop, i }) => {
          const status = statuses[i]!;
          const here = status === "here";
          const next = status === "next";
          const meta = [
            isBooked(stop) ? "✓ Booked" : "",
            stop.address?.trim(),
            stop.planned_stay_minutes ? `~${stayLabel(stop.planned_stay_minutes)}` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          const selected = stop.id === selectedId;
          return (
            <li key={stop.id} data-index={i} className="w-44 shrink-0 snap-start">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${timeForRail(stop.time_label) || ""} ${stop.title} — show this stop`}
                onClick={() => onSelect?.(selected ? null : stop.id)}
                className={`block h-full w-full rounded-2xl border p-3 text-left transition-all ${
                  here
                    ? "scale-[1.02] border-foreground bg-foreground text-background shadow-sm"
                    : next
                      ? "border-border bg-elevated"
                      : "border-border bg-card"
                } ${status === "done" || status === "skipped" ? "opacity-70" : ""} ${
                  selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span
                    className={`text-[13px] font-bold tabular-nums ${here ? "text-[oklch(0.78_0.1_45)]" : "text-primary"}`}
                  >
                    {timeForRail(stop.time_label) || "–"}
                  </span>
                  {here ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10.5px] font-bold text-primary-foreground">
                      Current
                    </span>
                  ) : next ? (
                    <span className="rounded bg-nexttime/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-nexttime">
                      Next
                    </span>
                  ) : status === "done" ? (
                    <span className="text-[10.5px] font-semibold text-nexttime">✓ Done</span>
                  ) : status === "skipped" ? (
                    <span className="text-[10.5px] font-medium text-muted-foreground">Skipped</span>
                  ) : (
                    <span className="text-[10.5px] font-medium text-muted-foreground">
                      #{i + 1}
                    </span>
                  )}
                </div>
                <p
                  className={`line-clamp-2 min-h-9 break-words text-[14px] font-bold leading-snug ${
                    status === "skipped" ? "line-through" : ""
                  }`}
                >
                  {stop.title}
                </p>
                {meta && (
                  <p
                    className={`mt-1 truncate text-[11.5px] ${here ? "text-background/70" : "text-muted-foreground"}`}
                  >
                    {meta}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
