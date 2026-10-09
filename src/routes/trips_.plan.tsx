import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Sheet } from "@/components/Sheet";
import { PlanCards } from "@/components/PlanWithBea";
import { Check } from "@/components/icons";
import type { PlannerTab } from "@/components/ItineraryImport";
import { useTrips, type TripRow } from "@/hooks/useTrips";
import { planTripChoices, startsNewTrip } from "@/lib/plan-trip-choices";
import { tripDateLine } from "@/lib/trip-card";
import { toLocalISODate } from "@/lib/trip-dates";

export const Route = createFileRoute("/trips_/plan")({
  staticData: { plane: "detail" },
  ssr: false,
  head: () => ({
    meta: [
      { title: "Plan with Béa" },
      {
        name: "description",
        content: "Build a trip, import your plan, optimize it or compare options with Béa.",
      },
    ],
  }),
  component: PlanPage,
});

/** What a card asks for, and whether a brand-new trip can answer it. */
type Ask = { tab: PlannerTab; ask?: string };

/**
 * Plan with Béa, as its own page under Trips: the minimalist frame's four
 * rows and "Start a new plan". Every road leads into a trip's planner — the
 * one picked under "Which journey?", or a new one for Build and Import.
 */
function PlanPage() {
  const navigate = useNavigate();
  const t = useTrips();
  const today = toLocalISODate(new Date());
  const [asking, setAsking] = useState<Ask | null>(null);
  /** Trips the sheet offers for the card that opened it (`plan-trip-choices.ts`). */
  const choices = useMemo(
    () => (asking ? planTripChoices(t.trips, today, asking.tab) : []),
    [asking, t.trips, today],
  );

  const openTrip = (trip: TripRow, ask: Ask) =>
    void navigate({
      to: "/trips/$tripId",
      params: { tripId: trip.id },
      search: { plan: ask.tab, ...(ask.ask ? { ask: ask.ask } : {}) },
      viewTransition: true,
    });
  const newTrip = (ask: Ask) =>
    void navigate({
      to: "/trips",
      search: { new: true, plan: ask.tab, ...(ask.ask ? { ask: ask.ask } : {}) },
    });
  /**
   * Build or Import with no trip ahead goes straight to a new one; anything
   * else asks which trip. Optimize and Compare with no trip at all still open
   * the sheet, which then offers a way to start one rather than a dead end.
   * While the list is still loading nothing is decided: the sheet waits.
   */
  const start = (ask: Ask) => {
    if (
      !t.loading &&
      startsNewTrip(ask.tab) &&
      planTripChoices(t.trips, today, ask.tab).length === 0
    ) {
      newTrip(ask);
      return;
    }
    setAsking(ask);
  };

  const [picked, setPicked] = useState<string | null>(null);
  const close = () => {
    setAsking(null);
    setPicked(null);
  };
  const noTrips = asking && !t.loading && !startsNewTrip(asking.tab) && choices.length === 0;
  /**
   * Where Continue goes for the row picked: a new trip, or one of yours. Null
   * when the pick is no longer on offer (the list refreshed under it), so
   * Continue stays off rather than closing the sheet on nothing.
   */
  const destination = (): (() => void) | null => {
    const ask = asking;
    if (!ask || !picked) return null;
    if (picked === NEW_TRIP) return startsNewTrip(ask.tab) ? () => newTrip(ask) : null;
    if (picked === NEW_IMPORT) return noTrips ? () => newTrip({ tab: "import" }) : null;
    if (picked === NEW_BUILD) return noTrips ? () => newTrip({ tab: "build" }) : null;
    const trip = choices.find((c) => c.id === picked);
    return trip ? () => openTrip(trip, ask) : null;
  };
  const target = destination();
  const go = () => {
    if (!target) return;
    close();
    target();
  };

  return (
    <AppShell eyebrow="Build / import / optimize / compare" title="Plan with Béa.">
      <div className="space-y-3">
        <PlanCards
          onBuild={() => start({ tab: "build" })}
          onImport={() => start({ tab: "import" })}
          onOptimize={() => start({ tab: "optimize" })}
          onCompare={() => start({ tab: "compare" })}
        />
        <button
          type="button"
          onClick={() => newTrip({ tab: "build" })}
          data-guide="plan-start"
          className="btn-primary flex w-full items-center justify-center px-4"
        >
          Start a new plan
        </button>
      </div>

      <Sheet
        open={asking !== null}
        onClose={close}
        page
        hint="Plan with Béa"
        title="Which journey?"
        crumb="Plan with Béa"
        width="sm"
      >
        <p className="mb-2 text-[14px] text-muted-foreground">
          {noTrips
            ? "Béa needs a trip with a few stops first. Start one here."
            : asking?.tab === "optimize"
              ? "Béa reorders the stops already on a trip."
              : asking?.tab === "compare"
                ? "Compare plans for one of your trips."
                : "Plan a new trip, or add to one you have."}
        </p>
        <div role="radiogroup" aria-label="Which journey?">
          {asking && startsNewTrip(asking.tab) && (
            <JourneyRow
              id={NEW_TRIP}
              title="A new trip"
              note="Start from an idea"
              picked={picked}
              onPick={setPicked}
            />
          )}
          {noTrips && (
            <>
              <JourneyRow
                id={NEW_IMPORT}
                title="Import a plan"
                note="A photo, PDF, calendar or pasted plan becomes a trip"
                picked={picked}
                onPick={setPicked}
              />
              <JourneyRow
                id={NEW_BUILD}
                title="Plan a new trip"
                note="Where and when, then Béa drafts the days"
                picked={picked}
                onPick={setPicked}
              />
            </>
          )}
          {choices.map((trip) => (
            <JourneyRow
              key={trip.id}
              id={trip.id}
              title={trip.title}
              note={tripDateLine(trip.start_date, trip.end_date) || "No dates yet"}
              picked={picked}
              onPick={setPicked}
            />
          ))}
        </div>
        {/* Rows the shape of the trips to come, so the sheet does not jump. */}
        {t.loading && choices.length === 0 && (
          <div aria-busy="true" aria-label="Fetching your trips">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 border-b border-border py-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={go}
          disabled={!target}
          className="btn-primary mt-3 flex w-full items-center justify-center px-4 disabled:opacity-60"
        >
          Continue
        </button>
      </Sheet>
    </AppShell>
  );
}

const NEW_TRIP = "new";
const NEW_IMPORT = "new-import";
const NEW_BUILD = "new-build";

/** One choice in "Which journey?": a title over one line, checked when picked. */
function JourneyRow({
  id,
  title,
  note,
  picked,
  onPick,
}: {
  id: string;
  title: string;
  note: string;
  picked: string | null;
  onPick: (id: string) => void;
}) {
  const on = picked === id;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onPick(id)}
      className="flex w-full items-center gap-3 border-b border-border py-3 text-start"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] leading-[22px]">{title}</span>
        <span className="mt-1 block truncate text-[14px] leading-[20px] text-muted-foreground">
          {note}
        </span>
      </span>
      {on ? <Check className="size-5 shrink-0" aria-hidden /> : null}
    </button>
  );
}
