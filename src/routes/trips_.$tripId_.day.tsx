import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DaySelector } from "@/components/DaySelector";
import { DayMap } from "@/components/day/DayMap";
import { NowPanel } from "@/components/day/NowPanel";
import { StopCard } from "@/components/day/StopCard";
import { Section } from "@/components/Section";
import { TripBudget } from "@/components/TripBudget";
import { TripPeople } from "@/components/TripPeople";
import { TripStops } from "@/components/TripStops";
import { TripTodosBody } from "@/components/TripTodos";
import { PackingBody } from "@/components/PackingLists";
import { useTripStops } from "@/hooks/useTripStops";
import { timelineGlyph } from "@/lib/timeline-kind";

import { TripDetailSkeleton } from "@/components/Skeletons";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineDirections } from "@/hooks/useOfflineDirections";
import { useTripBoard, useTrips, type ItineraryRow, type MemberRow } from "@/hooks/useTrips";
import { companionStops } from "@/lib/companion";
import { timelineStopsForDirections } from "@/lib/direction-stops";
import { savedMatchesStops } from "@/lib/offline-directions";
import { dayMapCaption, dayMapModel, toggleSelection } from "@/lib/day-map";
import { dayShapeLine } from "@/lib/day-shape";
import { OSM_ATTRIBUTION } from "@/lib/geo-endpoints";
import { formatTripLocation } from "@/lib/place-label";
import { groupTimelineByDay, type TimelineDayGroup } from "@/lib/timeline-groups";
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
  const navigate = useNavigate();
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

  return (
    <TripDay
      trip={trip}
      me={{ id: t.uid, name: myName }}
      people={{
        members: t.members.filter((m) => m.trip_id === trip.id),
        onInvite: () => t.inviteToTrip(trip.id),
        onRevokeInvite: (code) => t.revokeTripInvite(trip.id, code),
        onRemoveMember: (userId) => t.removeTripMember(trip.id, userId),
        // Leaving takes the trip away, so there is no page left to stay on.
        onLeave: async () => {
          await t.leaveTrip(trip.id);
          await navigate({ to: "/trips" });
        },
      }}
    />
  );
}

type TripPeopleActions = {
  members: MemberRow[];
  onInvite: () => Promise<string>;
  onRevokeInvite: (code: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onLeave: () => Promise<void>;
};

function TripDay({
  trip,
  me,
  people,
}: {
  trip: NonNullable<ReturnType<typeof useTrips>["trips"][number]>;
  me: { id: string | null; name: string };
  people: TripPeopleActions;
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

  // Saved directions count only while they still describe this timeline;
  // a leg from an older version of the day would give a wrong "Leave by".
  const dir = useOfflineDirections(trip.id);
  const legs = savedMatchesStops(dir.saved?.signature, timelineStopsForDirections(board.items))
    ? (dir.saved?.legs ?? null)
    : null;

  // Now follows one day: the one picked, or today when nothing is.
  const companionDay =
    chosenDay === ALL_DAYS
      ? (groups.find((group) => group.key !== "" && group.key === todayKey) ?? null)
      : (shown[0] ?? null);
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
          <TripWide
            trip={trip}
            uid={me.id}
            items={board.items}
            people={people}
            invites={board.invites}
            reloadBoard={board.reload}
          />
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
            ) : perspective === "map" ? (
              // Keyed on the day, so a selection never outlives the stops it
              // pointed at.
              <DayMapView key={chosenDay} groups={shown} area={where} />
            ) : companionDay ? (
              <NowPanel
                key={companionDay.key}
                dayStops={companionStops(companionDay.items)}
                tripStops={companionStops(board.items)}
                legs={legs}
                onProgress={board.setProgress}
                onPlanStay={(id, minutes) =>
                  board.updateItem(id, { planned_stay_minutes: minutes })
                }
              />
            ) : (
              <PickADay />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

/**
 * The chosen day as a map and a list that point at the same stop.
 *
 * With every day shown, the stops are numbered straight through rather than
 * restarting each day: the pins share one map, and two pins both saying "1"
 * would leave the reader to work out which card each belongs to.
 */
function DayMapView({ groups, area }: { groups: TimelineDayGroup<ItineraryRow>[]; area: string }) {
  // Recomputed each render: `groups` is rebuilt upstream every time, and a
  // day's worth of stops costs nothing to walk.
  const model = dayMapModel(groups.flatMap((group) => group.items));
  const caption = dayMapCaption(model);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pickFromMap = (id: string) => {
    setSelectedId((current) => toggleSelection(current, id));
    // "nearest" leaves the page alone when the card is already in view.
    document.getElementById(`stop-${id}`)?.scrollIntoView({ block: "nearest" });
  };

  // Numbering runs across the days shown, matching the pins.
  const offsets = groups.reduce<number[]>(
    (acc, group, i) => [...acc, i === 0 ? 0 : acc[i - 1]! + groups[i - 1]!.items.length],
    [],
  );

  return (
    <div className="space-y-3">
      {model.plan.kind === "none" ? (
        <div className="card-soft space-y-1 p-4">
          <p className="font-display text-[19px] leading-snug">Nothing to put on the map yet.</p>
          <p className="text-[14px] text-muted-foreground">
            None of {area ? `your ${area} stops` : "these stops"} has a location. Add an address to
            a stop on the full trip page and it appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <DayMap
            pins={model.pins}
            selectedId={selectedId}
            onSelect={pickFromMap}
            label={`Map of ${model.pins.length === 1 ? "one stop" : `${model.pins.length} stops`}`}
          />
          {caption && <p className="text-[12.5px] text-muted-foreground">{caption}</p>}
          {/* The credit ODbL asks for, next to the data it applies to. */}
          <p className="text-[11.5px] text-muted-foreground">{OSM_ATTRIBUTION}</p>
        </div>
      )}

      {groups.map((group, g) => (
        <section key={group.key || "undated"} className="space-y-2">
          {groups.length > 1 && (
            <h2 className="font-display text-[19px] leading-tight">{group.label}</h2>
          )}
          <div className="space-y-2">
            {group.items.map((item, i) => (
              <StopCard
                key={item.id}
                item={item}
                index={offsets[g]! + i}
                selected={item.id === selectedId}
                onSelect={() => setSelectedId((current) => toggleSelection(current, item.id))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
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
 * Now needs one day to follow, and with every day showing on a day that is
 * not today there is no right one to guess.
 */
function PickADay() {
  return (
    <div className="card-soft space-y-2 p-4">
      <p className="font-display text-[19px] leading-snug">Pick a day to follow.</p>
      <p className="text-[14px] text-muted-foreground">
        Choose a day above and Now walks through it with you: where you are, what is next, and when
        to set off. On a travel day it opens on today by itself.
      </p>
    </div>
  );
}

/**
 * Everything that belongs to the trip rather than to a day.
 *
 * Deliberately a peer of the day views. The prototype this layout comes from
 * had none of it — no budget, no packing, no to-dos, no invitations — and a
 * day-centric screen that quietly dropped them would lose more than it
 * gained.
 *
 * These are the same components the full trip page renders, reading the same
 * tables, not copies: an edit here is an edit there. What has not come across
 * yet is named at the bottom with a way to reach it, rather than left out.
 */
function TripWide({
  trip,
  uid,
  items,
  people,
  invites,
  reloadBoard,
}: {
  trip: NonNullable<ReturnType<typeof useTrips>["trips"][number]>;
  uid: string | null;
  items: ItineraryRow[];
  people: TripPeopleActions;
  invites: ReturnType<typeof useTripBoard>["invites"];
  reloadBoard: () => Promise<void>;
}) {
  const cities = useTripStops(trip.id, uid);
  // The same readings the full page gives the to-do list, so its
  // suggestions (passport, insurance, check-in) come out the same here.
  const international = cities.countries.length > 1 || Boolean(trip.country);
  const hasLodging = items.some((item) => timelineGlyph(item) === "lodging");
  const hasFlights = items.some((item) => timelineGlyph(item) === "transport");

  return (
    <div>
      <TripStops tripId={trip.id} uid={uid} />

      <Section
        title="To do"
        hint="Before you go, and anything that comes up on the way."
        defaultOpen
      >
        <TripTodosBody
          tripId={trip.id}
          uid={uid}
          international={international}
          hasLodging={hasLodging}
          hasFlights={hasFlights}
          tripStart={trip.start_date}
        />
      </Section>

      <Section title="Packing" defaultOpen={false}>
        <PackingBody tripId={trip.id} />
      </Section>

      <Section title="People" hint="Who is on this trip, and invite codes." defaultOpen={false}>
        <TripPeople
          trip={trip}
          meId={uid}
          members={people.members}
          invites={invites}
          onInvite={people.onInvite}
          onRevokeInvite={people.onRevokeInvite}
          onRemoveMember={people.onRemoveMember}
          onLeave={people.onLeave}
          onChanged={reloadBoard}
        />
      </Section>

      {trip.budget_enabled ? (
        <TripBudget tripId={trip.id} />
      ) : (
        <p className="mb-3 px-1 text-[13px] text-muted-foreground">
          The budget is off for this trip. Turn it on in trip settings on the full trip page.
        </p>
      )}

      <div className="card-soft space-y-2 p-4">
        <p className="font-display text-[17px] leading-snug">Still on the full trip page</p>
        <p className="text-[13.5px] text-muted-foreground">
          Directions saved for offline use, attaching a packing template, the budget switch, and the
          trip's name, dates and delete. They come across next — nothing is being dropped on the
          way.
        </p>
        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-[14px] font-semibold"
        >
          Open the full trip page
        </Link>
      </div>
    </div>
  );
}
