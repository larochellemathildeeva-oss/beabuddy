import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
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
import { clearDemoSeed, loadDemoSeed } from "@/lib/demo-seed";
import { applyDark, readDark } from "@/lib/theme";
import { deleteMyAccount, eraseMyData } from "@/lib/account.functions";
import { clearLocalUserData } from "@/lib/clear-local-user-data";
import { clearStoredVaultKeys } from "@/lib/vaultCrypto";


export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Béa" },
      {
        name: "description",
        content:
          "Your travel statistics, preferences, offline downloads and appearance settings inside Béa.",
      },
      { property: "og:title", content: "Profile — Béa" },
      {
        property: "og:description",
        content: "Travel statistics, interests and offline settings for your travel buddy.",
      },
    ],
  }),
  component: ProfilePage,
});

function Collapsible({
  title,
  summary,
  children,
  defaultOpen = false,
  guide,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  guide?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section data-guide={guide} className="card-soft overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span>
          <span className="block text-[14px] font-medium">{title}</span>
          {summary && <span className="block text-[12px] text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-border/70 p-4">{children}</div>}
    </section>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const t = useTrips();
  const [dark, setDark] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [offlineTripIds, setOfflineTripIds] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [saved, setSaved] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  useEffect(() => {
    setDark(readDark());
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("profiles")
      .select("display_name, home_city, preferences")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setDisplayName(data.display_name ?? "");
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
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  useEffect(() => {
    setOfflineTripIds(listSavedDirectionTripIds());
  }, []);

  const signedInName = displayName || user?.email?.split("@")[0] || "Traveller";
  const offlineTrips = t.trips.filter((trip) => offlineTripIds.includes(trip.id));

  return (
    <AppShell eyebrow="Profile" title={user ? signedInName : "Your profile"}>
      <div className="space-y-4">
        {!loading && !user && (
          <div data-guide="profile-account" className="card-soft p-4">
            <p className="font-display text-[19px] leading-snug">
              Sign in to keep all of this forever.
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              With an account your pins, trips, recommendations and photo memories are saved to you
              and follow you to any device.
            </p>
            <Link
              to="/auth"
              className="mt-3 block rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-primary-foreground"
            >
              Sign in or create an account
            </Link>
          </div>
        )}

        {user && (
          <div data-guide="profile-account" className="card-soft space-y-3 p-4">
            <div className="flex items-center gap-4">
              <div className="clay-gradient grid size-14 shrink-0 place-items-center rounded-full font-display text-[22px] text-primary-foreground">
                {signedInName[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium">{user.email}</p>
                <p className="text-[12px] text-muted-foreground">
                  {saved ? "Saved" : "Signed in — everything saves to your account"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to="/photos"
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-primary-foreground"
              >
                Import photos
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/auth" });
                }}
                className="rounded-xl border border-border px-4 py-2.5 text-[13px]"
              >
                Sign out
              </button>
            </div>
            <div className="rounded-xl border border-border bg-elevated p-3">
              <p className="text-[13px] font-semibold">Demo / sample data</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Loads ~10 cities, Lisbon-heavy recommendations, 3 trips with timelines, and Future Me
                notes. Remove only deletes the sample rows — not places you added yourself.
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
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
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
                    setSeedMsg(
                      result.ok
                        ? `Removed ${result.recos} places, ${result.trips} trips, ${result.notes} notes.`
                        : result.message,
                    );
                  }}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
                >
                  Remove sample
                </button>
              </div>
              {seedMsg && <p className="mt-2 text-[12px] text-muted-foreground">{seedMsg}</p>}
            </div>
          </div>
        )}

        <Collapsible
          title="Profile settings"
          summary={`Your details and ${interests.length} travel tag${interests.length === 1 ? "" : "s"}`}
          guide="profile-settings"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="label-caps text-foreground">Your details</p>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => saveProfile({ display_name: displayName })}
                placeholder="Your name"
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
              />
              <input
                value={homeCity}
                onChange={(e) => setHomeCity(e.target.value)}
                onBlur={() => saveProfile({ home_city: homeCity })}
                placeholder="Home city"
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
              />
            </div>

            <Link
              to="/preferences"
              data-guide="travel-preferences"
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <span>
                <span className="block text-[13px] font-medium">Travel preferences</span>
                <span className="block text-[11.5px] text-muted-foreground">
                  Help Béa understand how you like to travel — style, pace, and tags she plans with.
                </span>
              </span>
              <span className="shrink-0 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold">
                Open
              </span>
            </Link>


            <CustomizeHome variant="row" />

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div>
                <p className="text-[13px] font-medium">{dark ? "Dark" : "Light"} mode</p>
                <p className="text-[11.5px] text-muted-foreground">
                  Warm cream by day, black and light grey by night.
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !dark;
                  applyDark(next);
                  setDark(next);
                }}
                aria-label="Toggle dark mode"
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  dark ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-card transition-all ${
                    dark ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div data-guide="replay-tour" className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div>
                <p className="text-[13px] font-medium">Take the tour again</p>
                <p className="text-[11.5px] text-muted-foreground">
                  Replay the story walk, or the Deep Dive on what makes Béa different.
                </p>
              </div>
              <button
                onClick={() => {
                  resumeOrReplayTour();
                  void navigate({ to: "/" });
                }}
                className="shrink-0 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
              >
                Replay
              </button>
            </div>
          </div>
        </Collapsible>

        <Collapsible
          title="Create packing lists"
          summary="Reusable lists you can attach to a new trip"
          guide="packing-lists"
        >
          <div className="space-y-2">
            <p className="text-[12px] text-muted-foreground">
              Build lists here once. When you create a trip you can attach a copy of one — what you
              tick off or add there stays on that trip only.
            </p>
            <PackingLists label="My saved packing lists" hint="Your reusable templates." />
          </div>
        </Collapsible>

        <Collapsible
          title="Offline options"
          summary={
            offlineTrips.length
              ? `${offlineTrips.length} trip${offlineTrips.length === 1 ? "" : "s"} with directions on this phone`
              : "Only trip directions can be kept on this phone"
          }
          guide="offline-options"
        >
          <p className="text-[12px] text-muted-foreground">
            Béa cannot pack maps, photos, recommendations, itineraries or the vault onto this phone
            yet. Those still need a connection.
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            What does work: open a trip → settings → Offline directions. That keeps the walk or
            drive steps on this phone.
          </p>
          {offlineTrips.length > 0 ? (
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
              {offlineTrips.map((trip) => (
                <li key={trip.id} className="px-3 py-2.5">
                  <p className="text-[13px] font-medium">{trip.title}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {[trip.city, trip.country].filter(Boolean).join(", ") || "Directions saved here"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12px] text-muted-foreground">
              None yet. Open a trip and download Offline directions there.
            </p>
          )}
          <Link
            to="/trips"
            className="mt-3 block rounded-xl border border-border px-4 py-2.5 text-center text-[13px] font-semibold"
          >
            Open trips
          </Link>
        </Collapsible>

        <Collapsible title="Legal, privacy and such" summary="Policies, terms and your data" guide="legal">
          <div className="space-y-2">
            <Link
              to="/privacy"
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <span>
                <span className="block text-[14px] font-medium">Privacy policy</span>
                <span className="block text-[11.5px] text-muted-foreground">
                  How your account, photos and documents are stored and protected.
                </span>
              </span>
              <span className="shrink-0 text-[13px] text-primary">Read</span>
            </Link>
            <Link
              to="/terms"
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <span>
                <span className="block text-[14px] font-medium">Terms of Service</span>
                <span className="block text-[11.5px] text-muted-foreground">
                  The rules of the road, disclaimers and liability limits you agreed to.
                </span>
              </span>
              <span className="shrink-0 text-[13px] text-primary">Read</span>
            </Link>
            <div className="rounded-xl border border-border p-3">
              <CopyrightNotice className="px-0 pb-0 pt-0 text-left text-[12px] text-muted-foreground" />
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                Béa — the app, its name, design, features and original ideas — is Mathilde E.
                Larochelle's work. You keep what you save in it. The Terms spell this out.
              </p>
            </div>
            {user && <EraseDataPanel userId={user.id} />}
            {user && <DeleteAccountPanel userId={user.id} />}
          </div>
        </Collapsible>

        <Collapsible title="Work travel" summary="Receipts, expenses and exports">
          <Link
            to="/expenses"
            className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
          >
            <span>
              <span className="block text-[14px] font-medium">Receipts & expenses</span>
              <span className="block text-[11.5px] text-muted-foreground">
                Photograph receipts and download a spreadsheet for accounting.
              </span>
            </span>
            <span className="shrink-0 text-[13px] text-primary">Open</span>
          </Link>
        </Collapsible>

        <Link
          to="/help"
          className="card-soft flex items-center justify-between gap-3 px-4 py-3.5"
        >
          <span>
            <span className="block text-[14px] font-medium">Help & FAQ</span>
            <span className="block text-[12px] text-muted-foreground">
              Answers to the questions people ask most.
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        <Collapsible
          title="Feedback"
          summary="Tell Béa something"
          guide="feedback"
        >
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">
              Béa is here to make you happy. A missing travel stat, a wish, something that broke —
              write it here. It is saved to your account so we can actually read it.
            </p>
            <FeedbackForm alreadySignedIn={!!user} />
          </div>
        </Collapsible>
      </div>
    </AppShell>
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
      <p className="text-[14px] font-medium">Erase all my data</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Start fresh without closing your account. This is designed to remove your trips,
        recommendations, photos, receipts, vault documents, and travel preferences. Shared trips
        hand off to another member when someone else is on them. Your login stays. Backups and the
        AI provider may still hold traces for a short time.
      </p>
      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError("");
          setConfirmStep(1);
        }}
        className="mt-3 w-full rounded-xl border border-destructive px-4 py-2.5 text-[13px] font-semibold text-destructive disabled:opacity-50"
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
      <p className="text-[14px] font-medium">Delete my account</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Close the account entirely — login and all. Type DELETE to confirm. Prefer starting fresh
        without closing the account? Use Erase all my data above. Backups and the AI provider may
        still hold traces for a short time.
      </p>
      <input
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder="Type DELETE"
        autoComplete="off"
        className="mt-3 w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px]"
        aria-label="Type DELETE to confirm account deletion"
      />
      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
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
        className="mt-3 w-full rounded-xl border border-destructive px-4 py-2.5 text-[13px] font-semibold text-destructive disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete my account forever"}
      </button>
    </div>
  );
}

