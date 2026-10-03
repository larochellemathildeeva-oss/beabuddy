import { useEffect, useRef } from "react";
import type { ItineraryRow } from "@/hooks/useTrips";
import { Check } from "@/components/icons";
import { companionState, stopStatuses, type StopStatus } from "@/lib/companion";
import { timeForRail } from "@/lib/timeline-kind";

const DOT: Record<StopStatus, string> = {
  done: "border-2 border-primary bg-card text-primary",
  here: "bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/20",
  next: "border-2 border-primary bg-card text-primary",
  skipped: "border border-border bg-elevated text-muted-foreground line-through",
  upcoming: "border border-border bg-card text-foreground",
};

const STATUS_WORD: Record<StopStatus, string> = {
  done: "done",
  here: "you are here",
  next: "next",
  skipped: "skipped",
  upcoming: "later",
};

/**
 * The day as a line of numbered stops, with where you are marked on it.
 *
 * The prototype's Live Journey Tracker: a track that fills as the day goes,
 * done stops ticked, the current one ringed. It moves only when you tap
 * "I'm here" or "Leaving", like the rest of Now, and a stop you went past
 * without arriving shows as skipped rather than pretending you went.
 */
export function JourneyTracker({
  stops,
  selectedId = null,
  onSelect,
}: {
  stops: ItineraryRow[];
  /** The stop being looked at, from a tap here or on the ribbon. */
  selectedId?: string | null;
  /** Tap a stop to look at it; tap it again to stop looking. */
  onSelect?: ((id: string | null) => void) | undefined;
}) {
  const track = useRef<HTMLDivElement>(null);
  const pickedIndex = selectedId ? stops.findIndex((s) => s.id === selectedId) : -1;
  // Bring the looked-at stop, or where you are, into view on a long day.
  useEffect(() => {
    const box = track.current;
    const state = companionState(stops);
    const focus = pickedIndex >= 0 ? pickedIndex : stops.indexOf((state.current ?? state.next)!);
    const dot = box?.querySelector<HTMLElement>(`[data-index="${focus}"]`);
    if (box && dot) box.scrollLeft = Math.max(0, dot.offsetLeft - box.clientWidth / 2);
  }, [pickedIndex, stops]);
  if (stops.length === 0) return null;
  const state = companionState(stops);
  const statuses = stopStatuses(stops);
  const focus = state.current ?? state.next;
  const position = focus ? stops.indexOf(focus) + 1 : stops.length;
  const filled = stops.length > 1 ? Math.min(1, (position - 1) / (stops.length - 1)) : 1;

  return (
    <section aria-label="Today's progress" className="plain-card p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Today's progress
        </p>
        <p className="text-[13px] tabular-nums text-muted-foreground">
          {state.reached} / {stops.length} stops ·{" "}
          {Math.round((state.reached / stops.length) * 100)}% complete
        </p>
      </div>

      {/* Scrolls sideways on a long day; each stop keeps a thumb-sized dot. */}
      <div ref={track} className="no-scrollbar -mx-1 mt-3 overflow-x-auto px-1 pb-1">
        <ol
          className="relative flex items-start justify-between gap-1"
          style={{ minWidth: `${stops.length * 100}px` }}
        >
          <span
            aria-hidden
            className="absolute inset-x-8 top-[15px] h-0.5 rounded-full bg-border"
          />
          <span
            aria-hidden
            className="absolute left-8 top-[15px] h-0.5 rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `calc((100% - 4rem) * ${filled})` }}
          />
          {stops.map((stop, i) => {
            const status = statuses[i]!;
            const time = timeForRail(stop.time_label);
            return (
              <li
                key={stop.id}
                data-index={i}
                className="relative z-10 flex w-[100px] shrink-0 flex-col items-center text-center"
              >
                <button
                  type="button"
                  aria-pressed={i === pickedIndex}
                  onClick={() => onSelect?.(i === pickedIndex ? null : stop.id)}
                  title={`${stop.title}, ${STATUS_WORD[status]}`}
                  className={`tap-44 grid size-8 place-items-center rounded-full text-[13px] font-bold tabular-nums transition-all ${DOT[status]} ${
                    i === pickedIndex ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
                  }`}
                >
                  {status === "done" ? <Check className="size-4" aria-hidden /> : i + 1}
                  <span className="sr-only">
                    {" "}
                    {stop.title}, {STATUS_WORD[status]} — show this stop
                  </span>
                </button>
                <span
                  className={`mt-1.5 text-[13px] tabular-nums ${
                    status === "here" ? "font-bold text-primary" : "text-muted-foreground"
                  }`}
                >
                  {time || "–"}
                </span>
                <span
                  className={`break-words text-[13px] leading-tight ${
                    status === "here" ? "font-semibold text-primary" : "text-muted-foreground"
                  }`}
                >
                  {stop.title}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {!state.next && !state.current && (
        <p className="mt-2 text-[13px] font-semibold text-nexttime">
          Every stop behind you for this day.
        </p>
      )}
    </section>
  );
}
