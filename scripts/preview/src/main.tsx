import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { TripDetail } from "@/components/TripDetail";
import {
  HomeLaterTrips,
  HomeNextUp,
  HomeSectionTitle,
  HomeTripHero,
} from "@/components/HomeTripCard";
import { HomeWeather } from "@/components/HomeWeather";
import { HomeSaveTile } from "@/components/HomeSaveTile";
import { TripCard } from "@/components/TripCard";
import { useTrips } from "@/hooks/useTrips";
import { useTripGlances } from "@/hooks/useTripGlances";
import { useNearMe } from "@/hooks/useNearMe";
import { laterTrips, peopleOnTrip, pickActiveTrip } from "@/lib/home-trip";
import { toLocalISODate } from "@/lib/trip-dates";
import { db } from "./fake-supabase";

/** Home below the header, as SignedInHome lays it out. */
function HomePreview() {
  const t = useTrips();
  const near = useNearMe();
  const today = toLocalISODate(new Date());
  const trip = pickActiveTrip(t.trips, today);
  const later = laterTrips(t.trips, trip, today);
  const { glances } = useTripGlances([trip?.id, ...later.map((x) => x.id)].filter(Boolean) as string[]);
  const reco = db.recommendations?.[0] as { name: string; city: string } | undefined;
  if (!trip) return null;
  return (
    <div className="space-y-8">
      <div>
        <p className="label-caps">Monday, 28 September</p>
        <h1 className="mt-1.5 text-[27px] leading-[1.06]">Good morning, Mattie.</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">Your next chapter is taking shape.</p>
      </div>
      <HomeTripHero trip={trip} glance={glances[trip.id]} photos={[]} peopleCount={peopleOnTrip(t.members, trip.id, t.uid)} />
      <section>
        <HomeSectionTitle title="At a glance" aside={<a>Los Angeles overview</a>} />
        <div className="grid grid-cols-2 gap-3">
          <HomeWeather near={near} />
          <HomeSaveTile pins={[]} near={near} waiting={reco} />
        </div>
      </section>
      <HomeNextUp trip={trip} glance={glances[trip.id]} uid={t.uid} />
      <HomeLaterTrips trips={later} photos={[]} glances={glances} members={t.members} uid={t.uid} />
    </div>
  );
}

/** The trips list's cards. */
function TripsPreview() {
  const t = useTrips();
  const { glances } = useTripGlances(t.trips.map((x) => x.id));
  return (
    <div className="space-y-4">
      {t.trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} photos={[]} glance={glances[trip.id]} peopleCount={peopleOnTrip(t.members, trip.id, t.uid)} />
      ))}
    </div>
  );
}

const sample = new URLSearchParams(location.search).get("sample") ?? "default";
const guest = sample === "guest";
const trip = {
  id: "t1",
  title: "JQAPALA A",
  city: "Hiroshima",
  country: "Japan",
  start_date: sample === "undated" ? null : "2026-10-07",
  end_date: sample === "undated" ? null : "2026-10-08",
  dates_status: "fixed",
  status: "upcoming",
  budget_enabled: true,
  owner_id: guest ? "someone-else" : "me",
} as never;

if (sample === "home" || sample === "home-trips") {
  createRoot(document.getElementById("root")!).render(
    <div className="min-h-screen bg-background px-4 py-4">
      {sample === "home" ? <HomePreview /> : <TripsPreview />}
    </div>,
  );
} else createRoot(document.getElementById("root")!).render(
  // Like the app shell on a phone: full width, no padding, page scrolls.
  <div className="min-h-screen bg-background pb-7">
    <Toaster />
    <TripDetail
      trip={trip}
      photos={[]}
      members={[
        { id: "m1", trip_id: "t1", user_id: guest ? "someone-else" : "me", role: "owner", display_name: guest ? "Chloé" : "Mattie" },
        ...(guest ? [{ id: "m2", trip_id: "t1", user_id: "me", role: "member", display_name: "Mattie" }] : []),
      ]}
      companionsLine="Flying solo"
      me={{ id: "me", name: "Mattie" }}
      onInvite={async () => "K7Q2PM"}
      onRevokeInvite={async () => {}}
      onUpdate={async () => {}}
      onDelete={async () => {}}
      onLeave={async () => {}}
      onRemoveMember={async () => {}}
    />
  </div>,
);
