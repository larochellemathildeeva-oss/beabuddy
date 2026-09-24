import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DaySelector } from "@/components/DaySelector";
import { StopCard } from "@/components/day/StopCard";
import { TripDetailSkeleton } from "@/components/Skeletons";
import { useAuth } from "@/hooks/useAuth";
import { useTripBoard, useTrips } from "@/hooks/useTrips";
import { dayShapeLine } from "@/lib/day-shape";
import { formatTripLocation } from "@/lib/place-label";
import { groupTimelineByDay } from "@/lib/timeline-groups";
import { toLocalISODate } from "@/lib/trip-dates";
import {
  ALL_DAYS,
  dayChips,
  defaultDayChoice,
  shouldOfferDays,
  visibleGroups,
  type DayChoice,
} from "@/lib/trip-days";
import {
  defaultPerspective,
  TRIP_PERSPECTIVES,
  tripIsUnderway,
  type TripPerspective,
} from "@/lib/trip-perspective";

/**
 * The trip, read a day at a time.
 *
 * A second way into the same trip, beside `/trips/$tripId` rather than
 * instead of it. Everything here reads the same tables through the same
 * hooks; nothing is migrated and nothing is removed, so the existing screen
 * keeps working untouched while this one grows.
 *
 * The composition is the part that is new. A day leads, a perspective says
 * what you want from it, and the trip-wide material — stops, prep, packing,
 * documents, budget — is a peer of the day views rather than a pile
 * underneath them.
 */
export const Route = createFileRoute("/trips_/$tripId_/day")({
  staticData: { plane: "detail" },
  head: () => ({
    meta: [
      { title: "Trip — Béa" },
      { name: "description", content: "Your trip, one day at a time." },
      // Somebody's private travel plan, behind sign-in either way.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TripDayPage,
});

function TripDayPage() {
  const { tripId } = Route.useParams();
  const { user } = useAuth();
  const t = useTrips();
  const trip = t.trips.find((row) => row.id === tripId) ?? null;

  const myName =
    (user?.user_metadata?.["display_name"] as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Traveller";

  if (t.loading) {
    return (
      <AppShell eyebrow="Trip" title="Opening…">
        <TripDetailSkeleton />
      </AppShell>
    );
  }

  // Loaded, but this trip is not yours or is gone. Saying so is different
  // from still loading, and collapsing the two is what makes an app feel
  // like it lost your data.
  if (!trip) {
    return (
      <AppShell eyebrow="Trip" title="Not found">
        <div className="card-soft space-y-3 p-4">
          <p className="text-[14.5px] text-muted-foreground">
            That trip isn't here. It may have been removed, or it belongs to another account.
          </p>
          <Link
            to="/trips"
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground"
          >
            Back to trips
          </Link>
        </div>
      </AppShell>
    );
  }

  return <TripDay trip={trip} me={{ id: t.uid, name: myName }} />;
}

function TripDay({
  trip,
  me,
}: {
  trip: NonNullable<ReturnType<typeof useTrips>["trips"][number]>;
  me: { id: string | null; name: string };
}) {
  const board = useTripBoard(trip.id, me);
  const todayKey = toLocalISODate(new Date());
  const underway = tripIsUnderway(trip, todayKey);

  const [perspective, setPerspective] = useState<TripPerspective>(defaultPerspective(underway));
  const [dayChoice, setDayChoice] = useState<DayChoice | null>(null);

  const groups = groupTimelineByDay(board.items);
  const chosenDay = dayChoice ?? defaultDayChoice(groups, todayKey);
  const shown = visibleGroups(groups, chosenDay);
  const offerDays = shouldOfferDays(groups);

  const where = formatTripLocation(trip.city, trip.country);
  const active = TRIP_PERSPECTIVES.find((p) => p.id === perspective)!;

  return (
    <AppShell
      eyebrow={where || "Trip"}
      title={trip.title}
      headerAction={
        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          aria-label="Open the full trip page"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
      }
    >
      <div className="space-y-4">
        <nav
          role="tablist"
          aria-label="How to look at this trip"
          className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1"
        >
          {TRIP_PERSPECTIVES.map((p) => {
            const on = p.id === perspective;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPerspective(p.id)}
                className={`min-h-11 shrink-0 rounded-xl border px-4 text-[13.5px] font-semibold transition-colors ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </nav>
        <p className="text-[12.5px] text-muted-foreground">{active.hint}</p>

        {perspective === "trip" ? (
          <TripWide />
        ) : (
          <>
            {board.items.length > 0 && offerDays && (
              <DaySelector
                chips={dayChips(groups, todayKey)}
                value={chosenDay}
                onChange={setDayChoice}
              />
            )}

            {board.items.length === 0 ? (
              <EmptyTimeline tripId={trip.id} />
            ) : perspective === "timeline" ? (
              <div className="space-y-4">
                {shown.map((group) => (
                  <section key={group.key || "undated"} className="space-y-2">
                    <header className="flex items-baseline justify-between gap-3">
                      <h2 className="font-display text-[21px] leading-tight">{group.label}</h2>
                      <span className="shrink-0 text-[12px] text-muted-foreground">
                        {dayShapeLine(group.items)}
                      </span>
                    </header>
                    <div className="space-y-2">
                      {group.items.map((item, i) => (
                        <StopCard key={item.id} item={item} index={i} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <NotYet perspective={perspective} tripId={trip.id} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function EmptyTimeline({ tripId }: { tripId: string }) {
  return (
    <div className="card-soft space-y-3 p-4">
      <p className="font-display text-[19px] leading-snug">Nothing on this trip yet.</p>
      <p className="text-[14px] text-muted-foreground">
        Add stops on the full trip page, or let Béa draft the days from a plan you already have.
      </p>
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground"
      >
        <Sparkles className="size-4" aria-hidden />
        Open the trip page
      </Link>
    </div>
  );
}

/**
 * A view that is planned but not built.
 *
 * It says which one and where the working version is, rather than rendering
 * an empty frame. A blank panel reads as broken; a named gap reads as a
 * roadmap, and this route is being built in the open.
 */
function NotYet({ perspective, tripId }: { perspective: TripPerspective; tripId: string }) {
  const copy =
    perspective === "companion"
      ? {
          title: "The companion view is next.",
          body: "Where you are now, what is next, and when to leave for it. It needs a place to record that you arrived somewhere, which the timeline does not store yet.",
        }
      : {
          title: "The day map is on its way.",
          body: "Today's stops drawn in relation to each other, with the list and the map moving together.",
        };
  return (
    <div className="card-soft space-y-3 p-4">
      <p className="font-display text-[19px] leading-snug">{copy.title}</p>
      <p className="text-[14px] text-muted-foreground">{copy.body}</p>
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-[14.5px] font-semibold"
      >
        Use the full trip page
      </Link>
    </div>
  );
}

/**
 * Everything that belongs to the trip rather than to a day.
 *
 * Deliberately a peer of the day views. The prototype this layout comes from
 * had none of it — no budget, no packing, no documents, no invitations — and
 * a day-centric screen that quietly dropped them would lose more than it
 * gained. For now this points at the page that has them; the components move
 * here as each is brought across.
 */
function TripWide() {
  return (
    <div className="card-soft space-y-2 p-4">
      <p className="font-display text-[19px] leading-snug">Trip-wide, still on the old page.</p>
      <p className="text-[14px] text-muted-foreground">
        Stops and cities, before-you-go checks, packing, to-dos, documents, the budget and the
        people you're travelling with all live on the full trip page. They move here one at a time —
        nothing is being dropped on the way.
      </p>
    </div>
  );
}
