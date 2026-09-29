import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { formatTripLocation } from "@/lib/place-label";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Camera,
  ChevronRight,
  CloudUpload,
  FileText,
  HelpCircle,
  House,
  Info,
  Luggage,
  MapPin,
  MessageCircle,
  Palette,
  Plane,
  Settings,
  ShieldCheck,
  type LucideProps,
} from "@/components/icons";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { rememberedProfileName, rememberProfileName, shownName } from "@/lib/profile-name";
import { Sheet } from "@/components/Sheet";
import { resumeOrReplayTour } from "@/components/Tour";
import { PackingLists } from "@/components/PackingLists";
import { CustomizeHome } from "@/components/CustomizeHome";
import { FeedbackForm } from "@/components/FeedbackForm";
import { CopyrightNotice } from "@/components/CopyrightNotice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listSavedDirectionTripIds } from "@/hooks/useOfflineDirections";

import { useTrips } from "@/hooks/useTrips";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { hasDismissedSampleCta } from "@/lib/auto-seed";
import { clearDemoSeed, loadDemoSeed } from "@/lib/demo-seed";
import { ThemePicker } from "@/components/ThemePicker";
import { StopPicturesPicker } from "@/components/StopPicturesPicker";
import { useBeaSettings } from "@/hooks/useBeaSettings";
import { modeName } from "@/lib/bea-personality";
import { deleteMyAccount, eraseMyData } from "@/lib/account.functions";
import { clearLocalUserData } from "@/lib/clear-local-user-data";
import { safeStorage } from "@/lib/tour-state";
import { clearStoredVaultKeys } from "@/lib/vaultCrypto";

export const Route = createFileRoute("/profile")({
  staticData: { plane: "tab" },
  head: () => ({
    meta: [
      { title: "You — Béa" },
      {
        name: "description",
        content:
          "Your travel profile, preferences, offline downloads and appearance settings inside Béa.",
      },
      { property: "og:title", content: "You — Béa" },
      {
        property: "og:description",
        content: "Travel statistics, interests and offline settings for your travel buddy.",
      },
    ],
  }),
  component: ProfilePage,
});

/** The panels the You page opens over itself. One at a time. */
type Panel = "settings" | "packing" | "appearance" | "data" | "legal" | "feedback" | "about";

/**
 * A big card or list: plain in every theme, Colorful included. `plain-card`
 * comes from styles.css; the utilities are the same look, for safety.
 */
const PLAIN = "plain-card rounded-[var(--r-card)] border border-border/55 bg-card shadow-sm";

type Icon = ComponentType<LucideProps>;

/**
 * You: who you are to Béa, and everything she keeps for you.
 *
 * The master lays it out as a profile card, two grids of small tiles and a
 * list. Each tile opens what used to be a collapsible section — in a sheet,
 * or on its own page where one exists — so nothing that was here has gone.
 */
function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const t = useTrips();
  const bea = useBeaSettings();
  const [interests, setInterests] = useState<string[]>([]);
  const [offlineTripIds, setOfflineTripIds] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState(() =>
    user ? rememberedProfileName(safeStorage(), user.id) : "",
  );
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [homeCity, setHomeCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [placeCount, setPlaceCount] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [sampleCtaDismissed, setSampleCtaDismissed] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const close = () => setPanel(null);

  useEffect(() => {
    if (!user) {
      setSampleCtaDismissed(false);
      return;
    }
    setSampleCtaDismissed(hasDismissedSampleCta(safeStorage(), user.id));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setDisplayName((current) => current || rememberedProfileName(safeStorage(), user.id));
    supabase
      .from("profiles")
      .select("display_name, home_city, preferences, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error) setProfileLoaded(true);
        if (!data) return;
        setDisplayName(data.display_name ?? "");
        rememberProfileName(safeStorage(), user.id, data.display_name ?? "");
        setHomeCity(data.home_city ?? "");
        setAvatarUrl(data.avatar_url ?? null);
        if (data.preferences?.length) setInterests(data.preferences);
      });
    // The places figure is a count, not the list: no rows come back.
    supabase
      .from("recommendations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count, error }) => {
        if (active && !error) setPlaceCount(count ?? 0);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const saveProfile = async (patch: {
    display_name?: string;
    home_city?: string;
    preferences?: string[];
  }) => {
    if (!user) return;
    await supabase.from("profiles").upsert({ id: user.id, ...patch });
    if (patch.display_name !== undefined) {
      rememberProfileName(safeStorage(), user.id, patch.display_name);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  useEffect(() => {
    setOfflineTripIds(listSavedDirectionTripIds());
  }, []);

  const signedInName =
    shownName({ profileName: displayName, profileLoaded, email: user?.email }) ||
    (profileLoaded ? "Traveller" : "");
  const offlineTrips = t.trips.filter((trip) => offlineTripIds.includes(trip.id));
  // A Google account brings its photo; one saved on the profile wins.
  const metaAvatar = user?.user_metadata?.["avatar_url"];
  const photo = avatarUrl || (typeof metaAvatar === "string" ? metaAvatar : null);
  const tripCount = t.trips.length;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const replayTour = () => {
    resumeOrReplayTour();
    void navigate({ to: "/" });
  };

  return (
    <AppShell
      title={<span className="text-[44px] leading-none">You</span>}
      headerAction={
        user ? (
          <button
            type="button"
            data-guide="profile-settings"
            aria-label="Settings"
            onClick={() => setPanel("settings")}
            className="grid size-11 place-items-center rounded-full border border-border bg-card text-foreground"
          >
            <Settings className="size-5" aria-hidden />
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <p className="-mt-4 text-[15px] text-muted-foreground">
          Your travel profile, preferences and settings.
        </p>

        {!loading && !user && (
          <div data-guide="profile-account" className={`${PLAIN} p-4`}>
            <p className="font-display text-[21px] leading-snug">
              Sign in to keep all of this forever.
            </p>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              With an account your pins, trips, recommendations and photo memories are saved to you
              and follow you to any device.
            </p>
            <Link to="/auth" className="btn-primary mt-3 grid place-items-center px-4 text-center">
              Sign in or create an account
            </Link>
          </div>
        )}

        {user && (
          <section data-guide="profile-account" className={`${PLAIN} p-4`}>
            <div className="flex items-center gap-3.5">
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-16 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-[28px] text-primary"
                >
                  {signedInName[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[24px] leading-tight">{signedInName}</p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {saved ? "Saved" : user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanel("settings")}
                className="flex shrink-0 items-center gap-1 rounded-full bg-primary-soft [[data-theme=colorful]_&]:bg-tile-5 px-3.5 py-2 text-[13.5px] font-semibold text-primary"
              >
                Edit profile
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3.5">
              <Figure
                icon={House}
                tone={1}
                value={homeCity || "Add"}
                label="Home city"
                onClick={() => setPanel("settings")}
              />
              <Figure icon={Plane} tone={2} value={String(tripCount)} label="Trips" to="/trips" />
              <Figure
                icon={MapPin}
                tone={3}
                value={placeCount === null ? "–" : String(placeCount)}
                label="Places"
                to="/recommendations"
              />
            </div>
          </section>
        )}

        <div className="space-y-3">
          <SectionTitle>Your travel</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Tile
              icon={Plane}
              card={5}
              tone={1}
              title="Travel preferences"
              hint="Style, pace, budget, interests and diet"
              to="/preferences"
              guide="travel-preferences"
            />
            <Tile
              icon={Luggage}
              card={2}
              tone={2}
              title="Packing lists"
              hint="Create and manage your reusable lists"
              onClick={() => setPanel("packing")}
              guide="packing-lists"
            />
            <Tile
              icon={Briefcase}
              card={3}
              tone={3}
              title="Work travel"
              hint="Receipts, expenses and reports"
              to="/expenses"
              guide="work-travel"
            />
            <Tile
              icon={FileText}
              card={1}
              tone={4}
              title="Trip documents"
              hint="Bookings, confirmations and trip files"
              href="/profile/documents"
              guide="trip-documents"
            />
          </div>
        </div>

        <div className="space-y-3">
          <SectionTitle>Your Béa</SectionTitle>
          <Link
            to="/profile/bea"
            data-guide="your-bea"
            className={`${PLAIN} flex items-center gap-3 p-3.5`}
          >
            <img
              src="/bea/bea-think-static.png"
              alt=""
              aria-hidden
              className="art-dim -my-1 size-20 shrink-0 object-contain"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[24px] leading-tight">Béa</span>
              <span className="block text-[13px] leading-snug text-muted-foreground">
                Personality, suggestions and assistance
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 self-start rounded-full bg-primary-soft [[data-theme=colorful]_&]:bg-tile-5 px-3.5 py-2 text-[13.5px] font-semibold text-primary">
              {modeName(bea.mix)}
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          </Link>
        </div>

        <div className="space-y-3">
          <SectionTitle>App & account</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Tile
              icon={Palette}
              card={1}
              tone={4}
              title="Appearance"
              hint="Theme and what Home shows"
              onClick={() => setPanel("appearance")}
            />
            {/* Links & formats and Notifications are in the master but not
                built yet, so their tiles stay hidden. */}
            <Tile
              icon={CloudUpload}
              card={3}
              tone={3}
              title="Data & imports"
              hint="Photos, calendar, sample data, offline"
              onClick={() => setPanel("data")}
              guide="offline-options"
            />
          </div>
        </div>

        <div className="space-y-3">
          <SectionTitle>More</SectionTitle>
          <div className={`${PLAIN} divide-y divide-border/60 px-4`}>
            <Row
              icon={ShieldCheck}
              label="Privacy & legal"
              onClick={() => setPanel("legal")}
              guide="legal"
            />
            <Row icon={HelpCircle} label="Help & FAQ" to="/help" />
            <Row
              icon={MessageCircle}
              label="Feedback"
              onClick={() => setPanel("feedback")}
              guide="feedback"
            />
            <Row
              icon={Info}
              label="About Béa"
              onClick={() => setPanel("about")}
              guide="replay-tour"
            />
          </div>
        </div>

        {user && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="mx-auto block rounded-full border border-border bg-card px-5 py-2.5 text-[14.5px] font-semibold"
          >
            Sign out
          </button>
        )}
      </div>

      <Sheet
        open={panel === "settings"}
        onClose={close}
        title="Profile settings"
        hint={`Your details and ${interests.length} travel tag${interests.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="label-caps text-foreground">Your details</p>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => saveProfile({ display_name: displayName })}
              placeholder="Your name"
              aria-label="Your name"
              className="w-full rounded-full border border-border bg-card px-4 py-2.5 text-[15px] outline-none focus:border-primary"
            />
            <input
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              onBlur={() => saveProfile({ home_city: homeCity })}
              placeholder="Home city"
              aria-label="Home city"
              className="w-full rounded-full border border-border bg-card px-4 py-2.5 text-[15px] outline-none focus:border-primary"
            />
            {saved && <p className="text-[12.5px] text-muted-foreground">Saved</p>}
            {user?.email && (
              <p className="text-[12.5px] text-muted-foreground">
                Signed in as {user.email} — everything saves to your account.
              </p>
            )}
          </div>
          <SheetLink
            to="/preferences"
            title="Travel preferences"
            hint="Help Béa understand how you like to travel — style, pace, and tags she plans with."
          />
          <CustomizeHome variant="row" />
          <ThemePicker />
          <TourRow onReplay={replayTour} />
          {user && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full rounded-full border border-border px-4 py-2.5 text-[14.5px] font-semibold"
            >
              Sign out
            </button>
          )}
        </div>
      </Sheet>

      <Sheet
        open={panel === "packing"}
        onClose={close}
        title="Packing lists"
        hint="Reusable lists you can attach to a new trip"
      >
        <div className="space-y-3">
          <p className="text-[13.5px] text-muted-foreground">
            Build lists here once. When you create a trip you can attach a copy of one — what you
            tick off or add there stays on that trip only.
          </p>
          <PackingLists label="My saved packing lists" hint="Your reusable templates." />
        </div>
      </Sheet>

      <Sheet
        open={panel === "appearance"}
        onClose={close}
        title="Appearance"
        hint="Saved to your account"
      >
        <div className="space-y-3">
          <ThemePicker />
          <StopPicturesPicker />
          <CustomizeHome variant="row" />
        </div>
      </Sheet>

      <Sheet
        open={panel === "data"}
        onClose={close}
        title="Data & imports"
        hint="What comes in, and what is kept on this phone"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <SheetLink
              to="/photos"
              icon={Camera}
              title="Import photos"
              hint="Bring photos from your phone into your travel memories."
            />
            <SheetLink
              to="/calendar"
              icon={CalendarDays}
              title="Trip calendar"
              hint="Every trip, flight, hotel and reservation on one calendar."
            />
          </div>

          {user && !sampleCtaDismissed && (
            <div className="rounded-2xl border border-border bg-elevated p-3">
              <p className="text-[14.5px] font-semibold">Demo / sample data</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Loads ~10 cities, Lisbon-heavy recommendations, 3 trips with timelines, and Future
                Me notes. Remove only deletes the sample rows — not places you added yourself.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={seeding}
                  onClick={async () => {
                    setSeeding(true);
                    setSeedMsg("");
                    const result = await loadDemoSeed();
                    setSeeding(false);
                    setSeedMsg(
                      result.ok
                        ? `Loaded ${result.recos} places, ${result.trips} trips, ${result.notes} notes.`
                        : result.message,
                    );
                    if (result.ok) navigate({ to: "/world" });
                  }}
                  className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-[14.5px] font-semibold disabled:opacity-60"
                >
                  {seeding ? "Working…" : "Load sample"}
                </button>
                <button
                  type="button"
                  disabled={seeding}
                  onClick={async () => {
                    setSeeding(true);
                    setSeedMsg("");
                    const result = await clearDemoSeed();
                    setSeeding(false);
                    // Remove (or empty) opts out of sample prompts — hide this card.
                    if (result.ok || result.reason === "empty") {
                      setSampleCtaDismissed(true);
                      return;
                    }
                    setSeedMsg(result.message);
                  }}
                  className="flex-1 rounded-full border border-border px-4 py-2 text-[14.5px] font-semibold disabled:opacity-60"
                >
                  Remove sample
                </button>
              </div>
              {seedMsg && <p className="mt-2 text-[13px] text-muted-foreground">{seedMsg}</p>}
            </div>
          )}

          <div>
            <p className="label-caps text-foreground">What is kept on this phone</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Installed on your home screen, Béa is designed to open without signal. Photos,
              recommendations, new searches and the vault still need a connection.
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              What is kept locally: open a trip → trip menu (•••) → Offline maps, and download its
              directions. That keeps the trip's plan, the walk or drive steps, and, where this phone
              can draw it, the map around each day's stops.
            </p>
            {offlineTrips.length > 0 ? (
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
                {offlineTrips.map((trip) => (
                  <li key={trip.id} className="px-3 py-2.5">
                    <p className="text-[14.5px] font-medium">{trip.title}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {formatTripLocation(trip.city, trip.country) || "Directions saved here"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-muted-foreground">
                None yet. Open a trip and download its directions under Offline maps.
              </p>
            )}
            <Link
              to="/trips"
              className="mt-3 block rounded-full border border-border px-4 py-2.5 text-center text-[14.5px] font-semibold"
            >
              Open trips
            </Link>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={panel === "legal"}
        onClose={close}
        title="Privacy & legal"
        hint="Policies, terms and your data"
      >
        <div className="space-y-2">
          <SheetLink
            to="/privacy"
            title="Privacy policy"
            hint="How your account, photos and documents are stored and protected."
          />
          <SheetLink
            to="/terms"
            title="Terms of Service"
            hint="The rules of the road, disclaimers and liability limits you agreed to."
          />
          <div className="rounded-2xl bg-elevated p-3">
            <CopyrightNotice className="px-0 pb-0 pt-0 text-left text-[13px] text-muted-foreground" />
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Béa — the app, its name, design, features and original ideas — is Mathilde E.
              Larochelle's work. You keep what you save in it. The Terms spell this out.
            </p>
          </div>
          {user && <EraseDataPanel userId={user.id} />}
          {user && <DeleteAccountPanel userId={user.id} />}
        </div>
      </Sheet>

      <Sheet open={panel === "feedback"} onClose={close} title="Feedback" hint="Tell Béa something">
        <div className="space-y-2">
          <p className="text-[14.5px] text-muted-foreground">
            Béa is here to make you happy. A missing travel stat, a wish, something that broke —
            write it here. It is saved to your account so we can actually read it.
          </p>
          <FeedbackForm alreadySignedIn={!!user} />
        </div>
      </Sheet>

      <Sheet open={panel === "about"} onClose={close} title="About Béa" hint="Your travel buddy">
        <div className="space-y-2">
          <SheetLink
            to="/how-it-works"
            icon={BookOpen}
            title="How Béa works"
            hint="What she does with your places, trips and photos."
          />
          <TourRow onReplay={replayTour} />
          <CopyrightNotice className="px-1 pb-0 pt-1 text-left text-[13px] text-muted-foreground" />
        </div>
      </Sheet>
    </AppShell>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-[27px] leading-none">{children}</h2>;
}

type Tone = 1 | 2 | 3 | 4 | 5;

/** A figure under the profile: an icon in its colour, a value and a caption. */
function Figure({
  icon: Glyph,
  tone,
  value,
  label,
  to,
  onClick,
}: {
  icon: Icon;
  tone: Tone;
  value: string;
  label: string;
  to?: "/trips" | "/recommendations";
  onClick?: () => void;
}) {
  const body = (
    <>
      <Glyph className={`seq-text-${tone} size-6 shrink-0`} aria-hidden />
      <span className="min-w-0 text-left">
        <span className="block truncate text-[15px] font-semibold leading-tight">{value}</span>
        <span className="block truncate text-[12px] text-muted-foreground">{label}</span>
      </span>
    </>
  );
  const cls = "flex min-w-0 items-center justify-center gap-2 rounded-xl py-1";
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/**
 * A small 2×2 tile: pastel in Colorful (`tile-card-N`), its icon in the
 * matching accent (`seq-text-N`); a quiet card in Calm and Dark.
 */
function Tile({
  icon: Glyph,
  card,
  tone,
  title,
  hint,
  to,
  href,
  onClick,
  guide,
}: {
  icon: Icon;
  card: Tone;
  tone: Tone;
  title: string;
  hint: string;
  to?: "/preferences" | "/expenses";
  href?: string;
  onClick?: () => void;
  guide?: string;
}) {
  const body = (
    <>
      <Glyph className={`seq-text-${tone} mt-0.5 size-6 shrink-0`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-1">
          <span className="font-display text-[16.5px] leading-tight">{title}</span>
          <ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted-foreground">
          {hint}
        </span>
      </span>
    </>
  );
  const cls = `tile-card-${card} flex min-h-[92px] items-start gap-2 p-3 text-left`;
  if (to)
    return (
      <Link to={to} data-guide={guide} className={cls}>
        {body}
      </Link>
    );
  if (href)
    return (
      <a href={href} data-guide={guide} className={cls}>
        {body}
      </a>
    );
  return (
    <button type="button" onClick={onClick} data-guide={guide} className={cls}>
      {body}
    </button>
  );
}

/** A row in the More list. */
function Row({
  icon: Glyph,
  label,
  to,
  onClick,
  guide,
}: {
  icon: Icon;
  label: string;
  to?: "/help";
  onClick?: () => void;
  guide?: string;
}) {
  const body = (
    <>
      <Glyph className="seq-text-1 size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-[15px]">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </>
  );
  const cls = "flex w-full items-center gap-3 py-3.5 text-left";
  return to ? (
    <Link to={to} data-guide={guide} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} data-guide={guide} className={cls}>
      {body}
    </button>
  );
}

/** A link row inside a sheet. */
function SheetLink({
  to,
  title,
  hint,
  icon: Glyph,
}: {
  to: "/preferences" | "/photos" | "/calendar" | "/privacy" | "/terms" | "/how-it-works";
  title: string;
  hint: string;
  icon?: Icon;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl bg-elevated p-3">
      {Glyph && <Glyph className="size-5 shrink-0 text-primary" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="block text-[12.5px] text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function TourRow({ onReplay }: { onReplay: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-elevated p-3">
      <div>
        <p className="text-[14.5px] font-medium">Take the tour again</p>
        <p className="text-[12.5px] text-muted-foreground">
          Replay the story walk, or the Deep Dive on what makes Béa different.
        </p>
      </div>
      <button
        type="button"
        onClick={onReplay}
        className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-[14.5px] font-semibold"
      >
        Replay
      </button>
    </div>
  );
}

function EraseDataPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmStep, setConfirmStep] = useState<null | 1 | 2>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function eraseData() {
    setBusy(true);
    setError("");
    try {
      await eraseMyData({ data: { confirm: "ERASE" } });
      clearLocalUserData(userId);
      queryClient.clear();
      setConfirmStep(null);
      toast.success("Your data was erased. You can start fresh.");
      await navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not erase your data.");
      setConfirmStep(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-destructive/30 p-3">
      <p className="text-[15px] font-medium">Erase all my data</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Start fresh without closing your account. This is designed to remove your trips,
        recommendations, photos, receipts, vault documents, and travel preferences. Shared trips
        hand off to another member when someone else is on them. Your login stays. Backups and the
        AI provider may still hold traces for a short time.
      </p>
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError("");
          setConfirmStep(1);
        }}
        className="mt-3 w-full rounded-xl border border-destructive px-4 py-2 text-[14.5px] font-semibold text-destructive disabled:opacity-50"
      >
        {busy ? "Erasing…" : "Erase all my data"}
      </button>

      <AlertDialog
        open={confirmStep !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmStep(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmStep === 2 ? "Are you sure that you're sure?" : "Are you sure?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStep === 2
                ? "There is no undo. Your trips, photos, receipts, vault files, and preferences are designed to be removed. You stay signed in with an empty account."
                : "This permanently erases your Béa travel data so you can start fresh. Your account and login stay."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            {confirmStep === 1 ? (
              <AlertDialogAction
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  setConfirmStep(2);
                }}
              >
                Yes, continue
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  void eraseData();
                }}
              >
                {busy ? "Erasing…" : "Yes — erase everything"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeleteAccountPanel({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready = phrase.trim() === "DELETE";

  return (
    <div className="rounded-xl border border-destructive/30 p-3">
      <p className="text-[15px] font-medium">Delete my account</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Close the account entirely — login and all. Type DELETE to confirm. Prefer starting fresh
        without closing the account? Use Erase all my data above. Backups and the AI provider may
        still hold traces for a short time.
      </p>
      <input
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder="Type DELETE"
        autoComplete="off"
        className="mt-3 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
        aria-label="Type DELETE to confirm account deletion"
      />
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() =>
          void (async () => {
            setBusy(true);
            setError("");
            try {
              await deleteMyAccount({ data: { confirm: "DELETE" } });
              clearStoredVaultKeys(userId);
              clearLocalUserData(userId);
              await supabase.auth.signOut();
              await navigate({ to: "/auth" });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not delete the account.");
            } finally {
              setBusy(false);
            }
          })()
        }
        className="mt-3 w-full rounded-xl border border-destructive px-4 py-2 text-[14.5px] font-semibold text-destructive disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete my account forever"}
      </button>
    </div>
  );
}
