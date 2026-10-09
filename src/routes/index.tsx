import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { browserHasStoredSession } from "@/lib/stored-session";
import { hasPendingOAuthResultInWindow } from "@/lib/auth-redirect";
import { AppShell } from "@/components/AppShell";
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
import { beaLine } from "@/lib/bea-voice";
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

/** The welcome page, as the minimalist design draws it ("Minimalist / landing"). */
function LandingPage() {
  const link = "flex min-h-11 items-center text-[14px] text-foreground";
  return (
    <AppShell publicPage>
      <div className="landing space-y-6">
        <header className="space-y-2">
          <h1 className="text-[28px] font-bold leading-[1.4]">
            Turn your saved places into a trip that works.
          </h1>
          <p className="text-[14px] leading-[1.4] text-muted-foreground">
            Béa helps organise your places into daily plans, with directions and bookings together
            when you travel.
          </p>
        </header>

        <div className="space-y-2">
          <StartFree />
          <a href="#example-trip" className={link}>
            See a sample trip
          </a>
          <p className="text-[12px] leading-[1.4] text-muted-foreground">
            Free account · No card required
          </p>
        </div>

        <ExampleTrip />

        <ul className="space-y-3">
          {LANDING_POINTS.map((point) => (
            <li
              key={point.title}
              className="space-y-2 rounded-[var(--r-card)] border border-border bg-card p-4"
            >
              <p className="text-[16px] font-bold leading-[1.4]">{point.title}</p>
              <p className="text-[14px] leading-[1.4] text-muted-foreground">{point.body}</p>
            </li>
          ))}
        </ul>

        <StartFree />

        <nav aria-label="More about Béa" className="space-y-6">
          <Link to="/auth" search={{ mode: "signup", redirect: "/trips" }} className={link}>
            Joining friends? Enter an invite code
          </Link>
          <Link to="/how-it-works" className={link}>
            How Béa works
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/terms" className={link}>
              Terms of Service
            </Link>
            <Link to="/privacy" className={link}>
              Privacy Policy
            </Link>
          </div>
        </nav>
      </div>
    </AppShell>
  );
}

/** A day of an example trip, so a visitor sees what Béa makes before signing up. */
function ExampleTrip() {
  const stops = [
    { time: "09:30", name: "Nishiki Market", note: "Explore the market · 45 minutes" },
    { leg: "Walk · About 12 minutes" },
    { time: "10:30", name: "Coffee in Kyoto", note: "A break before the next stop" },
    { leg: "Travel estimate · About 25 minutes" },
    {
      time: "11:30",
      name: "Museum visit",
      note: "Ticket and booking details together",
      booking: "Example booking · Museum entry",
    },
  ];
  return (
    <section
      id="example-trip"
      aria-label="Example trip"
      className="scroll-mt-20 space-y-3 rounded-[var(--r-card)] border border-border bg-card p-4"
    >
      <p className="text-[12px] font-bold leading-[1.4] text-muted-foreground">Example trip</p>
      <p className="text-[20px] font-bold leading-[1.4]">A day in Kyoto</p>
      <p className="text-[14px] leading-[1.4] text-muted-foreground">
        Your places, in a useful order.
      </p>
      {stops.map((stop, i) =>
        "leg" in stop ? (
          <p key={i} className="text-[12px] leading-[1.4] text-muted-foreground">
            {stop.leg}
          </p>
        ) : (
          <div key={i} className="space-y-1">
            <p className="flex gap-3 font-bold leading-[1.4]">
              <span className="w-11 shrink-0 text-[12px] text-muted-foreground">{stop.time}</span>
              <span className="text-[14px]">{stop.name}</span>
            </p>
            <p className="text-[12px] leading-[1.4] text-muted-foreground">{stop.note}</p>
            {stop.booking ? <p className="text-[12px] leading-[1.4]">{stop.booking}</p> : null}
          </div>
        ),
      )}
    </section>
  );
}

/** What a visitor gets, in their words rather than the features'. */
const LANDING_POINTS = [
  {
    title: "Make a plan from your saved places",
    body: "Bring links, lists or ideas. Béa helps organise the days.",
  },
  {
    title: "Keep directions and bookings together",
    body: "Know what comes next, with the details close by.",
  },
  {
    title: "Remember places for next time",
    body: "Keep discoveries, notes and memories after the trip.",
  },
] as const;

/** The sign-up button. */
function StartFree() {
  return (
    <Link
      to="/auth"
      search={{ mode: "signup" }}
      className="flex h-[52px] items-center justify-center rounded-[var(--r-card)] bg-primary text-[14px] font-medium text-primary-foreground"
    >
      Start planning free
    </Link>
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
