import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { HomeYourTrips } from "@/components/HomeTripCard";
import { HomeSuggested, HomeWhereNext } from "@/components/HomeLivingMap";
import { HomeSavedCard, HomeWaiting } from "@/components/HomeMoods";
import { NearHome } from "@/components/NearHome";
import { HomeWeather, WeatherCredit } from "@/components/HomeWeather";
import {
  HomeNextNoTrip,
  HomeNextOnTrip,
  HomeNextStats,
  HomeNextUpcoming,
} from "@/components/next/HomeNext";
import { CustomizeHomeNext, HomeNextModule } from "@/components/next/HomeNextModules";
import { laterTrips, pastTrips, pickActiveTrip } from "@/lib/home-trip";
import { savedCities } from "@/lib/home-now";
import { homeState } from "@/lib/home-next-layout";
import { isUnderway } from "@/lib/trip-card";
import { toLocalISODate } from "@/lib/trip-dates";
import { greetingFor } from "@/lib/trip-glance";
import { moduleRows } from "@/lib/module-layout";
import { useNearMe } from "@/hooks/useNearMe";
import { useTrips } from "@/hooks/useTrips";
import { useTripPhotos } from "@/hooks/useTripPhotos";
import { useTripGlances } from "@/hooks/useTripGlances";
import { useAuth } from "@/hooks/useAuth";
import { useFutureNotes } from "@/hooks/useFutureNotes";
import { HOME_SMALL, type HomeSectionKey } from "@/hooks/useHomeLayout";
import { useHomeNextLayout } from "@/hooks/useHomeNextLayout";
import { useHomeTripModules } from "@/hooks/useHomeTripModules";
import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { supabase } from "@/integrations/supabase/client";
import { rankOpportunities } from "@/lib/score-opportunity";
import { hasDismissedSampleCta } from "@/lib/auto-seed";
import { beaLine } from "@/lib/bea-voice";
import { safeStorage } from "@/lib/tour-state";
import { rememberedProfileName, rememberProfileName, shownName } from "@/lib/profile-name";
import { isAreaPlace } from "@/lib/reco-place";

/**
 * Home, redesigned (UI revamp step 8, the "three moods" references), on its
 * own address so `/` keeps working exactly as today until the owner swaps
 * them. Every read, module and link is the current Home's (`index.tsx`);
 * only the hero and the module tiles are new, and each trip state keeps its
 * own module list.
 */
export const Route = createFileRoute("/next")({
  staticData: { plane: "tab" },
  head: () => ({ meta: [{ title: "Home (new) — Béa" }] }),
  component: NextHomePage,
});

function NextHomePage() {
  const { user, loading } = useAuth();
  // The welcome page stays at `/`.
  if (!user && !loading) return <Navigate to="/" />;
  return <SignedInHomeNext />;
}

function SignedInHomeNext() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(() =>
    user ? rememberedProfileName(safeStorage(), user.id) : "",
  );
  const [profileLoaded, setProfileLoaded] = useState(false);
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
        rememberProfileName(safeStorage(), user.id, data.display_name ?? "");
      });
    return () => {
      active = false;
    };
  }, [user]);

  const firstName =
    shownName({ profileName: displayName, profileLoaded, email: user?.email }).split(" ")[0] ?? "";

  const topReco = useMemo(() => {
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
  const waiting = useMemo(
    () => savedCities(vault.rows.filter((row) => !isAreaPlace(row))),
    [vault.rows],
  );
  const empty = photo.rows.length === 0 && vault.rows.length === 0 && notes.rows.length === 0;
  const sampleCtaDismissed = Boolean(user?.id && hasDismissedSampleCta(safeStorage(), user.id));
  const showSamplePrompt = empty && !sampleCtaDismissed;

  const now = new Date();
  const today = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const greeting = greetingFor(now.getHours());
  const haveTrip = Boolean(trip && !trips.loading);
  const tripUnderway = Boolean(
    trip && !trips.loading && isUnderway(trip.start_date, trip.end_date, now),
  );
  // Which moment Home is in decides which module list shows.
  const state = homeState(haveTrip ? trip : null, tripUnderway);
  const { modules, shown } = useHomeNextLayout(state);
  const on = (k: HomeSectionKey) => modules.on.has(k);
  const showTrip = on("trip") && haveTrip;
  const underway = Boolean(showTrip && tripUnderway);
  const noTripMap =
    on("waiting") &&
    !trips.loading &&
    !trip &&
    !vault.loading &&
    waiting.some((c) => c.lat !== null && c.lon !== null);
  const greetingLine = firstName ? `${greeting}, ${firstName}` : greeting;
  const showSave = on("waiting") && Boolean(topReco);
  const others = [...later, ...past.filter((t) => t.id !== trip?.id)];
  const tripModules = useHomeTripModules({
    trip: haveTrip ? trip : null,
    glance: trip ? glances[trip.id] : undefined,
    members: trips.members,
    saved: vault.rows,
    underway: tripUnderway,
  });
  const shownModules = shown.filter((k) => k !== "stops");
  const tripWeather = haveTrip && (on("now") || on("weatherThere"));

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
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[22px] leading-none">Future me · {topNote.city}</h2>
              <span className="text-[13px] text-muted-foreground">Surfaces on revisit</span>
            </div>
            <div className="hn-card p-4">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-reco" />
                <span className="label-caps">
                  Left {new Date(topNote.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 text-[16px] leading-relaxed">{topNote.note}</p>
            </div>
          </section>
        ) : null;
      default:
        return trip ? (
          <HomeNextModule
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
      {...(showTrip || noTripMap
        ? {}
        : {
            eyebrow: today,
            title: greetingLine,
            ...(on("weather") ? { headerAction: <HomeWeather near={near} /> } : {}),
          })}
      actionBesideEyebrow
    >
      <div className="space-y-5">
        {showTrip && trip && (
          <div className="space-y-4">
            {underway ? (
              <HomeNextOnTrip
                trip={trip}
                photos={photos}
                glance={glances[trip.id]}
                showStops={on("stops")}
                savedHere={tripModules.savedHere.length}
                weather={tripWeather}
              />
            ) : (
              <HomeNextUpcoming trip={trip} photos={photos} />
            )}
            <HomeNextStats trip={trip} glance={glances[trip.id]} overlap={!underway} />
            <HomeWhereNext />
            <HomeSuggested trip={trip} />
          </div>
        )}

        {noTripMap && (
          <div className="space-y-4">
            <HomeNextNoTrip greeting={greetingLine} date={today} cities={waiting} />
            <div className="relative z-[3] -mt-10">
              <HomeSavedCard cities={waiting} />
            </div>
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
          <section data-guide="home-empty" className="rise hn-card p-5">
            <p className="font-display text-[20px] leading-snug">{beaLine("empty.home").title}</p>
            <p className="mt-1 text-[15px] text-muted-foreground">{beaLine("empty.home").body}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/trips/plan"
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-center text-[15px] font-semibold text-primary-foreground"
              >
                Plan a trip
              </Link>
              <Link
                to="/recommendations"
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-center text-[15px] font-semibold"
              >
                Save a place
              </Link>
            </div>
          </section>
        )}

        <CustomizeHomeNext state={state} />

        {((on("weather") && near.consent && near.state === "ok") || tripWeather) && (
          <WeatherCredit />
        )}
      </div>
    </AppShell>
  );
}
