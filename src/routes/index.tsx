import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Globe } from "@/components/Globe";
import { HomeTripCard } from "@/components/HomeTripCard";

import { useAuth } from "@/hooks/useAuth";
import { useFutureNotes } from "@/hooks/useFutureNotes";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { supabase } from "@/integrations/supabase/client";
import { pinColorClass, pinLabel } from "@/data/atlas";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { rankOpportunities } from "@/lib/score-opportunity";
import { demoGlobePins, loadDemoSeed } from "@/lib/demo-seed";
import { beaLine, BEA_MISSION, BEA_POSITION, BEA_TAGLINES } from "@/lib/bea-voice";

export const Route = createFileRoute("/")({
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
    <AppShell
      publicPage
      eyebrow={BEA_TAGLINES.strongest}
      title={BEA_POSITION}
    >
      <div className="space-y-6">
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {BEA_MISSION} Save recommendations from friends, track where you've been, plan trips from
          your saved ideas, and rediscover opportunities when you're nearby — because the best plans
          start with what matters to you.
        </p>
        <Globe pins={pins} selectedId={selectedId} onSelect={(pin) => setSelectedId(pin.id)} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            to="/auth"
            className="rounded-xl bg-primary px-4 py-3 text-center text-[13px] font-semibold text-primary-foreground"
          >
            Create an account
          </Link>
          <Link
            to="/help"
            className="rounded-xl border border-border px-4 py-3 text-center text-[13px] font-semibold"
          >
            How Béa works
          </Link>
        </div>
        <p className="text-[12px] text-muted-foreground">
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

  const recentCities = useMemo(() => {
    const map = new Map<string, { city: string; photos: number; last: string | null }>();
    for (const r of photo.rows) {
      if (!r.city) continue;
      const key = r.city.toLowerCase();
      const g = map.get(key) ?? { city: r.city, photos: 0, last: null };
      g.photos += 1;
      if (r.taken_at && (!g.last || r.taken_at > g.last)) g.last = r.taken_at;
      map.set(key, g);
    }
    return Array.from(map.values())
      .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""))
      .slice(0, 4);
  }, [photo.rows]);

  const topReco = useMemo(() => {
    const ranked = rankOpportunities(vault.comparePins, scorePrefs);
    const winner = ranked[0]?.pin;
    if (!winner) return vault.rows[0];
    return vault.rows.find((row) => `reco-${row.id}` === winner.id) ?? vault.rows[0];
  }, [vault.comparePins, vault.rows, scorePrefs]);
  const topNote = notes.rows[0];
  const empty =
    photo.rows.length === 0 && vault.rows.length === 0 && notes.rows.length === 0;
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
    setSeedMsg(
      `Loaded ${result.recos} places, ${result.trips} trips and ${result.notes} notes.`,
    );
    navigate({ to: "/world" });
  };

  return (
    <AppShell
      eyebrow={homeCity ? (homeCity.split(",")[0] ?? homeCity) : "Your travel vault"}
      title={firstName ? `Hello, ${firstName}.` : "Welcome to Béa."}
    >
      <div className="space-y-6">
        {layout.trip && <HomeTripCard />}

        {layout.shortcuts && (
          <div data-guide="home-shortcuts" className="grid grid-cols-2 gap-3">
            <Link
              to="/story"
              data-guide="home-story"
              className="rise card-soft p-4 transition-colors hover:bg-elevated"
            >
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-visited" />
                <span className="label-caps">Playback</span>
              </div>
              <p className="mt-1.5 font-display text-[19px] leading-tight">Travel story</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Play your journey city by city.
              </p>
            </Link>
            <Link
              to="/memories"
              className="rise card-soft p-4 transition-colors hover:bg-elevated"
            >
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-reco" />
                <span className="label-caps">Every place</span>
              </div>
              <p className="mt-1.5 font-display text-[19px] leading-tight">City memories</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Photos, notes and saved spots by city.
              </p>
            </Link>
          </div>
        )}

        {empty && (
          <section data-guide="home-empty" className="rise card-soft p-4">
            <p className="font-display text-[20px] leading-snug">
              {beaLine("empty.home").title}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {beaLine("empty.home").body}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={seeding}
                onClick={() => void fillSample()}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {seeding ? "Loading sample…" : "Load sample travel data"}
              </button>
              <Link
                to="/photos"
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-center text-[13px] font-semibold"
              >
                Import photos
              </Link>
            </div>
            {seedMsg && <p className="mt-2 text-[12px] text-muted-foreground">{seedMsg}</p>}
          </section>
        )}

        {layout.waiting && topReco && (
          <section data-guide="home-waiting" className="rise">
            <SectionHead title="Waiting for you" aside={`${vault.rows.length} saved`} />
            <div className="card-soft overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${pinColorClass["reco"]}`} />
                  <span className="label-caps">{pinLabel["reco"]}</span>
                </div>
                <h2 className="mt-1 text-[22px] leading-tight">{topReco.name}</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {[topReco.city, topReco.country].filter(Boolean).join(", ")}
                  {topReco.recommended_by ? ` · saved by ${topReco.recommended_by}` : ""}
                </p>
                {topReco.notes && (
                  <p className="mt-3 font-display text-[16px] leading-snug">“{topReco.notes}”</p>
                )}
                <Link
                  to="/opportunities"
                  className="mt-4 block rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-primary-foreground"
                >
                  See what's near you
                </Link>
              </div>
            </div>
          </section>
        )}

        {layout.recent && recentCities.length > 0 && (
          <section data-guide="home-recent" className="rise">
            <SectionHead title="Recent memories" aside={`${photo.stats.cities} cities`} />
            <div className="grid grid-cols-2 gap-3">
              {recentCities.map((c) => (
                <Link
                  key={c.city}
                  to="/memories"
                  className="card-soft p-3.5 transition-colors hover:bg-elevated"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-visited" />
                    <span className="font-display text-[18px] leading-none">{c.city}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{c.photos} photos</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.last
                      ? new Date(c.last).toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })
                      : ""}
                  </p>
                </Link>
              ))}
            </div>
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
              <p className="mt-2 text-[14px] leading-relaxed">{topNote.note}</p>
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
      {aside && <span className="text-[11px] text-muted-foreground">{aside}</span>}
    </div>
  );
}
