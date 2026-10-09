import { interestLine } from "@/lib/interest-line";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/friendly-error";
import { formatTripLocation } from "@/lib/place-label";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { BookOpen, CalendarDays, ChevronRight, type LucideProps } from "@/components/icons";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { rememberedProfileName, rememberProfileName, shownName } from "@/lib/profile-name";
import { Sheet } from "@/components/Sheet";
import { ConfirmSheet } from "@/components/ConfirmSheet";
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
const MENU_PANELS = ["appearance", "feedback", "legal", "about", "settings"] as const;
type MenuPanel = (typeof MENU_PANELS)[number];

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
        if (data.preferences?.length) setInterests(data.preferences);
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
            void saveProfile({ display_name: displayName, home_city: homeCity }).then(close);
          }}
        >
          <LabelledField label="Your name" id="profile-name">
            <input
              id="profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => saveProfile({ display_name: displayName })}
              placeholder="Your name"
              className="w-full bg-transparent text-[16px] outline-none"
            />
          </LabelledField>
          <LabelledField label="Home city" id="profile-city">
            <input
              id="profile-city"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              onBlur={() => saveProfile({ home_city: homeCity })}
              placeholder="Home city"
              className="w-full bg-transparent text-[16px] outline-none"
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
            className="btn-primary flex w-full items-center justify-center px-4"
          >
            Save details
          </button>
        </form>
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
          <TripBannerPicker />
          <StopPicturesPicker />
          <AccessibilityPicker />
          <CustomizeHome variant="row" trips={t} />
          {/* Béa's personality: the You list in the design has no row of its own for it. */}
          <YouRow
            title="Béa's personality"
            note={`${modeName(bea.mix)} · How much she suggests and helps`}
            to="/profile/bea"
          />
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
              to="/calendar"
              icon={CalendarDays}
              title="Trip calendar"
              hint="Every trip, flight, hotel and reservation on one calendar."
            />
          </div>

          {user && !sampleCtaDismissed && (
            <div className="rounded-2xl border border-border bg-elevated p-3">
              <p className="text-[14.5px] font-semibold">Sample data</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Loaded the sample trips and places earlier? Remove deletes only those — never places
                you added yourself.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={seeding}
                  onClick={() => setConfirmSample(true)}
                  className="flex-1 rounded-full border border-border px-4 py-2 text-[14.5px] font-semibold disabled:opacity-60"
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
  to?: "/preferences" | "/expenses" | "/photos" | "/help" | "/profile/bea";
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
  return (
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
        <p className="text-[14.5px] font-medium">Show me around</p>
        <p className="text-[12.5px] text-muted-foreground">
          A step-by-step walk for planning, importing, saving places, the trip itself, or your map.
        </p>
      </div>
      <button
        type="button"
        onClick={onReplay}
        className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-[14.5px] font-semibold"
      >
        Start
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
      setError(friendlyError(e, "Could not erase your data."));
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
        className="mt-3 w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2.5 text-[15px]"
        aria-label="Type DELETE to confirm account deletion"
      />
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
        className="mt-3 w-full rounded-xl border border-destructive px-4 py-2 text-[14.5px] font-semibold text-destructive disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete my account forever"}
      </button>
    </div>
  );
}
