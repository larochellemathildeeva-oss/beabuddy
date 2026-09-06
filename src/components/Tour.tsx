import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const TOUR_KEY = "bea-tour-seen";

type Step = {
  title: string;
  body: string;
  to?: string;
  linkLabel?: string;
  /** Route only makes sense once signed in. */
  needsAuth?: boolean;
};

const steps: Step[] = [
  {
    title: "Welcome to Béa",
    body: "Béa is your travel memory vault: every place you've been, every place you want to go, and every plan in between — all in one calm little app.",
  },
  {
    title: "Home",
    body: "Your current or next trip sits at the top. Shortcuts jump to your travel story and city memories, and you can hide or show those sections from Profile.",
    to: "/",
  },
  {
    title: "World",
    body: "A real map of the world with a pin for every place. Blue for visited, green for next time, yellow for the wish list, purple for a recommendation. There's a heat map too.",
    to: "/world",
  },
  {
    title: "Help me choose",
    body: "Can't decide between a few pins? Tick two to five of your saved places, say what matters (warm, cheap, a long weekend…), and Béa weighs them up with a pick and honest trade-offs.",
    to: "/world",
  },
  {
    title: "Trips",
    body: "Make a trip, add the cities you're visiting, invite a friend with a code, and see who's looking at the plan right now. Trip settings can save walking and driving directions between those cities for when there's no signal.",
    to: "/trips",
  },
  {
    title: "Let Béa plan",
    body: "On any trip, tap the sparkle next to the name. Béa can build a day-by-day plan from your travel preferences, read a photo or pasted itinerary, rearrange the stops you already have (closest together, rainy-day indoor, easy mornings…), or compare two drafts. Tick what you want and save it onto that trip.",
    to: "/trips",
  },
  {
    title: "Budgets and calendar",
    body: "Each trip has a budget with planned expenses and a live spending tracker that updates the moment you claim a receipt — across all your devices. The calendar lays every trip and plan out by date.",
    to: "/calendar",
    needsAuth: true,
  },
  {
    title: "Recommendations",
    body: "Paste a link, search the web, pin a nearby place on the map, or tap 'I'm here now'. Search forgives typos — a missing or doubled letter still finds the place.",
    to: "/recommendations",
  },
  {
    title: "Near me",
    body: "Standing somewhere with a free hour? Béa ranks everything you've saved by how close it is, from right here to a day trip away, and opens directions.",
    to: "/opportunities",
  },
  {
    title: "Your location, your rules",
    body: "Béa always asks before using your location, and you choose how long it stays on — just this once, an hour, today, or until you turn it off.",
    to: "/opportunities",
  },
  {
    title: "Photos become memories",
    body: "Import pictures from your phone. Béa reads the location saved inside each one, sorts them into city memory pages, and drops a pin on your map automatically. You'll see a privacy note before every upload.",
    to: "/photos",
    needsAuth: true,
  },
  {
    title: "City memories and Future Me",
    body: "Every city you visit gets its own memory page with your photos and pins. Leave a note to your future self on any place, and Béa hands it back when you return.",
    to: "/memories",
    needsAuth: true,
  },
  {
    title: "Receipts and expenses",
    body: "Travelling for work? Photograph each receipt, tag the trip, and download a tidy spreadsheet. Receipts in euros, dollars or pounds all roll into one total in your home currency at today's real exchange rates.",
    to: "/expenses",
    needsAuth: true,
  },
  {
    title: "The document vault",
    body: "Passports, visas and boarding passes, locked behind a passcode or your fingerprint and scrambled on your own device before they're ever stored.",
    to: "/profile",
  },
  {
    title: "Light and dark",
    body: "Profile settings has an appearance switch: warm cream by day, black and light grey at night. That's also where you set the travel preferences Béa plans with.",
    to: "/profile",
  },
  {
    title: "You're all set",
    body: "That's the whole tour. Replay it any time from Profile settings, tap Ask Béa on any page for a walkthrough of that screen, and the privacy policy lives on your profile too.",
    to: "/",
  },
];

export function useTourControl() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(TOUR_KEY) !== "yes") setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener("bea-tour-start", reopen);
    // Brand-new accounts (covers Google/Apple sign-up, which redirects away
    // and comes back): if the session that just started belongs to a user
    // created in the last couple of minutes, walk them through the tour.
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;
      const created = new Date(session.user.created_at).getTime();
      if (Date.now() - created < 2 * 60 * 1000) startTour();
    });
    return () => {
      window.removeEventListener("bea-tour-start", reopen);
      authSub.subscription.unsubscribe();
    };
  }, []);

  return { open, setOpen };
}

export function startTour() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOUR_KEY);
  window.dispatchEvent(new Event("bea-tour-start"));
}

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  const step = steps[i]!;
  const blocked = !!step.needsAuth && !user;

  // Bring up the screen each step is talking about.
  useEffect(() => {
    if (!open || loading) return;
    const s = steps[i]!;
    if (!s.to) return;
    if (s.needsAuth && !user) return; // signed-out users would just hit the sign-in wall
    navigate({ to: s.to });
  }, [open, i, user, loading, navigate]);

  if (!open) return null;
  const last = i === steps.length - 1;

  const finish = () => {
    if (typeof window !== "undefined") localStorage.setItem(TOUR_KEY, "yes");
    onClose();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-4">
      <div className="pointer-events-auto w-full max-w-[480px] rounded-3xl border border-border bg-background p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="label-caps">
            Step {i + 1} of {steps.length}
          </p>
          <button onClick={finish} className="text-[12px] text-muted-foreground underline">
            Skip
          </button>
        </div>

        <h2 className="mt-2 font-display text-[24px] leading-tight">{step.title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{step.body}</p>
        {blocked && (
          <p className="mt-2 text-[12px] italic text-muted-foreground">
            This screen opens once you're signed in — for now, picture it here.
          </p>
        )}

        <div className="mt-3 flex gap-1">
          {steps.map((_, n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full ${n <= i ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {i > 0 && (
            <button
              onClick={() => setI(i - 1)}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-[14px] font-semibold"
            >
              Back
            </button>
          )}
          <button
            onClick={() => (last ? finish() : setI(i + 1))}
            className="flex-1 rounded-xl bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground"
          >
            {last ? "Start using Béa" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
