import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { browserHasStoredSession } from "@/lib/stored-session";
import { hasPendingOAuthResultInWindow } from "@/lib/auth-redirect";
import { SignedInHomeNext } from "@/components/next/HomeNextPage";
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

  return <SignedInHomeNext />;
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
