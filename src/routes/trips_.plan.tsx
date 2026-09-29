import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Sheet } from "@/components/Sheet";
import { TripPicture } from "@/components/HomeTripCard";
import { AiPromptButton } from "@/components/AiPromptSheet";
import { PlanAsk, PlanCards, PlanExamples, PlanHero } from "@/components/PlanWithBea";
import { CalendarDays, ChevronRight, Plus, Users } from "@/components/icons";
import type { PlannerTab } from "@/components/ItineraryImport";
import { useTrips, type TripRow } from "@/hooks/useTrips";
import { useTripPhotos } from "@/hooks/useTripPhotos";
import { laterTrips, pastTrips, peopleOnTrip, pickActiveTrip } from "@/lib/home-trip";
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
 * Plan with Béa, as its own page under Trips: the master's "What would you
 * like to do?" with its four cards, your recent trip, examples, and a box
 * for anything else. Every road leads into a trip's planner — the one you
 * pick, or a new one for Build and Import.
 */
function PlanPage() {
  const navigate = useNavigate();
  const t = useTrips();
  const { photos } = useTripPhotos(t.uid);
  const today = toLocalISODate(new Date());
  const recent = useMemo(
    () => pickActiveTrip(t.trips, today) ?? pastTrips(t.trips, today, 1)[0] ?? null,
    [t.trips, today],
  );
  /** Trips to pick from: the recent one, what comes after it, then the ones behind you. */
  const choices = useMemo(() => {
    const active = pickActiveTrip(t.trips, today);
    const list = [
      ...(active ? [active] : []),
      ...laterTrips(t.trips, active, today),
      ...pastTrips(t.trips, today, 6),
    ];
    const seen = new Set<string>();
    return list.filter((trip) => (seen.has(trip.id) ? false : (seen.add(trip.id), true)));
  }, [t.trips, today]);
  const [asking, setAsking] = useState<Ask | null>(null);

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
  /** One trip and nothing to choose: straight in. Otherwise ask which. */
  const start = (ask: Ask) => {
    const canStartNew = ask.tab === "build" || ask.tab === "import";
    if (choices.length === 0) {
      if (canStartNew) newTrip(ask);
      else setAsking(ask);
      return;
    }
    setAsking(ask);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PlanHero />

        <PlanCards
          onBuild={() => start({ tab: "build" })}
          onImport={() => start({ tab: "import" })}
          onOptimize={() => start({ tab: "optimize" })}
          onCompare={() => start({ tab: "compare" })}
        />
        <AiPromptButton />

        {recent && (
          <section className="border-t border-border pt-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-[26px] leading-none">Recent trip</h2>
              <Link
                to="/trips"
                className="flex items-center gap-1 text-[14px] text-muted-foreground"
              >
                View all
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            <RecentTrip
              trip={recent}
              photos={photos}
              people={peopleOnTrip(t.members, recent.id, t.uid)}
            />
          </section>
        )}

        <PlanExamples onPick={(ask) => start({ tab: "build", ask })} />
        <PlanAsk onSend={(ask) => start({ tab: "build", ask })} />
      </div>

      <Sheet
        open={asking !== null}
        onClose={() => setAsking(null)}
        title="Which trip?"
        hint={
          asking?.tab === "optimize"
            ? "Béa reorders the stops already on a trip."
            : asking?.tab === "compare"
              ? "Compare plans for one of your trips."
              : "Plan a new trip, or add to one you have."
        }
        width="sm"
      >
        <div className="space-y-2">
          {(asking?.tab === "build" || asking?.tab === "import") && (
            <button
              type="button"
              onClick={() => {
                const ask = asking;
                setAsking(null);
                newTrip(ask);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/50 px-3 py-3 text-left"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Plus className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-semibold">A new trip</span>
                <span className="block text-[12.5px] text-muted-foreground">
                  Where and when, then Béa takes it from there.
                </span>
              </span>
            </button>
          )}
          {choices.length === 0 ? (
            <p className="px-1 py-2 text-[14px] text-muted-foreground">
              No trips yet. Start one under Trips, then come back.
            </p>
          ) : (
            <div className="plain-card divide-y divide-border overflow-hidden">
              {choices.map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => {
                    const ask = asking;
                    setAsking(null);
                    if (ask) openTrip(trip, ask);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <span className="relative block size-12 shrink-0 overflow-hidden rounded-xl">
                    <TripPicture trip={trip} photos={photos} cities={[]} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[19px] leading-tight">
                      {trip.title}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {tripDateLine(trip.start_date, trip.end_date) || "No dates yet"}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>
      </Sheet>
    </AppShell>
  );
}

function RecentTrip({
  trip,
  photos,
  people,
}: {
  trip: TripRow;
  photos: Parameters<typeof TripPicture>[0]["photos"];
  people: number;
}) {
  const dates = tripDateLine(trip.start_date, trip.end_date);
  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      className="plain-card flex items-center gap-3 p-2.5"
    >
      <span className="relative block h-[88px] w-[124px] shrink-0 overflow-hidden rounded-2xl">
        <TripPicture trip={trip} photos={photos} cities={[]} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block font-display text-[22px] leading-tight">
          {trip.title}
        </span>
        {dates ? (
          <span className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            {dates}
          </span>
        ) : null}
        <span className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
          <Users className="size-4 shrink-0" aria-hidden />
          {people} {people === 1 ? "traveller" : "travellers"}
        </span>
      </span>
      <span className="tile-fill-3 shrink-0 rounded-full px-3.5 py-2 text-[14px] font-semibold text-primary">
        Open
      </span>
    </Link>
  );
}
