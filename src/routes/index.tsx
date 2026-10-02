import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { browserHasStoredSession } from "@/lib/stored-session";
import { hasPendingOAuthResultInWindow } from "@/lib/auth-redirect";
import { AppShell } from "@/components/AppShell";
import { Globe } from "@/components/Globe";
import {
  HomeBeforeTrip,
  HomeShortcuts,
  HomeTripHero,
  HomeYourTrips,
} from "@/components/HomeTripCard";
import { laterTrips, pastTrips, peopleOnTrip, pickActiveTrip } from "@/lib/home-trip";
import { toLocalISODate } from "@/lib/trip-dates";
import { NearHome } from "@/components/NearHome";
import { BeaWordmark } from "@/components/BeaWordmark";
import { ArrowRight, PlayCircle } from "@/components/icons";
import { HomeNameAsk } from "@/components/HomeNameAsk";
import { HomePendingPlan } from "@/components/HomePendingPlan";
import { LandingSampleDay } from "@/components/LandingSampleDay";
import { LandingTryPlan } from "@/components/LandingTryPlan";
import { shouldAskName } from "@/lib/name-ask";
import { HomeWeather, WeatherCredit } from "@/components/HomeWeather";
import { useNearMe } from "@/hooks/useNearMe";
import { useTrips } from "@/hooks/useTrips";
import { useTripPhotos } from "@/hooks/useTripPhotos";
import { useTripGlances } from "@/hooks/useTripGlances";
import { greetingFor } from "@/lib/trip-glance";

import { useAuth } from "@/hooks/useAuth";
import { useFutureNotes } from "@/hooks/useFutureNotes";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { supabase } from "@/integrations/supabase/client";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { rankOpportunities } from "@/lib/score-opportunity";
import { hasDismissedSampleCta } from "@/lib/auto-seed";
import { demoGlobePins } from "@/lib/demo-seed";
import { beaLine, BEA_POSITION, BEA_TAGLINES } from "@/lib/bea-voice";
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
    <AppShell publicPage>
      <div className="space-y-6">
        <LandingHero />
        <LandingSampleDay />
        <LandingTryPlan />
        <ul className="grid gap-2 sm:grid-cols-3">
          {LANDING_POINTS.map((point) => (
            <li key={point.title} className="surface border border-border/50 p-3.5">
              <p className="font-display text-[17px] leading-snug">{point.title}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
                {point.body}
              </p>
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

/**
 * The first screen: logo, the promise, the way in, and a picture of where
 * she takes you. Only true lines under the button — no counts or ratings.
 */
function LandingHero() {
  return (
    <section className="rise space-y-5 pt-2">
      <BeaWordmark size="lg" />
      <div>
        <h1 className="font-display text-[42px] leading-[1.02] tracking-[-0.01em]">
          {BEA_POSITION}
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">
          Save places. Plan real trips. Follow the day. Remember it all.
        </p>
      </div>
      <div className="space-y-2">
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="flex min-h-[56px] items-center justify-between gap-3 rounded-full bg-foreground py-2 pl-6 pr-2 text-[16px] font-semibold text-background shadow-lg"
        >
          Create your free account
          <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <ArrowRight className="size-5" aria-hidden />
          </span>
        </Link>
        <Link
          to="/how-it-works"
          className="inline-flex min-h-11 items-center gap-2.5 text-[15px] font-semibold"
        >
          <PlayCircle className="size-6" aria-hidden />
          Watch how it works
        </Link>
      </div>
      <img
        src="/banners/coastal.webp"
        alt="An illustrated harbour town on a sunny coast"
        width={960}
        height={540}
        className="aspect-[4/3] w-full rounded-[28px] object-cover shadow-sm"
      />
      <p className="text-center text-[13px] text-muted-foreground">
        Free to start · No card ·{" "}
        <Link
          to="/auth"
          className="-my-3 inline-flex min-h-11 min-w-11 items-center justify-center underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </section>
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
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="btn-primary flex items-center justify-center px-4 text-center text-[14.5px]"
        >
          Start free
        </Link>
        <Link
          to="/how-it-works"
          className="flex min-h-[var(--h-button)] items-center justify-center rounded-[var(--r-button)] border border-border px-4 text-center text-[14.5px] font-semibold"
        >
          See how it works
        </Link>
      </div>
      <p className="text-center text-[13px] text-muted-foreground">
        Free · No card · One tap with Google ·{" "}
        {/* A full-size tap target, though it reads as a word in the line. */}
        <Link
          to="/auth"
          className="-my-3 inline-flex min-h-11 min-w-11 items-center justify-center underline underline-offset-4"
        >
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

  const askName = shouldAskName(safeStorage(), {
    userId: user?.id,
    email: user?.email,
    profileName: displayName,
    profileLoaded,
  });

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
  const empty = photo.rows.length === 0 && vault.rows.length === 0 && notes.rows.length === 0;
  const sampleCtaDismissed = Boolean(user?.id && hasDismissedSampleCta(safeStorage(), user.id));
  const showSamplePrompt = empty && !sampleCtaDismissed;
  const { layout } = useHomeLayout();

  const now = new Date();
  const today = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const greeting = greetingFor(now.getHours());
  const showTrip = layout.trip && trip && !trips.loading;
  const showSave = layout.waiting && Boolean(topReco);
  // The others, next ones first, then the ones you're back from.
  const others = [...later, ...past.filter((t) => t.id !== trip?.id)];

  return (
    <AppShell
      eyebrow={today}
      title={firstName ? `${greeting}, ${firstName}` : greeting}
      headerAction={layout.weather ? <HomeWeather near={near} /> : undefined}
      actionBesideEyebrow
    >
      <div className="space-y-5">
        {user && askName && (
          <HomeNameAsk userId={user.id} onSaved={(name) => setDisplayName(name)} />
        )}

        <HomePendingPlan />

        {showTrip && (
          <HomeTripHero
            trip={trip}
            photos={photos}
            peopleCount={peopleOnTrip(trips.members, trip.id, trips.uid)}
          />
        )}

        {showTrip && <HomeBeforeTrip trip={trip} glance={glances[trip.id]} />}

        {showTrip && <HomeShortcuts trip={trip} glance={glances[trip.id]} />}

        {layout.waiting && (
          <div className="pt-2">
            <NearHome pins={vault.pins} near={near} waiting={showSave ? topReco : undefined} />
          </div>
        )}

        {layout.trip && !trips.loading && <HomeYourTrips trips={others} photos={photos} />}

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

        {layout.future && topNote && (
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
        )}

        {layout.weather && near.consent && near.state === "ok" && <WeatherCredit />}
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
