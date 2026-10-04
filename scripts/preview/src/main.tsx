import { AppShell } from "@/components/AppShell";
import { ThemePicker } from "@/components/ThemePicker";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { TripDetail } from "@/components/TripDetail";
import { HomeYourTrips } from "@/components/HomeTripCard";
import { HomeUpcoming, HomeTripStats, HomeWhereNext, HomeSuggested } from "@/components/HomeLivingMap";
import { HomeWeather } from "@/components/HomeWeather";
import { TripListRow } from "@/components/TripsList";
import { useTrips } from "@/hooks/useTrips";
import { useTripGlances } from "@/hooks/useTripGlances";
import { useNearMe } from "@/hooks/useNearMe";
import { laterTrips, peopleOnTrip, pickActiveTrip } from "@/lib/home-trip";
import { toLocalISODate } from "@/lib/trip-dates";
import { startAccountSettingsSync } from "@/lib/account-settings-sync";
import { Route as TripsRoute } from "@/routes/trips";
import { Route as HomeRoute } from "@/routes/index";

/** Home below the header, as SignedInHome lays it out. */
function HomePreview() {
  const t = useTrips();
  const near = useNearMe();
  const today = toLocalISODate(new Date());
  const trip = pickActiveTrip(t.trips, today);
  const later = laterTrips(t.trips, trip, today);
  const { glances } = useTripGlances([trip?.id, ...later.map((x) => x.id)].filter(Boolean) as string[]);
  if (!trip) return null;
  return (
    <div className="space-y-5">
      <HomeUpcoming trip={trip} photos={[]} />
      <HomeTripStats trip={trip} glance={glances[trip.id]} />
      <HomeWhereNext />
      <HomeSuggested trip={trip} />
      <HomeWeather near={near} />
      <HomeYourTrips trips={later} photos={[]} />
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
        <TripListRow key={trip.id} trip={trip} photos={[]} glance={glances[trip.id]} peopleCount={peopleOnTrip(t.members, trip.id, t.uid)} picture="stops" />
      ))}
    </div>
  );
}

const sampleParams = new URLSearchParams(location.search);
const sample = sampleParams.get("sample") ?? "default";
const guest = sample === "guest";
const trip = {
  id: "t1",
  title: "JQAPALA A",
  city: "Hiroshima",
  country: "Japan",
  start_date: sample === "undated" ? null : (sampleParams.get("from") ?? "2026-10-07"),
  end_date: sample === "undated" ? null : (sampleParams.get("to") ?? "2026-10-08"),
  dates_status: "fixed",
  status: "upcoming",
  budget_enabled: true,
  owner_id: guest ? "someone-else" : "me",
} as never;

if (sample.startsWith("homepage")) {
  // The Home route itself, in the app's frame.
  const HomePage = (HomeRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<HomePage />);
} else if (sample === "trips") {
  // The Trips tab itself, in the app's frame.
  const TripsPage = (TripsRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<TripsPage />);
} else if (sample === "shell") {
  const shellParams = new URLSearchParams(location.search);
  startAccountSettingsSync();
  createRoot(document.getElementById("root")!).render(
    <AppShell
      eyebrow="Appearance"
      title={shellParams.get("title") ?? "Your Béa."}
      homeHeader={shellParams.get("path") === "/"}
      actionBesideEyebrow={shellParams.get("beside") === "yes"}
      headerAction={shellParams.has("beside") ? <span aria-hidden className="block size-11" /> : undefined}
    >
      <ThemePicker />
      <div data-preview-spacer style={{ height: 1100 }} aria-hidden />
    </AppShell>,
  );
} else if (sample === "home" || sample === "home-trips") {
  createRoot(document.getElementById("root")!).render(
    <div className="min-h-screen bg-background px-4 py-4">
      {sample === "home" ? <HomePreview /> : <TripsPreview />}
    </div>,
  );
} else {
const detail = (
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
  </div>
);
createRoot(document.getElementById("root")!).render(new URLSearchParams(location.search).get("frame") === "yes" ? <AppShell flush>{detail}</AppShell> : detail);
}
