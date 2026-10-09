import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ThemePicker } from "@/components/ThemePicker";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { TripDetail } from "@/components/TripDetail";
import { HomeYourTrips } from "@/components/HomeTripCard";
import { HomeUpcoming, HomeWhereNext, HomeSuggested } from "@/components/HomeLivingMap";
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
import { Route as WorldRoute } from "@/routes/world";
import { Route as RecsRoute } from "@/routes/recommendations";
import { Route as AuthRoute } from "@/routes/auth";
import { Welcome } from "@/components/Welcome";
import { Route as ProfileRoute } from "@/routes/profile";
import { Route as HelpRoute } from "@/routes/help";
import { Route as PlanRoute } from "@/routes/trips_.plan";
import { Route as HowRoute } from "@/routes/how-it-works";
import { Route as PrivacyRoute } from "@/routes/privacy";
import { Route as TermsRoute } from "@/routes/terms";
import { Route as PrefsRoute } from "@/routes/preferences";
import { Route as BeaRoute } from "@/routes/profile_.bea";
import { Route as DocsRoute } from "@/routes/profile_.documents";
import { Route as ForgotRoute } from "@/routes/forgot-password";
import { Route as ResetRoute } from "@/routes/reset-password";
import { Route as SharedRoute } from "@/routes/shared.$token";
import { ErrorPage, NotFoundPage } from "@/components/SystemState";
import { Route as CalendarRoute } from "@/routes/_authenticated/calendar";
import { Route as ExpensesRoute } from "@/routes/_authenticated/expenses";
import { Route as MemoriesRoute } from "@/routes/_authenticated/memories";
import { Route as PhotosRoute } from "@/routes/_authenticated/photos";
import { Route as StoryRoute } from "@/routes/_authenticated/story";

/** The pages the mockup does not show, each rendered as its own route. */
const PAGES: Record<string, unknown> = {
  help: HelpRoute, how: HowRoute, privacy: PrivacyRoute, terms: TermsRoute, prefs: PrefsRoute,
  bea: BeaRoute, docs: DocsRoute, forgot: ForgotRoute, reset: ResetRoute, shared: SharedRoute, "shared-gone": SharedRoute,
  calendar: CalendarRoute, expenses: ExpensesRoute, memories: MemoriesRoute, photos: PhotosRoute, story: StoryRoute,
  plan: PlanRoute,
};

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
      <HomeWhereNext />
      <HomeSuggested trip={trip} here={{ city: "Hiroshima", stopCountry: "Japan" }} />
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

if (sample === "not-found") {
  createRoot(document.getElementById("root")!).render(<NotFoundPage />);
} else if (sample === "error-page") {
  createRoot(document.getElementById("root")!).render(<ErrorPage error={new Error("preview")} reset={() => {}} />);
} else if (sample === "docs-open") {
  // Trip documents with the lock off and a few bookings in it.
  const Page = (DocsRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<Page />);
} else if (sample.startsWith("page-") && PAGES[sample.slice(5)]) {
  const Page = (PAGES[sample.slice(5)] as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<Page />);
} else if (sample === "auth") {
  const AuthPage = (AuthRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<AuthPage />);
} else if (sample === "welcome") {
  // The first-use welcome, over an empty page.
  createRoot(document.getElementById("root")!).render(<Welcome />);
} else if (sample.startsWith("homepage") || sample === "landing") {
  startAccountSettingsSync();
  // The Home route itself, in the app's frame.
  const HomePage = (HomeRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<HomePage />);
} else if (sample === "world") {
  // The World tab itself, in the app's frame.
  const WorldPage = (WorldRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<WorldPage />);
} else if (sample === "recs") {
  // The Recs tab itself, in the app's frame.
  const RecsPage = (RecsRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<RecsPage />);
} else if (sample === "you") {
  // The You tab itself, in the app's frame.
  const YouPage = (ProfileRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<YouPage />);
} else if (sample === "trips") {
  // The Trips tab itself, in the app's frame.
  const TripsPage = (TripsRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
  createRoot(document.getElementById("root")!).render(<TripsPage />);
} else if (sample === "buttons") {
  // Every kind of button the shell styles, side by side.
  createRoot(document.getElementById("root")!).render(
    <div className="space-y-3 p-4">
      <Button data-k="default">Save</Button>
      <Button data-k="secondary" variant="secondary">Not now</Button>
      <Button data-k="destructive" variant="destructive">Delete</Button>
      <button data-k="raw" type="button" className="rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-primary-foreground">Raw primary</button>
      <button data-k="pill" type="button" className="rounded-full bg-primary px-4 py-3 text-[15px] font-semibold text-primary-foreground">Word pill</button>
      <Switch data-k="switch" aria-label="Test switch" />
      <button data-k="round" aria-label="Round" type="button" className="size-10 rounded-full bg-primary text-primary-foreground">+</button>
    </div>,
  );
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
    <div className="page-lit min-h-screen bg-background px-4 py-4">
      {sample === "home" ? <HomePreview /> : <TripsPreview />}
    </div>,
  );
} else {
const detail = (
  // Like the app shell on a phone: full width, no padding, page scrolls.
  <div className="page-lit min-h-screen bg-background pb-7">
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
createRoot(document.getElementById("root")!).render(new URLSearchParams(location.search).get("frame") !== "no" ? <AppShell flush>{detail}</AppShell> : detail);
}
