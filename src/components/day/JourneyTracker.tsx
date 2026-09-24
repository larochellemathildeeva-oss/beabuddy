import type { ItineraryRow } from "@/hooks/useTrips";
import { companionState, stopStatuses, type StopStatus } from "@/lib/companion";

const DOT: Record<StopStatus, string> = {
  done: "border-primary bg-primary text-primary-foreground",
  here: "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
  next: "border-primary bg-card text-primary",
  skipped: "border-border bg-elevated text-muted-foreground line-through",
  upcoming: "border-border bg-card text-muted-foreground",
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
 * From the prototype's Live Journey Tracker. It moves only when you tap
 * "I'm here" or "Leaving", like the rest of Now, and a stop you went past
 * without arriving shows as skipped rather than pretending you went.
 */
export function JourneyTracker({ stops }: { stops: ItineraryRow[] }) {
  if (stops.length === 0) return null;
  const state = companionState(stops);
  const statuses = stopStatuses(stops);
  const focus = state.current ?? state.next;
  const position = focus ? stops.indexOf(focus) + 1 : stops.length;

  return (
    <section
      aria-label="Live journey"
      className="rounded-2xl border border-border/70 bg-card p-3.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          <span className="size-2 rounded-full bg-nexttime" aria-hidden />
          Live journey
        </p>
        <p className="text-[12.5px] font-semibold tabular-nums text-muted-foreground">
          Stop <span className="text-primary">{position}</span> of {stops.length}
        </p>
      </div>

      <ol className="no-scrollbar mt-3 flex items-center overflow-x-auto pb-1">
        {stops.map((stop, i) => (
          <li key={stop.id} className="flex shrink-0 items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`h-0.5 w-5 ${
                  statuses[i - 1] === "done" || statuses[i - 1] === "skipped"
                    ? "bg-primary/60"
                    : "bg-border"
                }`}
              />
            )}
            <span
              title={`${stop.title}, ${STATUS_WORD[statuses[i]!]}`}
              className={`grid size-8 place-items-center rounded-full border-2 text-[12.5px] font-bold tabular-nums ${DOT[statuses[i]!]}`}
            >
              {i + 1}
              <span className="sr-only">
                {" "}
                {stop.title}, {STATUS_WORD[statuses[i]!]}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-2.5 space-y-1.5 text-[13.5px]">
        {state.current && (
          <p className="rounded-xl bg-elevated px-3 py-2">
            <span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Now
            </span>
            <span className="font-semibold">{state.current.title}</span>
          </p>
        )}
        {state.next && (
          <p className="rounded-xl bg-primary/10 px-3 py-2">
            <span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-primary">
              Next
            </span>
            <span className="font-semibold text-primary">{state.next.title}</span>
          </p>
        )}
      </div>
    </section>
  );
}
