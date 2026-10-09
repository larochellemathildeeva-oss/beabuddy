import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { browserHasStoredSession } from "@/lib/stored-session";
import { hasPendingOAuthResultInWindow } from "@/lib/auth-redirect";
import { AppShell } from "@/components/AppShell";
import { ArrowRight } from "@/components/icons";
import { Globe } from "@/components/Globe";
import { HomeSuggested, HomeUpcoming, HomeWhereNext } from "@/components/HomeLivingMap";
import {
  HomeNoTripHero,
  HomeOnTrip,
  HomeSavedCard,
  HomeWaiting,
  NowCards,
} from "@/components/HomeMoods";
import { laterTrips, pastTrips, pickActiveTrip } from "@/lib/home-trip";
import { savedCities } from "@/lib/home-now";
import { isUnderway } from "@/lib/trip-card";
import { toLocalISODate } from "@/lib/trip-dates";
import { NearHome } from "@/components/NearHome";
import { HomeWeather, WeatherCredit } from "@/components/HomeWeather";
import { useNearMe } from "@/hooks/useNearMe";
import { useTrips } from "@/hooks/useTrips";
import { useTripPhotos } from "@/hooks/useTripPhotos";
import { useTripGlances } from "@/hooks/useTripGlances";
import { greetingFor, heroTags } from "@/lib/trip-glance";

import { useAuth } from "@/hooks/useAuth";
import { useFutureNotes } from "@/hooks/useFutureNotes";
import { useHomeLayout, useHomeTripMoment, type HomeSectionKey } from "@/hooks/useHomeLayout";
import { HomeTripModule } from "@/components/HomeModules";
import { useHomeTripModules } from "@/hooks/useHomeTripModules";
import { HomeWidgetGrid } from "@/components/HomeWidgetGrid";
import { CustomizeHome } from "@/components/CustomizeHome";
import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { supabase } from "@/integrations/supabase/client";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { rankOpportunities } from "@/lib/score-opportunity";
import { hasDismissedSampleCta } from "@/lib/auto-seed";
import { demoGlobePins } from "@/lib/demo-seed";
import { beaLine, BEA_HELPS, BEA_POSITION, BEA_TAGLINES } from "@/lib/bea-voice";
import { safeStorage } from "@/lib/tour-state";
import { rememberedProfileName, rememberProfileName, shownName } from "@/lib/profile-name";
import { isAreaPlace } from "@/lib/reco-place";

export const Route = createFileRoute("/")({
  staticData: { plane: "tab" },
  head: () => ({
    meta: [
      { title: "Béa — Your travel life, all in one place" },
      {
        name: "description",
        content:
          "Béa turns the places you saved into a real trip: she drafts the days, orders them, gives directions and keeps your bookings — then remembers where you've been.",
      },
      { property: "og:title", content: "Béa — Your travel life, all in one place" },
      {
        property: "og:description",
        content:
          "Remember everywhere. Go anywhere. A travel memory, recommendation, and planning companion — not another AI trip generator.",
      },
    ],
  }),
  component: HomePage,
});

const noSubscribe = () => () => {};

function HomePage() {
  const { user, loading } = useAuth();
  // While sign-in is still being checked, a browser with no saved session is
  // a visitor: show them the welcome page now rather than "Loading…" first.
  // The server cannot know, so it paints the neutral opening screen.
  // Back from Google, the session is not saved yet but is about to be: that
  // counts as signed in too, or the welcome page flashes before Home.
  const maybeSignedIn = useSyncExternalStore(
    noSubscribe,
    () => browserHasStoredSession() || hasPendingOAuthResultInWindow(),
    () => true,
  );

  if (!user && (!loading || !maybeSignedIn)) {
    return <LandingPage />;
  }

  return <SignedInHome />;
}

function LandingPage() {
  const pins = useMemo(() => demoGlobePins(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <AppShell
      publicPage
      eyebrow="Plan · Explore · Remember"
      title="A more meaningful way to travel."
    >
      <div className="space-y-6">
        {/* The destination first, then the ways in, where a thumb reaches them. */}
        <div
          className="landing-art"
          role="img"
          aria-label="A sunlit coast with a flight path over it"
        >
          <span className="landing-art-pill">Amalfi Coast, Italy</span>
        </div>
        <LandingWays />
        <p className="text-[17px] leading-snug text-muted-foreground">
          Save the places you care about.
          <br />
          Turn them into real trips.
          <br />
          Follow the day while you travel.
          <br />
          Remember it all.
        </p>
        <StartFree />
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {BEA_HELPS} She drafts the days from your saved places or reads a plan you already have,
          puts them in a sensible order, gives directions and keeps your bookings together.
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {LANDING_POINTS.map((point) => (
            <li key={point.title} className="surface border border-border/50 p-3.5">
              <p className="font-display text-[18px] leading-snug">{point.title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{point.body}</p>
            </li>
          ))}
        </ul>
        <Globe
          pins={pins}
          selectedId={selectedId}
          onSelect={(pin) => setSelectedId(pin.id)}
          scrollFriendly
          autoSpin
        />
        <p className="text-[13px] text-muted-foreground">
          The places on this globe are examples. Yours fill it in once you start saving.
        </p>
        <section className="surface border border-border/50 p-5 text-center">
          <p className="font-display text-[22px] leading-tight">{BEA_TAGLINES.recommendations}</p>
          <div className="mt-4">
            <StartFree />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/** The three ways in, stacked as in the welcome design. */
function LandingWays() {
  const ways = [
    {
      to: "/auth",
      search: { mode: "signup" },
      fill: "tile-fill-5",
      title: "Plan with Béa",
      hint: "Start a trip, Béa drafts the days",
      icon: "M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M18 6l-2 2M8 16l-2 2",
    },
    {
      to: "/auth",
      search: { mode: "signup", redirect: "/trips" },
      fill: "tile-fill-3",
      title: "Join with a code",
      hint: "Plan a trip with friends",
      icon: "M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-3 0-5 1.5-5 4v1h10v-1c0-2.5-2-4-5-4Zm8 0c-.6 0-1.2.1-1.7.2 1.2.9 1.7 2 1.7 3.8v1h5v-1c0-2.5-2-4-5-4Z",
    },
    {
      to: "/auth",
      search: {},
      fill: "tile-fill-1",
      title: "Sign in or create an account",
      hint: "Save your trips and more",
      icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1",
    },
  ] as const;
  return (
    <div className="space-y-2.5">
      {ways.map((w) => (
        <Link
          key={w.title}
          to={w.to}
          search={w.search}
          className={`${w.fill} flex min-h-[68px] items-center gap-3 rounded-[20px] border border-border p-2.5 pe-3 shadow-[var(--shadow-sm)]`}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-card/80 text-foreground">
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d={w.icon} />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[18px] leading-tight">{w.title}</span>
            <span className="block text-[14px] text-foreground/75">{w.hint}</span>
          </span>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-[var(--shadow-xs)]">
            <ArrowRight className="size-[18px]" aria-hidden />
          </span>
        </Link>
      ))}
    </div>
  );
}

/** What a visitor gets, in their words rather than the features'. */
const LANDING_POINTS = [
  {
    title: "Plan from what you saved",
    body: "Paste links, friends' tips or a plan you already have. Béa turns them into days.",
  },
  {
    title: "Help on the day",
    body: "Directions, bookings and the café you saved months ago, when you're two streets away.",
  },
  {
    title: "Remember everywhere",
    body: "Every trip fills in your map, so Future You knows where to go back.",
  },
] as const;

/** The sign-up button, with what it costs (nothing) right under it. */
function StartFree() {
  return (
    <div className="space-y-3">
      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className="flex min-h-14 items-center justify-between gap-3 rounded-full bg-foreground py-1.5 ps-6 pe-1.5 text-[17px] font-semibold text-background"
      >
        Create your free account
        <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
          <ArrowRight className="size-5" aria-hidden />
        </span>
      </Link>
      <Link
        to="/how-it-works"
        className="flex min-h-14 items-center gap-3 rounded-full bg-card py-1.5 ps-1.5 pe-6 text-[17px] font-semibold shadow-sm"
      >
        <span className="grid size-11 place-items-center rounded-full bg-foreground text-background">
          <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
            <path d="M8 5v14l11-7Z" />
          </svg>
        </span>
        How Béa works
      </Link>
      <p className="text-center text-[14px] text-muted-foreground">
        Free · No card · One tap with Google ·{" "}
        <Link to="/auth" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function SignedInHome() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(() =>
    user ? rememberedProfileName(safeStorage(), user.id) : "",
  );
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [homeCity, setHomeCity] = useState("");
  const photo = usePhotoMemories();
  const vault = useRecommendations();
  const notes = useFutureNotes();
  const scorePrefs = useScorePrefs();
  // One position for the whole of Home: the weather and Near share it.
  const near = useNearMe();
  const trips = useTrips();
  const { photos } = useTripPhotos(trips.uid);
  const todayIso = toLocalISODate(new Date());
  const trip = useMemo(() => pickActiveTrip(trips.trips, todayIso), [trips.trips, todayIso]);
  const later = useMemo(
    () => laterTrips(trips.trips, trip, todayIso),
    [trips.trips, trip, todayIso],
  );
  const past = useMemo(() => pastTrips(trips.trips, todayIso), [trips.trips, todayIso]);
  const glanceIds = useMemo(
    () => [trip?.id, ...later.map((t) => t.id)].filter((id): id is string => Boolean(id)),
    [trip, later],
  );
  const { glances } = useTripGlances(glanceIds);

  useEffect(() => {
    if (!user) {
      setDisplayName("");
      setProfileLoaded(false);
      setHomeCity("");
      return;
    }
    let active = true;
    setDisplayName((current) => current || rememberedProfileName(safeStorage(), user.id));
    supabase
      .from("profiles")
      .select("display_name, home_city")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error) setProfileLoaded(true);
        if (!data) return;
        setDisplayName(data.display_name ?? "");
        setHomeCity(data.home_city ?? "");
        rememberProfileName(safeStorage(), user.id, data.display_name ?? "");
      });
    return () => {
      active = false;
    };
  }, [user]);

  const firstName =
    shownName({ profileName: displayName, profileLoaded, email: user?.email }).split(" ")[0] ?? "";

  const topReco = useMemo(() => {
    // A city or country added on the World tab is a place you have been, not
    // a saved spot waiting for you.
    const venues = vault.rows.filter((row) => !isAreaPlace(row));
    const ids = new Set(venues.map((row) => `reco-${row.id}`));
    const ranked = rankOpportunities(
      vault.comparePins.filter((pin) => ids.has(pin.id)),
      scorePrefs,
    );
    const winner = ranked[0]?.pin;
    if (!winner) return venues[0];
    return venues.find((row) => `reco-${row.id}` === winner.id) ?? venues[0];
  }, [vault.comparePins, vault.rows, scorePrefs]);
  const topNote = notes.rows[0];
  // Places saved and not yet been to, by city: what is waiting for a trip.
  const waiting = useMemo(
    () => savedCities(vault.rows.filter((row) => !isAreaPlace(row))),
    [vault.rows],
  );
  const empty = photo.rows.length === 0 && vault.rows.length === 0 && notes.rows.length === 0;
  const sampleCtaDismissed = Boolean(user?.id && hasDismissedSampleCta(safeStorage(), user.id));
  const showSamplePrompt = empty && !sampleCtaDismissed;
  const { layout, modules, shown, resize, reorder } = useHomeLayout();
  // Untouched, Home with a trip ahead is the design's; with none, the no-trip modules.
  useHomeTripMoment(trips);
  const [editing, setEditing] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);
  // Entering arrangement from the Customize card at the bottom: bring the
  // bar (and the handles under it) into view and put focus on Done.
  useEffect(() => {
    if (!editing) return;
    doneRef.current?.scrollIntoView({ block: "center" });
    doneRef.current?.focus({ preventScroll: true });
  }, [editing]);

  const now = new Date();
  const today = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const greeting = greetingFor(now.getHours());
  const showTrip = layout.trip && trip && !trips.loading;
  // Under way whether or not the Trips module shows: the trip modules read it too.
  const tripUnderway = Boolean(
    trip && !trips.loading && isUnderway(trip.start_date, trip.end_date, now),
  );
  const underway = Boolean(showTrip && tripUnderway);
  // No trip: the header is the map of the saved cities, once any can be placed.
  const noTripMap =
    layout.waiting &&
    !trips.loading &&
    !trip &&
    !vault.loading &&
    waiting.some((c) => c.lat !== null && c.lon !== null);
  const greetingLine = firstName ? `${greeting}, ${firstName}` : greeting;
  const showSave = layout.waiting && Boolean(topReco);
  // The others, next ones first, then the ones you're back from.
  const others = [...later, ...past.filter((t) => t.id !== trip?.id)];
  const tripModules = useHomeTripModules({
    trip: trip && !trips.loading ? trip : null,
    glance: trip ? glances[trip.id] : undefined,
    members: trips.members,
    saved: vault.rows,
    underway: tripUnderway,
  });
  const TRIP_ONLY = new Set<HomeSectionKey>([
    "saved",
    "now",
    "group",
    "tools",
    "weatherThere",
    "detour",
    "notes",
  ]);
  // The trip modules show while there is a trip under way or ahead.
  const shownModules = shown.filter(
    (k) =>
      (!TRIP_ONLY.has(k) || Boolean(trip && !trips.loading)) &&
      (k !== "stops" || (tripUnderway && Boolean(trip && glances[trip.id]))) &&
      (k !== "trip" || !trips.loading) &&
      (k !== "suggested" || Boolean(trip && !trips.loading)),
  );
  const tripWeather =
    Boolean(trip && !trips.loading) &&
    (shownModules.includes("now") || shownModules.includes("weatherThere"));

  /** One module, as the traveller arranged them (Customize home). */
  const homeModule = (key: HomeSectionKey): ReactNode => {
    switch (key) {
      // The trip alone, as the design's card. Its to-dos, flight and packing
      // are inside the trip; the other trips and a new one are on Trips.
      case "trip":
        if (trips.loading) return null;
        return trip ? (
          underway ? (
            <HomeOnTrip trip={trip} photos={photos} glance={glances[trip.id]} showStops={false} />
          ) : (
            <HomeUpcoming trip={trip} photos={photos} />
          )
        ) : (
          <div className="space-y-3 p-4">
            <p className="text-[16px]">
              {others.length > 0
                ? "No trip under way or coming up."
                : "Your next trip starts here."}
            </p>
            <HomeWhereNext />
          </div>
        );
      case "stops":
        return trip ? (
          <NowCards
            trip={trip}
            glance={glances[trip.id]}
            day={heroTags(trip.start_date, trip.end_date, trip.dates_status === "tentative").when}
          />
        ) : null;
      case "suggested":
        return trip ? <HomeSuggested trip={trip} here={tripModules.here} /> : null;
      case "weather":
        return (
          <div className="p-4">
            <p className="mb-3 text-[12px] leading-[1.4]">Weather here</p>
            <HomeWeather near={near} />
          </div>
        );
      case "waiting":
        return (
          <div className="space-y-3 pt-2">
            {noTripMap && (
              <>
                <HomeSavedCard cities={waiting} />
                <HomeWaiting cities={waiting} />
              </>
            )}
            <NearHome pins={vault.pins} near={near} waiting={showSave ? topReco : undefined} />
          </div>
        );
      case "future":
        return topNote ? (
          <section data-guide="home-future" className="rise">
            <SectionHead title={`Future me · ${topNote.city}`} aside="Surfaces on revisit" />
            <div className="plain-card p-4">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-reco" />
                <span className="label-caps">
                  Left {new Date(topNote.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed">{topNote.note}</p>
            </div>
          </section>
        ) : (
          <div className="p-4">
            <p className="text-[12px] leading-[1.4]">Future me note</p>
            <Link to="/recommendations" className="mt-3 flex min-h-11 items-center text-primary">
              Save a place for your next visit
            </Link>
          </div>
        );
      default:
        return trip ? (
          <HomeTripModule
            module={key}
            trip={trip}
            ctx={tripModules}
            me={{ id: user?.id ?? null, name: firstName }}
          />
        ) : null;
    }
  };

  return (
    <AppShell
      homeHeader
      // With a trip ahead, the trip is the headline; without one, the greeting.
      {...(noTripMap
        ? {}
        : {
            title: (
              <>
                {greeting},
                <span className="home-subtitle mt-3 block">
                  {trip && !trips.loading
                    ? `Let’s get back to ${trip.city?.split(",")[0]?.trim() || trip.title}.`
                    : firstName
                      ? `${firstName}, where to next?`
                      : "Where to next?"}
                </span>
              </>
            ),
          })}
    >
      <div className="space-y-5">
        {editing && (
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
            <div>
              <p className="font-semibold">Customize home</p>
              <p className="text-[13px] text-muted-foreground">
                Drag a handle or use the arrow keys. Pick a size.
              </p>
            </div>
            <button
              ref={doneRef}
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-11 min-w-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
            >
              Done
            </button>
          </div>
        )}
        {noTripMap && <HomeNoTripHero greeting={greetingLine} date={today} cities={waiting} />}
        <div className="home-widgets-frame">
          <HomeWidgetGrid
            modules={modules}
            items={shownModules}
            editing={editing}
            render={homeModule}
            onResize={resize}
            onReorder={reorder}
          />
        </div>

        {showSamplePrompt && (
          <section data-guide="home-empty" className="rise plain-card p-5">
            <p className="font-display text-[20px] leading-snug">{beaLine("empty.home").title}</p>
            <p className="mt-1 text-[14.5px] text-muted-foreground">{beaLine("empty.home").body}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/trips/plan"
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-[14.5px] font-semibold text-primary-foreground"
              >
                Plan a trip
              </Link>
              <Link
                to="/recommendations"
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-center text-[14.5px] font-semibold"
              >
                Save a place
              </Link>
            </div>
          </section>
        )}

        <CustomizeHome variant="card" trips={trips} onArrange={() => setEditing(true)} />

        {((shownModules.includes("weather") && near.consent && near.state === "ok") ||
          tripWeather) && <WeatherCredit />}
      </div>
    </AppShell>
  );
}

function SectionHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[20px] font-semibold leading-[1.4]">{title}</h2>
      {aside && <span className="text-[12px] text-muted-foreground">{aside}</span>}
    </div>
  );
}
