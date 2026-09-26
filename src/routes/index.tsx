import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Globe } from "@/components/Globe";
import {
  HomeLaterTrips,
  HomeNextUp,
  HomeSectionTitle,
  HomeTripHero,
} from "@/components/HomeTripCard";
import { laterTrips, peopleOnTrip, pickActiveTrip } from "@/lib/home-trip";
import { toLocalISODate } from "@/lib/trip-dates";
import { HomeSaveTile } from "@/components/HomeSaveTile";
import { ContentCard } from "@/components/ContentCard";
import { NearHome } from "@/components/NearHome";
import { HomeWeather } from "@/components/HomeWeather";
import { useNearMe } from "@/hooks/useNearMe";
import { useTrips } from "@/hooks/useTrips";
import { useTripPhotos } from "@/hooks/useTripPhotos";
import { useTripGlances } from "@/hooks/useTripGlances";
import { greetingFor } from "@/lib/trip-glance";
import { isUnderway } from "@/lib/trip-card";

import { useAuth } from "@/hooks/useAuth";
import { useFutureNotes } from "@/hooks/useFutureNotes";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { supabase } from "@/integrations/supabase/client";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { rankOpportunities } from "@/lib/score-opportunity";
import { hasDismissedSampleCta } from "@/lib/auto-seed";
import { demoGlobePins, loadDemoSeed } from "@/lib/demo-seed";
import { beaLine, BEA_MISSION, BEA_POSITION, BEA_TAGLINES } from "@/lib/bea-voice";
import { safeStorage } from "@/lib/tour-state";

export const Route = createFileRoute("/")({
  staticData: { plane: "tab" },
  head: () => ({
    meta: [
      { title: "Béa — Your travel life, all in one place" },
      {
        name: "description",
        content:
          "Béa remembers your travel life so Future You doesn't miss what matters. Save recommendations, plan from your ideas, and rediscover opportunities nearby.",
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

function HomePage() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <LandingPage />;
  }

  return <SignedInHome />;
}

function LandingPage() {
  const pins = useMemo(() => demoGlobePins(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <AppShell publicPage eyebrow={BEA_TAGLINES.strongest} title={BEA_POSITION}>
      <div className="space-y-6">
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {BEA_MISSION} Save recommendations from friends, track where you've been, plan trips from
          your saved ideas, and rediscover opportunities when you're nearby — because the best plans
          start with what matters to you.
        </p>
        <Globe pins={pins} selectedId={selectedId} onSelect={(pin) => setSelectedId(pin.id)} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            to="/auth"
            className="rounded-xl bg-primary px-4 py-3 text-center text-[14.5px] font-semibold text-primary-foreground"
          >
            Create an account
          </Link>
          <Link
            to="/how-it-works"
            className="rounded-xl border border-border px-4 py-3 text-center text-[14.5px] font-semibold"
          >
            How Béa works
          </Link>
        </div>
        <p className="text-[13px] text-muted-foreground">
          The globe above is sample data. After you sign in, tap Load sample travel data on Home or
          You to fill an account for a live walkthrough.
        </p>
      </div>
    </AppShell>
  );
}

function SignedInHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
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
  const glanceIds = useMemo(
    () => [trip?.id, ...later.map((t) => t.id)].filter((id): id is string => Boolean(id)),
    [trip, later],
  );
  const { glances } = useTripGlances(glanceIds);

  useEffect(() => {
    if (!user) {
      setDisplayName("");
      setHomeCity("");
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("display_name, home_city")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setDisplayName(data.display_name ?? "");
        setHomeCity(data.home_city ?? "");
      });
    return () => {
      active = false;
    };
  }, [user]);

  const firstName = (displayName || user?.email?.split("@")[0] || "").split(" ")[0] ?? "";

  const topReco = useMemo(() => {
    const ranked = rankOpportunities(vault.comparePins, scorePrefs);
    const winner = ranked[0]?.pin;
    if (!winner) return vault.rows[0];
    return vault.rows.find((row) => `reco-${row.id}` === winner.id) ?? vault.rows[0];
  }, [vault.comparePins, vault.rows, scorePrefs]);
  const topNote = notes.rows[0];
  const empty = photo.rows.length === 0 && vault.rows.length === 0 && notes.rows.length === 0;
  const sampleCtaDismissed = Boolean(user?.id && hasDismissedSampleCta(safeStorage(), user.id));
  const showSamplePrompt = empty && !sampleCtaDismissed;
  const { layout } = useHomeLayout();

  const fillSample = async () => {
    setSeeding(true);
    setSeedMsg("");
    const result = await loadDemoSeed();
    setSeeding(false);
    if (!result.ok) {
      setSeedMsg(result.message);
      return;
    }
    await Promise.all([vault.reload(), notes.reload()]);
    setSeedMsg(`Loaded ${result.recos} places, ${result.trips} trips and ${result.notes} notes.`);
    navigate({ to: "/world" });
  };

  const now = new Date();
  const today = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const greeting = greetingFor(now.getHours());
  const underway = trip ? isUnderway(trip.start_date, trip.end_date) : false;
  const subtitle = !trip
    ? homeCity
      ? `Home in ${homeCity.split(",")[0]}. Where to next?`
      : "Where to next?"
    : underway
      ? "You're in the middle of it."
      : "Your next chapter is taking shape.";
  const showTrip = layout.trip && trip && !trips.loading;
  const showSave = layout.waiting && Boolean(topReco || vault.pins.length);

  return (
    <AppShell eyebrow={today} title={firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}>
      <div className="space-y-8">
        <p className="-mt-3 text-[15px] text-muted-foreground">{subtitle}</p>

        {showTrip && (
          <HomeTripHero
            trip={trip}
            glance={glances[trip.id]}
            photos={photos}
            peopleCount={peopleOnTrip(trips.members, trip.id, trips.uid)}
          />
        )}

        {(layout.weather || showSave) && (
          <section className="rise">
            <HomeSectionTitle
              title="At a glance"
              aside={
                showTrip ? (
                  <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
                    {trip.city?.split(",")[0]?.trim() || "Trip"} overview
                  </Link>
                ) : undefined
              }
            />
            <div className="grid grid-cols-2 gap-3">
              {layout.weather && <HomeWeather near={near} />}
              {showSave && <HomeSaveTile pins={vault.pins} near={near} waiting={topReco} />}
            </div>
          </section>
        )}

        {showTrip && <HomeNextUp trip={trip} glance={glances[trip.id]} uid={trips.uid} />}

        {layout.trip && (
          <HomeLaterTrips
            trips={later}
            photos={photos}
            glances={glances}
            members={trips.members}
            uid={trips.uid}
          />
        )}

        <NearHome pins={vault.pins} near={near} />

        {showSamplePrompt && (
          <section data-guide="home-empty" className="rise card-soft p-4">
            <p className="font-display text-[20px] leading-snug">{beaLine("empty.home").title}</p>
            <p className="mt-1 text-[14.5px] text-muted-foreground">{beaLine("empty.home").body}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={seeding}
                onClick={() => void fillSample()}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-[14.5px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {seeding ? "Loading sample…" : "Load sample travel data"}
              </button>
              <Link
                to="/recommendations"
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-center text-[14.5px] font-semibold"
              >
                Save a place
              </Link>
            </div>
            {seedMsg && <p className="mt-2 text-[13px] text-muted-foreground">{seedMsg}</p>}
          </section>
        )}

        {layout.future && topNote && (
          <section data-guide="home-future" className="rise">
            <SectionHead title={`Future me · ${topNote.city}`} aside="Surfaces on revisit" />
            <div className="card-soft p-4">
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
      </div>
    </AppShell>
  );
}

function SectionHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <p className="label-caps text-foreground">{title}</p>
      {aside && <span className="text-[12px] text-muted-foreground">{aside}</span>}
    </div>
  );
}
