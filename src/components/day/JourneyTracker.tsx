import { useEffect, useRef } from "react";
import type { ItineraryRow } from "@/hooks/useTrips";
import { companionState, stopStatuses, type StopStatus } from "@/lib/companion";

const DOT: Record<StopStatus, string> = {
  done: "bg-nexttime text-white",
  here: "scale-125 bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/25",
  next: "border-2 border-primary bg-card text-primary",
  skipped: "border border-border bg-elevated text-muted-foreground line-through",
  upcoming: "border border-border bg-card text-muted-foreground",
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
  const behind = statuses.filter((s) => s === "done" || s === "skipped").length;
  const percent = Math.round((behind / stops.length) * 100);
  const filled = stops.length > 1 ? Math.min(1, (position - 1) / (stops.length - 1)) : 1;

  return (
    <section
      aria-label="Live journey"
      className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[14px] font-bold">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-nexttime opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-nexttime" />
          </span>
          Live journey
        </p>
        <p className="text-[12px] font-semibold tabular-nums text-muted-foreground">
          Stop <span className="font-bold text-primary">{position}</span> of {stops.length}
          <span className="ml-1.5 opacity-80">({percent}% done)</span>
        </p>
      </div>

      {/* Scrolls sideways on a long day; each stop keeps a thumb-sized dot. */}
      <div ref={track} className="no-scrollbar -mx-1 mt-3 overflow-x-auto px-1 pb-1">
        <ol
          className="relative flex items-center justify-between gap-2 px-1 py-1.5"
          style={{ minWidth: `${stops.length * 36}px` }}
        >
          <span
            aria-hidden
            className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-elevated"
          />
          <span
            aria-hidden
            className="absolute left-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `calc((100% - 1.5rem) * ${filled})` }}
          />
          {stops.map((stop, i) => (
            <li key={stop.id} data-index={i} className="relative z-10 shrink-0">
              <button
                type="button"
                aria-pressed={i === pickedIndex}
                onClick={() => onSelect?.(i === pickedIndex ? null : stop.id)}
                title={`${stop.title}, ${STATUS_WORD[statuses[i]!]}`}
                className={`tap-44 grid size-7 place-items-center rounded-full text-[11px] font-bold tabular-nums transition-all ${DOT[statuses[i]!]} ${
                  i === pickedIndex ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
                }`}
              >
                {statuses[i] === "done" ? "✓" : i + 1}
                <span className="sr-only">
                  {" "}
                  {stop.title}, {STATUS_WORD[statuses[i]!]} — show this stop
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1.5 text-[13px] sm:grid-cols-2">
        {state.current && (
          <p className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border/60 bg-elevated px-2.5 py-1.5">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Now:
            </span>
            <span className="truncate font-bold">{state.current.title}</span>
          </p>
        )}
        {state.next ? (
          <p className="flex min-w-0 items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-primary">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider">Next:</span>
            <span className="truncate font-bold">{state.next.title}</span>
          </p>
        ) : (
          <p className="rounded-xl bg-elevated px-2.5 py-1.5 font-semibold text-nexttime">
            Every stop behind you for this day.
          </p>
        )}
      </div>
    </section>
  );
}
