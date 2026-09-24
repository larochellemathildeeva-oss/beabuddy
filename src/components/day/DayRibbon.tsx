import { useEffect, useRef, useState } from "react";
import type { ItineraryRow } from "@/hooks/useTrips";
import { partOfDay, stopStatuses, type PartOfDay, type StopStatus } from "@/lib/companion";
import { timeForRail } from "@/lib/timeline-kind";

type Filter = "all" | PartOfDay;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
];

const BADGE: Partial<Record<StopStatus, { text: string; className: string }>> = {
  here: { text: "Current", className: "bg-primary text-primary-foreground" },
  next: { text: "Next", className: "bg-nexttime/15 text-nexttime" },
  done: { text: "Done", className: "bg-elevated text-muted-foreground" },
  skipped: { text: "Skipped", className: "bg-elevated text-muted-foreground" },
};

/**
 * The day as a strip of cards you swipe along, from the prototype's
 * itinerary ribbon.
 *
 * Filters by part of the day using each stop's clock time. A stop with no
 * clock time ("Lunch") appears under All only; putting it in a part of the
 * day would be a guess. Part-of-day filters with nothing in them are not
 * offered.
 */
export function DayRibbon({ stops }: { stops: ItineraryRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const strip = useRef<HTMLOListElement>(null);
  const statuses = stopStatuses(stops);
  const here = statuses.indexOf("here");
  const focusIndex = here >= 0 ? here : statuses.indexOf("next");

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
    <section aria-label="The day at a glance" className="space-y-2.5">
      {offered.length > 1 && (
        <div
          role="group"
          aria-label="Part of the day"
          className="no-scrollbar flex gap-1.5 overflow-x-auto"
        >
          {offered.map((f) => {
            const on = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.id)}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-[12.5px] font-semibold ${
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {f.label} ({count(f.id)})
              </button>
            );
          })}
        </div>
      )}

      <ol ref={strip} className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
        {shown.map(({ stop, i }) => {
          const status = statuses[i]!;
          const badge = BADGE[status];
          const here = status === "here";
          return (
            <li
              key={stop.id}
              data-index={i}
              className={`w-[200px] shrink-0 snap-start rounded-2xl border p-3 ${
                here
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-card"
              } ${status === "done" || status === "skipped" ? "opacity-70" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[13px] font-bold tabular-nums ${here ? "text-background/80" : "text-primary"}`}
                >
                  {timeForRail(stop.time_label) || `#${i + 1}`}
                </span>
                {badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
                  >
                    {badge.text}
                  </span>
                )}
              </div>
              <p
                className={`mt-1.5 line-clamp-2 text-[14.5px] font-semibold leading-snug ${
                  status === "skipped" ? "line-through" : ""
                }`}
              >
                {stop.title}
              </p>
              {stop.address?.trim() && (
                <p
                  className={`mt-1 truncate text-[12px] ${here ? "text-background/70" : "text-muted-foreground"}`}
                >
                  {stop.address}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
