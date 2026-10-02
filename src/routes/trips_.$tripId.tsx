import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TripDetail } from "@/components/TripDetail";
import { useTripPhotos } from "@/hooks/useTripPhotos";
import { useTrips } from "@/hooks/useTrips";
import { useAuth } from "@/hooks/useAuth";
import { tripCompanionsLine } from "@/lib/trip-copy";
import { TripDetailSkeleton } from "@/components/Skeletons";
import { clearOfflineMap } from "@/lib/offline-map";
import { safeStorage } from "@/lib/tour-state";
import { clearPendingTryPlan, peekPendingTryPlan } from "@/lib/try-plan";
import type { PrepTab } from "@/components/TripPrep";
import type { PlannerTab } from "@/components/ItineraryImport";

type TripSearch = {
  prep?: PrepTab;
  /** Open on the Bookings tab. */
  view?: "bookings";
  /** Open Plan with Béa on this panel (from the Plan with Béa page). */
  plan?: PlannerTab;
  /** Words to start Build with. */
  ask?: string;
  /** Import the plan pasted on the landing page, which waits on the phone. */
  from?: "try";
};

const PLAN_ENTRIES: readonly PlannerTab[] = ["start", "build", "import", "optimize", "compare"];

export const Route = createFileRoute("/trips_/$tripId")({
  staticData: { plane: "detail" },
  // `?prep=todo` or `?prep=packing` opens the to-do / packing sheet, for
  // Home's shortcuts. Anything else is ignored.
  validateSearch: (search: Record<string, unknown>): TripSearch => ({
    ...(search["prep"] === "todo" || search["prep"] === "packing" ? { prep: search["prep"] } : {}),
    ...(search["view"] === "bookings" ? { view: "bookings" as const } : {}),
    ...(PLAN_ENTRIES.includes(search["plan"] as PlannerTab)
      ? { plan: search["plan"] as PlannerTab }
      : {}),
    ...(typeof search["ask"] === "string" && search["ask"].trim()
      ? { ask: search["ask"].slice(0, 2000) }
      : {}),
    ...(search["from"] === "try" ? { from: "try" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Trip — Béa" },
      {
        name: "description",
        content: "Your itinerary, stops, to-dos and documents for this trip.",
      },
      // A trip is somebody's private travel plan. It should never be indexed
      // even though the page itself is behind sign-in anyway.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TripPage,
});

function TripPage() {
  const { tripId } = Route.useParams();
  const { prep, view, plan, ask, from } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = useTrips();
  const { photos } = useTripPhotos(t.uid);
  const trip = t.trips.find((row) => row.id === tripId) ?? null;
  // The plan pasted before sign-up comes from the phone's storage, not the
  // link, so it never sits in a URL or the history. Held here once read.
  const [tryAsk] = useState(() =>
    from === "try" && plan === "import" && !ask ? peekPendingTryPlan(safeStorage()) : null,
  );
  const tripFound = Boolean(trip);
  useEffect(() => {
    if (tryAsk && tripFound) clearPendingTryPlan(safeStorage());
  }, [tryAsk, tripFound]);

  const myName =
    (user?.user_metadata?.["display_name"] as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Traveller";

  // Three states, and they are genuinely different: still loading, loaded but
  // this trip is not yours (or is gone), and here it is. Collapsing the first
  // two into one message is what makes an app feel like it lost your data.
  if (t.loading) {
    return (
      <AppShell eyebrow="Trip" title="Opening…">
        <TripDetailSkeleton />
      </AppShell>
    );
  }

  if (!trip) {
    return (
      <AppShell eyebrow="Trip" title="This trip isn't here.">
        <div className="card-soft p-4">
          <p className="text-[14.5px] text-muted-foreground">
            It may have been deleted, or the link may belong to an account you are not signed in to.
          </p>
          <Link
            to="/trips"
            className="mt-3 block rounded-xl bg-primary px-4 py-2.5 text-center text-[14.5px] font-semibold text-primary-foreground"
          >
            Back to your trips
          </Link>
        </div>
      </AppShell>
    );
  }

  const members = t.members.filter((m) => m.trip_id === trip.id);

  return (
    // No page title: the trip's own banner is pinned at the top of the page and
    // carries the name, so a second heading above it only took the space.
    <AppShell flush>
      <TripDetail
        trip={trip}
        openPrep={prep}
        openView={view}
        openPlan={plan ? { tab: plan, ask: ask ?? tryAsk ?? undefined } : undefined}
        photos={photos}
        members={members}
        companionsLine={tripCompanionsLine(members, t.uid)}
        me={{ id: t.uid, name: myName }}
        onInvite={() => t.inviteToTrip(trip.id)}
        onRevokeInvite={(code) => t.revokeTripInvite(trip.id, code)}
        onUpdate={(patch) => t.updateTrip(trip.id, patch)}
        // Leaving the page is part of deleting it. Without this you land on
        // your own "this trip isn't here" screen, which reads like a failure
        // rather than the thing you just asked for.
        onDelete={async () => {
          await t.deleteTrip(trip.id);
          // Its map on this phone goes with it: there is no trip left to
          // delete it from.
          void clearOfflineMap(trip.id);
          await navigate({ to: "/trips" });
        }}
        onLeave={async () => {
          await t.leaveTrip(trip.id);
          void clearOfflineMap(trip.id);
          await navigate({ to: "/trips" });
        }}
        onRemoveMember={(userId) => t.removeTripMember(trip.id, userId)}
      />
    </AppShell>
  );
}
