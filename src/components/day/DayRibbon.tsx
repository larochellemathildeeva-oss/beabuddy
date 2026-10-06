import { useEffect, useRef } from "react";
import type { ItineraryRow } from "@/hooks/useTrips";
import { stopStatuses } from "@/lib/companion";
import { timeForRail } from "@/lib/timeline-kind";
import { isBooked } from "@/lib/bookings";

/**
 * The day as a compact strip of cards you swipe along.
 *
 * The owner’s Companion order starts here. Part-of-day filters are not on
 * this strip: the decision is a compact ribbon, and a stop with no clock
 * time would have nowhere honest to go. Current, next, done and skipped
 * stay on the cards. A tap looks at the stop; it does not move Now.
 */
export function DayRibbon({
  stops,
  dayLabel,
  selectedId = null,
  onSelect,
}: {
  stops: ItineraryRow[];
  /** "Day 1", for the strip's caption. */
  dayLabel?: string | undefined;
  /** The stop being looked at, from a tap here or on the tracker. */
  selectedId?: string | null;
  /** Tap a card to look at that stop; tap it again to stop looking. */
  onSelect?: ((id: string | null) => void) | undefined;
}) {
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
    if (list && card) list.scrollLeft = Math.max(0, card.offsetLeft - list.offsetLeft - 12);
  }, [focusIndex, stops]);

  if (stops.length === 0) return null;

  return (
    <section aria-label="The day at a glance" className="plain-card py-3">
      <p className="px-3 text-[13px] text-muted-foreground">
        {dayLabel ? `${dayLabel} · ` : ""}
        {stops.length} {stops.length === 1 ? "stop" : "stops"}
      </p>
      <ol
        ref={strip}
        className="no-scrollbar mt-2 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-3 py-1"
      >
        {stops.map((stop, i) => {
          const status = statuses[i]!;
          const hereCard = status === "here";
          const next = status === "next";
          const selected = stop.id === selectedId;
          const time = timeForRail(stop.time_label);
          const tag = hereCard
            ? "Current"
            : next
              ? "Next"
              : status === "done"
                ? "✓ Done"
                : status === "skipped"
                  ? "Skipped"
                  : "";
          return (
            <li key={stop.id} data-index={i} className="w-[8.75rem] shrink-0 snap-start">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${time || ""} ${stop.title} — show this stop`}
                onClick={() => onSelect?.(selected ? null : stop.id)}
                className={`flex h-full min-h-[4.75rem] w-full flex-col rounded-xl px-2.5 py-2 text-left ${
                  hereCard
                    ? "bg-foreground text-background shadow-xs"
                    : "bg-elevated text-foreground"
                } ${status === "done" || status === "skipped" ? "opacity-60" : ""} ${
                  selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
                }`}
              >
                <span className="flex items-start justify-between gap-1">
                  <span
                    className={`text-[14px] font-semibold tabular-nums ${
                      hereCard ? "" : "text-foreground"
                    }`}
                  >
                    {time || "–"}
                  </span>
                  {tag ? (
                    <span
                      className={`shrink-0 rounded-full px-1.5 text-[13px] font-semibold leading-5 ${
                        hereCard
                          ? "bg-card text-foreground"
                          : next
                            ? "bg-card text-nexttime"
                            : "text-muted-foreground"
                      }`}
                    >
                      {tag}
                    </span>
                  ) : (
                    <span className="text-[13px] font-medium text-muted-foreground">#{i + 1}</span>
                  )}
                </span>
                <span
                  className={`mt-1 line-clamp-2 font-display text-[17px] leading-tight ${
                    status === "skipped" ? "line-through" : ""
                  }`}
                >
                  {stop.title}
                </span>
                {isBooked(stop) ? (
                  <span
                    className={`mt-1 text-[13px] ${hereCard ? "text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    ✓ Booked
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
