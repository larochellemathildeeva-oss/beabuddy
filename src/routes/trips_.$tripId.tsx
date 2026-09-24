import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TripDetail } from "@/components/TripDetail";
import { useTripPhotos } from "@/hooks/useTripPhotos";
import { useTrips } from "@/hooks/useTrips";
import { useAuth } from "@/hooks/useAuth";
import { tripCompanionsLine } from "@/lib/trip-copy";
import { TripDetailSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/trips_/$tripId")({
  staticData: { plane: "detail" },
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = useTrips();
  const { photos } = useTripPhotos(t.uid);
  const trip = t.trips.find((row) => row.id === tripId) ?? null;

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
          await navigate({ to: "/trips" });
        }}
        onLeave={async () => {
          await t.leaveTrip(trip.id);
          await navigate({ to: "/trips" });
        }}
        onRemoveMember={(userId) => t.removeTripMember(trip.id, userId)}
      />
    </AppShell>
  );
}
