import { interestLine } from "@/lib/interest-line";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/friendly-error";
import { formatTripLocation } from "@/lib/place-label";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { rememberedProfileName, rememberProfileName, shownName } from "@/lib/profile-name";
import { Sheet } from "@/components/Sheet";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { resumeOrReplayTour } from "@/components/Tour";
import { PackingLists } from "@/components/PackingLists";
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
import { useCountriesVisited } from "@/hooks/useCountriesVisited";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { hasDismissedSampleCta } from "@/lib/auto-seed";
import { clearDemoSeed } from "@/lib/demo-seed";
import { ThemePicker } from "@/components/ThemePicker";
import { StopPicturesPicker } from "@/components/StopPicturesPicker";
import { TripBannerPicker } from "@/components/TripBannerPicker";
import { AccessibilityPicker } from "@/components/AccessibilityPicker";
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
  validateSearch: (search: Record<string, unknown>): { panel?: MenuPanel } =>
    MENU_PANELS.includes(search["panel"] as MenuPanel)
      ? { panel: search["panel"] as MenuPanel }
      : {},
  component: ProfilePage,
});

/** The You panels the Menu opens: /profile?panel=appearance and so on. */
const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "1.0.0";

const MENU_PANELS = ["appearance", "feedback", "legal", "about", "settings"] as const;
type MenuPanel = (typeof MENU_PANELS)[number];

/** The panels the You page opens over itself. One at a time. */
type Panel =
  | "settings"
  | "packing"
  | "appearance"
  | "reading"
  | "pictures"
  | "data"
  | "offline"
  | "legal"
  | "erase"
  | "delete"
  | "feedback"
  | "about";

/**
 * A big card or list: plain in every theme, Colorful included. `plain-card`
 * comes from styles.css; the utilities are the same look, for safety.
 */
const PLAIN = "plain-card rounded-[var(--r-card)] border border-border/55 bg-card shadow-sm";

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
  const [saved, setSaved] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [confirmSample, setConfirmSample] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [sampleCtaDismissed, setSampleCtaDismissed] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const close = () => setPanel(null);
  // Opened from the Menu: show that panel, then drop it from the address so
  // going back does not open it again.
  const asked = Route.useSearch().panel;
  useEffect(() => {
    if (!asked) return;
    setPanel(asked);
    void navigate({ to: "/profile", search: {}, replace: true });
  }, [asked, navigate]);

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
      .select("display_name, home_city, preferences")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error) setProfileLoaded(true);
        if (!data) return;
        setDisplayName(data.display_name ?? "");
        rememberProfileName(safeStorage(), user.id, data.display_name ?? "");
        setHomeCity(data.home_city ?? "");
        lastSaved.current = {
          display_name: data.display_name ?? "",
          home_city: data.home_city ?? "",
        };
        if (data.preferences?.length) setInterests(data.preferences);
      });
    return () => {
      active = false;
    };
  }, [user]);

  /** What the account holds, so a blur and Save details do not write the same thing twice. */
  const lastSaved = useRef<{ display_name?: string; home_city?: string }>({});
  /** Saves run one after another, never overlapping. */
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));
  const [savingProfile, setSavingProfile] = useState(false);
  const saveProfile = (patch: {
    display_name?: string;
    home_city?: string;
    preferences?: string[];
  }): Promise<boolean> => {
    const run = saveQueue.current.then(async () => {
      if (!user) return false;
      const changed = Object.fromEntries(
        Object.entries(patch).filter(
          ([key, value]) => lastSaved.current[key as keyof typeof lastSaved.current] !== value,
        ),
      ) as typeof patch;
      if (Object.keys(changed).length === 0) return true;
      const { error } = await supabase.from("profiles").upsert({ id: user.id, ...changed });
      if (error) {
        toast.error("That didn't save. Try again.");
        return false;
      }
      if (changed.display_name !== undefined) {
        lastSaved.current.display_name = changed.display_name;
        rememberProfileName(safeStorage(), user.id, changed.display_name);
      }
      if (changed.home_city !== undefined) lastSaved.current.home_city = changed.home_city;
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      return true;
    });
    saveQueue.current = run.catch(() => false);
    return run;
  };

  useEffect(() => {
    setOfflineTripIds(listSavedDirectionTripIds());
  }, []);

  const signedInName =
    shownName({ profileName: displayName, profileLoaded, email: user?.email }) ||
    (profileLoaded ? "Traveller" : "");
  const offlineTrips = t.trips.filter((trip) => offlineTripIds.includes(trip.id));
  const tripCount = t.trips.length;
  // The same figure as World: places been there and trips started.
  const countryCount = useCountriesVisited(t.trips);

  const replayTour = () => {
    resumeOrReplayTour();
    void navigate({ to: "/" });
  };

  return (
    <AppShell eyebrow="You / menu" title="Your settings.">
      <div className="you-page space-y-6">
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

        {/* The rows of the Figma "You / menu" frame, in its order. */}
        <div data-guide={user ? "profile-account" : undefined}>
          {user ? (
            <YouRow
              title="Profile settings"
              note="Name and home city"
              onClick={() => setPanel("settings")}
              guide="profile-settings"
            />
          ) : null}
          {user ? (
            <YouRow
              title="Travel preferences"
              note="How you like to travel"
              to="/preferences"
              guide="travel-preferences"
            />
          ) : null}
          {user ? (
            <YouRow
              title="Packing lists"
              note="Reusable templates"
              onClick={() => setPanel("packing")}
              guide="packing-lists"
            />
          ) : null}
          <YouRow title="Photos & memories" note="Your travels kept together" to="/photos" />
          <YouRow
            title="Work travel"
            note="Receipts and expenses"
            to="/expenses"
            guide="work-travel"
          />
          <YouRow
            title="Trip documents"
            note="Bookings and references"
            href="/profile/documents"
            guide="trip-documents"
          />
          <YouRow
            title="Appearance"
            note="Calm, Colorful and Dark"
            onClick={() => setPanel("appearance")}
            guide="your-bea"
          />
          {user ? (
            <YouRow
              title="Data & imports"
              note="Bring your travel history"
              onClick={() => setPanel("data")}
              guide="offline-options"
            />
          ) : null}
          <YouRow
            title="Privacy & legal"
            note="Your data and choices"
            onClick={() => setPanel("legal")}
            guide="legal"
          />
          <YouRow title="Help & FAQ" note="A little guidance" to="/help" />
          <YouRow title="Feedback" note="Tell Béa something" onClick={() => setPanel("feedback")} />
          <YouRow
            title="About Béa"
            note="Your travel buddy"
            onClick={() => setPanel("about")}
            guide="replay-tour"
          />
        </div>

        <Link to="/" className="btn-primary flex w-full items-center justify-center px-4">
          Done
        </Link>
      </div>

      <Sheet
        open={panel === "settings"}
        onClose={close}
        page
        hint="Profile settings"
        title="A little about you"
        crumb="You"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (savingProfile) return;
            setSavingProfile(true);
            void saveProfile({ display_name: displayName, home_city: homeCity })
              .then((ok) => {
                // A failed save keeps the page open, to try again.
                if (ok) close();
              })
              .finally(() => setSavingProfile(false));
          }}
        >
          <LabelledField label="Your name" id="profile-name">
            <input
              id="profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => saveProfile({ display_name: displayName })}
              placeholder="Your name"
              className="min-h-11 w-full bg-transparent text-[16px] outline-none"
            />
          </LabelledField>
          <LabelledField label="Home city" id="profile-city">
            <input
              id="profile-city"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              onBlur={() => saveProfile({ home_city: homeCity })}
              placeholder="Home city"
              className="min-h-11 w-full bg-transparent text-[16px] outline-none"
            />
          </LabelledField>
          {/* Travel tags are chosen on Travel preferences; the box shows them and goes there. */}
          <Link
            to="/preferences"
            className="block rounded-[var(--r-card)] border border-[var(--field-border)] bg-card px-4 py-3"
          >
            <span className="block text-[12px] text-foreground">Travel tags</span>
            <span className="mt-1 block text-[16px]">
              {interests.length > 0 ? interestLine(interests) : "Add your interests"}
            </span>
          </Link>
          {user?.email && (
            <p className="text-[12px] text-muted-foreground">
              Signed in as {user.email}
              {` · ${tripCount} ${tripCount === 1 ? "trip" : "trips"} · ${countryCount} ${
                countryCount === 1 ? "country" : "countries"
              }`}
              {saved ? " · Saved" : ""}
            </p>
          )}
          <button
            type="submit"
            disabled={savingProfile}
            className="btn-primary flex w-full items-center justify-center px-4 disabled:opacity-60"
          >
            Save details
          </button>
        </form>
      </Sheet>

      <Sheet
        open={panel === "packing"}
        onClose={close}
        page
        hint="Packing lists"
        title="Lists to travel with"
        crumb="You"
      >
        <div className="space-y-3">
          <p className="text-[14px] text-foreground">
            Build lists here once. When you create a trip you can attach a copy of one — what you
            tick off or add there stays on that trip only.
          </p>
          <PackingLists label="My saved packing lists" hint="Your reusable templates." />
        </div>
      </Sheet>

      <Sheet
        open={panel === "appearance"}
        onClose={close}
        page
        hint="Appearance"
        title="Pick your look"
        crumb="You"
      >
        <ThemePicker variant="rows" />
        <p className="mt-3 border-t border-[var(--rule)] pt-2 text-[12px] text-foreground">
          Reading and motion
        </p>
        <YouRow
          title="Font and size"
          note="Keep things comfortable to read"
          onClick={() => setPanel("reading")}
        />
        <YouRow
          title="Reduced motion"
          note="Quiet transitions when preferred"
          onClick={() => setPanel("reading")}
        />
        <YouRow
          title="Stop pictures"
          note="Real photos, illustrations or none"
          onClick={() => setPanel("pictures")}
        />
        <button
          type="button"
          onClick={close}
          className="btn-primary mt-4 flex w-full items-center justify-center px-4"
        >
          Done
        </button>
      </Sheet>

      <Sheet
        open={panel === "reading"}
        onClose={() => setPanel("appearance")}
        page
        hint="Reading & motion"
        title="Comfort comes first"
        crumb="Appearance"
      >
        <AccessibilityPicker />
        <button
          type="button"
          onClick={() => setPanel("appearance")}
          className="btn-primary mt-4 flex w-full items-center justify-center px-4"
        >
          Done
        </button>
      </Sheet>

      <Sheet
        open={panel === "pictures"}
        onClose={() => setPanel("appearance")}
        page
        hint="Stop pictures"
        title="How places are pictured"
        crumb="Appearance"
      >
        <StopPicturesPicker variant="rows" />
        {/* The trip banner is a picture choice too; the design has no page of its own for it. */}
        <p className="mt-3 border-t border-[var(--rule)] pt-2 text-[12px] text-foreground">
          Trip banner
        </p>
        <TripBannerPicker variant="rows" />
        <button
          type="button"
          onClick={() => setPanel("appearance")}
          className="btn-primary mt-4 flex w-full items-center justify-center px-4"
        >
          Done
        </button>
      </Sheet>

      <Sheet
        open={panel === "data"}
        onClose={close}
        page
        hint="Data & imports"
        title="Bring it together"
        crumb="You"
      >
        <YouRow title="Import photos" note="From your phone" to="/photos" />
        <YouRow title="Trip calendar" note="Travel dates in one place" to="/calendar" />
        <YouRow title="Import places" note="A file or pasted list" to="/recommendations" />
        {/* Not drawn on the frame, and kept: what this phone holds offline. */}
        <YouRow
          title="Kept on this phone"
          note={
            offlineTrips.length > 0
              ? `${offlineTrips.length} ${offlineTrips.length === 1 ? "trip" : "trips"} offline`
              : "Trips kept for no signal"
          }
          onClick={() => setPanel("offline")}
        />
        {user ? (
          <YouRow
            title="Erase account"
            note="Review before deleting"
            onClick={() => setPanel("erase")}
          />
        ) : null}
        {user && !sampleCtaDismissed && (
          <div className="border-b border-[var(--rule)] py-3">
            <p className="text-[16px]">Sample data</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Loaded the sample trips and places earlier? Remove deletes only those — never places
              you added yourself.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={seeding}
                onClick={() => setConfirmSample(true)}
                className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--r-card)] border border-border px-4 text-[14px] disabled:opacity-60"
              >
                Remove sample
              </button>
            </div>
            <ConfirmSheet
              open={confirmSample}
              onClose={() => setConfirmSample(false)}
              title="Remove the sample?"
              body="The sample trips and places are deleted. Places you added yourself stay."
              confirmLabel="Remove sample"
              onConfirm={async () => {
                setConfirmSample(false);
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
            />
            {seedMsg && <p className="mt-2 text-[13px] text-muted-foreground">{seedMsg}</p>}
          </div>
        )}

        <button
          type="button"
          onClick={close}
          className="btn-primary mt-4 flex w-full items-center justify-center px-4"
        >
          Done
        </button>
      </Sheet>

      <Sheet
        open={panel === "offline"}
        onClose={() => setPanel("data")}
        page
        hint="Data & imports"
        title="Kept on this phone"
        crumb="Data & imports"
      >
        <div>
          <p className="text-[14px] text-foreground">
            Installed on your home screen, Béa is designed to open without signal. Photos,
            recommendations, new searches and the vault still need a connection.
          </p>
          <p className="mt-2 text-[14px] text-foreground">
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
      </Sheet>

      <Sheet
        open={panel === "legal"}
        onClose={close}
        page
        hint="Privacy & legal"
        title="Your data. Your choices"
        crumb="You"
      >
        <YouRow title="Privacy policy" note="What Béa keeps" to="/privacy" />
        <YouRow title="Terms of service" note="Using Béa" to="/terms" />
        {user ? (
          <>
            <YouRow
              title="Erase my data"
              note="Start fresh, keep your login"
              onClick={() => setPanel("erase")}
            />
            <YouRow
              title="Delete account"
              note="Erase your account and data"
              onClick={() => setPanel("delete")}
            />
          </>
        ) : null}
        <div className="space-y-1.5 pt-3 text-[12px] leading-[1.5] text-foreground">
          <CopyrightNotice className="px-0 pb-0 pt-0 text-left text-[12px] text-foreground" />
          <p>
            Béa — the app, its name, design, features and original ideas — is Mathilde E.
            Larochelle's work. You keep what you save in it. The Terms spell this out.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="btn-primary mt-4 flex w-full items-center justify-center px-4"
        >
          Done
        </button>
      </Sheet>

      {user && (
        <Sheet
          open={panel === "erase"}
          onClose={() => setPanel("legal")}
          page
          hint="Confirmation"
          title="Erase your data?"
          crumb="Privacy & legal"
        >
          <EraseDataPanel userId={user.id} />
        </Sheet>
      )}
      {user && (
        <Sheet
          open={panel === "delete"}
          onClose={() => setPanel("legal")}
          page
          hint="Confirmation"
          title="Erase your account?"
          crumb="Privacy & legal"
        >
          <DeleteAccountPanel userId={user.id} />
        </Sheet>
      )}

      <Sheet
        open={panel === "feedback"}
        onClose={close}
        page
        hint="Feedback"
        title="Tell Béa something"
        crumb="You"
      >
        <div className="space-y-3">
          <p className="text-[14px] text-foreground">
            Béa is here to make you happy. A missing travel stat, a wish, something that broke —
            write it here. It is saved to your account so we can actually read it.
          </p>
          <FeedbackForm alreadySignedIn={!!user} />
        </div>
      </Sheet>

      <Sheet
        open={panel === "about"}
        onClose={close}
        page
        hint="About Béa"
        title="Your travel buddy"
        crumb="You"
      >
        <YouRow title="How Béa works" note="Plan, explore and remember" to="/how-it-works" />
        <YouRow title="Help & FAQ" note="Get a little guidance" to="/help" />
        <YouRow title="Privacy" note="What Béa keeps" to="/privacy" />
        <YouRow title="Version" note={`Béa ${APP_VERSION}`} />
        {/* Not drawn on the About frame, and kept: the tour and Béa's personality. */}
        <YouRow
          title="Show me around"
          note="A step-by-step walk of the app"
          onClick={replayTour}
          guide="replay-tour"
        />
        <YouRow
          title="Béa's personality"
          note={`${modeName(bea.mix)} · How much she suggests and helps`}
          to="/profile/bea"
        />
        <CopyrightNotice className="px-0 pb-0 pt-3 text-left text-[12px] text-foreground" />
        <Link
          to="/how-it-works"
          onClick={close}
          className="btn-primary mt-4 flex w-full items-center justify-center px-4"
        >
          How it works
        </Link>
      </Sheet>
    </AppShell>
  );
}

/** A field in a hairline box with its label inside, as the Figma forms draw it. */
function LabelledField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[var(--r-card)] border border-[var(--field-border)] bg-card px-4 py-3 focus-within:border-primary">
      <label htmlFor={id} className="block text-[12px] text-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function YouRow({
  title,
  note,
  to,
  href,
  onClick,
  guide,
}: {
  title: string;
  note: string;
  to?:
    | "/preferences"
    | "/expenses"
    | "/photos"
    | "/help"
    | "/profile/bea"
    | "/how-it-works"
    | "/privacy"
    | "/terms"
    | "/calendar"
    | "/recommendations";
  href?: string;
  onClick?: () => void;
  guide?: string;
}) {
  const cls = "block w-full border-b border-border py-3 text-start";
  const body = (
    <>
      <span className="block text-[16px] leading-[22px]">{title}</span>
      <span className="mt-1 block text-[14px] leading-[20px] text-muted-foreground">{note}</span>
    </>
  );
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
  // A row that only says something (the version) is not a button.
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onClick} data-guide={guide} className={cls}>
      {body}
    </button>
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
      setError(friendlyError(e, "Could not erase your data."));
      setConfirmStep(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[14px] leading-[1.5] text-foreground">
        Start fresh without closing your account. This is designed to remove your trips,
        recommendations, photos, receipts, vault documents, and travel preferences. Shared trips
        hand off to another member when someone else is on them. Your login stays. Backups and the
        AI provider may still hold traces for a short time.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError("");
          setConfirmStep(1);
        }}
        className="btn-primary mt-4 flex w-full items-center justify-center px-4 disabled:opacity-50"
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
    <div>
      <div className="rounded-[var(--r-card)] border border-[var(--field-border)] bg-card px-4 py-3 focus-within:border-primary">
        <label htmlFor="delete-confirm" className="block text-[12px] text-foreground">
          Confirm deletion
        </label>
        <input
          id="delete-confirm"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
          className="mt-1 min-h-11 w-full bg-transparent text-[16px] outline-none"
          aria-label="Type DELETE to confirm account deletion"
        />
      </div>
      <p className="mt-3 text-[14px] leading-[1.5] text-foreground">
        Review what will be erased before confirming: the account itself, login and all. Prefer
        starting fresh without closing it? Erase my data, in Privacy & legal. Backups and the AI
        provider may still hold traces for a short time.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-destructive">
          {error}
        </p>
      )}
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
              setError(friendlyError(e, "Could not delete the account."));
            } finally {
              setBusy(false);
            }
          })()
        }
        className="btn-primary mt-4 flex w-full items-center justify-center px-4 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete account"}
      </button>
    </div>
  );
}
