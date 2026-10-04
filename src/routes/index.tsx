import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { browserHasStoredSession } from "@/lib/stored-session";
import { hasPendingOAuthResultInWindow } from "@/lib/auth-redirect";
import { AppShell } from "@/components/AppShell";
import { ArrowRight } from "@/components/icons";
import { Globe } from "@/components/Globe";
import { HomeYourTrips } from "@/components/HomeTripCard";
import {
  HomeSuggested,
  HomeTripStats,
  HomeUpcoming,
  HomeWhereNext,
} from "@/components/HomeLivingMap";
import { HomeNoTripHero, HomeOnTrip, HomeSavedCard, HomeWaiting } from "@/components/HomeMoods";
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
import { greetingFor } from "@/lib/trip-glance";

import { useAuth } from "@/hooks/useAuth";
import { useFutureNotes } from "@/hooks/useFutureNotes";
import { HOME_SMALL, useHomeLayout, type HomeSectionKey } from "@/hooks/useHomeLayout";
import { HomeTripModule } from "@/components/HomeModules";
import { useHomeTripModules } from "@/hooks/useHomeTripModules";
import { moduleRows } from "@/lib/module-layout";
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
    <AppShell publicPage eyebrow="Save · Plan · Travel · Remember" title={BEA_POSITION}>
      <div className="space-y-6">
        <p className="text-[17px] leading-snug text-muted-foreground">
          Save the places you care about.
          <br />
          Turn them into real trips.
          <br />
          Follow the day while you travel.
          <br />
          Remember it all.
        </p>
        {/* The way in first, where a thumb reaches it without scrolling. */}
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
        <span className="grid size-11 place-items-center rounded-full bg-[var(--acc-soft)] text-foreground">
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
  const { layout, shown } = useHomeLayout();

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
    (k) => k !== "stops" && (!TRIP_ONLY.has(k) || Boolean(trip && !trips.loading)),
  );
  const tripWeather =
    Boolean(trip && !trips.loading) &&
    (shownModules.includes("now") || shownModules.includes("weatherThere"));

  /** One module, as the traveller arranged them (Customize home). */
  const homeModule = (key: HomeSectionKey): ReactNode => {
    switch (key) {
      case "trip":
        return trips.loading ? null : <HomeYourTrips trips={others} photos={photos} />;
      case "weather":
        return showTrip || noTripMap ? (
          <div className="flex justify-end">
            <HomeWeather near={near} />
          </div>
        ) : null;
      case "waiting":
        return (
          <div className="pt-2">
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
        ) : null;
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
      {...(showTrip || noTripMap
        ? {}
        : {
            eyebrow: today,
            title: greetingLine,
            ...(layout.weather ? { headerAction: <HomeWeather near={near} /> } : {}),
          })}
      actionBesideEyebrow
    >
      <div className="space-y-5">
        {showTrip && (
          <div className="space-y-4">
            {underway ? (
              <HomeOnTrip
                trip={trip}
                photos={photos}
                glance={glances[trip.id]}
                showStops={layout.stops}
              />
            ) : (
              <HomeUpcoming trip={trip} photos={photos} />
            )}
            <HomeTripStats trip={trip} glance={glances[trip.id]} overlap={!underway} />
            <HomeWhereNext />
            <HomeSuggested trip={trip} />
          </div>
        )}

        {noTripMap && (
          <div className="space-y-4">
            <HomeNoTripHero greeting={greetingLine} date={today} cities={waiting} />
            <HomeSavedCard cities={waiting} />
            <HomeWaiting cities={waiting} />
          </div>
        )}

        {moduleRows(shownModules, (k) => HOME_SMALL.has(k)).map((row) =>
          "full" in row ? (
            <div key={row.full}>{homeModule(row.full)}</div>
          ) : (
            <div key={row.pair.join("+")} className="grid grid-cols-2 gap-3">
              {row.pair.map((k) => (
                <div key={k}>{homeModule(k)}</div>
              ))}
            </div>
          ),
        )}

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

        <CustomizeHome variant="card" />

        {((layout.weather && near.consent && near.state === "ok") || tripWeather) && (
          <WeatherCredit />
        )}
      </div>
    </AppShell>
  );
}

function SectionHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-display text-[27px] leading-none">{title}</h2>
      {aside && <span className="text-[12px] text-muted-foreground">{aside}</span>}
    </div>
  );
}
