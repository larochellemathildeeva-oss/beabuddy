import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { startTour } from "@/components/Tour";
import { PackingLists } from "@/components/PackingLists";
import { CustomizeHome } from "@/components/CustomizeHome";

import { useTrips } from "@/hooks/useTrips";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";


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

const offline = [
  { name: "Maps", detail: "Street maps for the cities on your trips." },
  { name: "Photos", detail: "Your imported pictures, viewable with no signal." },
  { name: "Recommendations", detail: "Every saved place and who told you about it." },
  { name: "Itineraries", detail: "Trip timelines, stops and dates." },
  { name: "Documents", detail: "Your encrypted vault, still locked behind your passphrase." },
];

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
  const [downloads, setDownloads] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

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

  const toggleDownload = (value: string) =>
    setDownloads((list) =>
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );


  const signedInName = displayName || user?.email?.split("@")[0] || "Traveller";

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
                  Style, budget, pace, favourite countries and your {interests.length} travel tag
                  {interests.length === 1 ? "" : "s"} — this is what Béa plans with.
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
                  Warm cream by day, deep clay by night.
                </p>
              </div>
              <button
                onClick={() => setDark((v) => !v)}
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
                  A quick walk through everything Béa can do.
                </p>
              </div>
              <button
                onClick={() => {
                  startTour();
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
            downloads.length ? `${downloads.length} ready offline` : "Nothing downloaded yet"
          }
        >
          <p className="mb-3 text-[12px] text-muted-foreground">
            Download these before you lose signal and they stay readable on the road.
          </p>
          <div className="divide-y divide-border">
            {offline.map((o) => (
              <button
                key={o.name}
                onClick={() => toggleDownload(o.name)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left"
              >
                <span>
                  <span className="block text-[14px]">{o.name}</span>
                  <span className="block text-[11.5px] text-muted-foreground">{o.detail}</span>
                </span>
                <span
                  className={`shrink-0 text-[11px] ${
                    downloads.includes(o.name) ? "text-nexttime" : "text-muted-foreground"
                  }`}
                >
                  {downloads.includes(o.name) ? "Downloaded" : "Download"}
                </span>
              </button>
            ))}
          </div>
        </Collapsible>

        <Collapsible title="Legal, privacy and such" summary="Policies, terms and your data">
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
            <p className="px-1 pt-1 text-[11px] text-muted-foreground">
              © 2026 Mathilde E. Larochelle. All rights reserved.
            </p>
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

        <Link to="/help" className="card-soft flex items-center justify-between gap-3 p-4">
          <span>
            <span className="block text-[14px] font-medium">Help & FAQ</span>
            <span className="block text-[12px] text-muted-foreground">
              Answers to the questions people ask most.
            </span>
          </span>
          <span className="shrink-0 text-[13px] text-primary">Open</span>
        </Link>
      </div>
    </AppShell>
  );
}

