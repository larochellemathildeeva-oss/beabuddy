import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { guideKeyForPath } from "@/lib/guide-key";
import { Sparkles, X } from "lucide-react";
import {
  findGuideTarget,
  measureGuideTarget,
  SpotlightOverlay,
  trackGuideTargetSettle,
  type SpotlightBox,
} from "./SpotlightOverlay";

type GuideStep = {
  title: string;
  body: string;
  /** CSS selector for the element to highlight. */
  selector?: string;
};

type Guide = { name: string; steps: GuideStep[] };

const guides: Record<string, Guide> = {
  "/": {
    name: "Home",
    steps: [
      {
        title: "What's around you",
        body: "The places you already saved, sorted by how close you are right now, with directions one tap away. Béa only looks when you say so, and you pick for how long — tap Show all to change the distance or build a day trip.",
        selector: "[data-guide='home-near']",
      },
      {
        title: "Your trip right now",
        body: "The trip you're on, or the next one coming, sits here with its dates and the first few things on the plan. Tap it to open the whole folder.",
        selector: "[data-guide='home-trip']",
      },
      {
        title: "Waiting for you",
        body: "A saved recommendation Béa is holding onto. Tap through to see what's near you.",
        selector: "[data-guide='home-waiting']",
      },
      {
        title: "Future Me",
        body: "The newest note you left for yourself. It surfaces again when you come back to that city.",
        selector: "[data-guide='home-future']",
      },
      {
        title: "An empty vault",
        body: "Nothing saved yet. Import photos or save a recommendation and Home will fill in.",
        selector: "[data-guide='home-empty']",
      },
    ],
  },
  "/world": {
    name: "World",
    steps: [
      {
        title: "The map itself",
        body: "Drag to spin the globe, pinch or scroll to zoom. Each dot is a place: blue you've been, green for next time, yellow wish list, purple a recommendation.",
        selector: "[data-guide='globe']",
      },
      {
        title: "Show only what you want",
        body: "These chips hide and show whole groups of pins, so a busy map calms down in one tap.",
        selector: "[data-guide='pin-filters']",
      },
      {
        title: "Help me choose",
        body: "Tick a few saved places and Béa weighs them against each other — warmth, cost, how long you've got — and gives you a pick with the honest trade-offs.",
        selector: "[data-guide='compare-pins']",
      },
      {
        title: "Travel statistics",
        body: "Open this to see your counters — countries, cities, trips and pins. Choose which ones to show, and turn countries into a share of the world (1 of 195, as a percent). Want a number Béa does not count yet? Ask her on You → Feedback — she is here to make you happy.",
        selector: "[data-guide='travel-stats']",
      },
      {
        title: "Add a city by hand",
        body: "Type one city or country, or paste / upload a list from your notes. Country names are recognised straight away. Other names are looked up so you can pick the pin before anything lands on the globe. If one name is not recognised, tap Correct it and type the usual name. Those places count in your travel stats too.",
        selector: "[data-guide='add-city']",
      },
    ],
  },
  "/trips": {
    name: "Trips",
    steps: [
      {
        title: "Start a trip",
        body: "Name it, search the starting city, pick your dates if you know them, mark them Tentative or Confirmed, and tick a budget only if you want one. You can still change all of this after the trip exists.",
        selector: "[data-guide='new-trip']",
      },
      {
        title: "Join with a code",
        body: "Someone already made the folder? Type their invite code here. A trip with only you says Flying Solo until a friend joins.",
        selector: "[data-guide='join-trip']",
      },
      {
        title: "Open a trip",
        body: "Tap any trip to open its own page: where you're going city by city, the shared timeline, who's invited, the budget, Béa's planner, things to do, and packing. Everything about one trip lives there rather than unfolding here.",
        selector: "[data-guide='trip-list']",
      },
      {
        title: "Trip documents",
        body: "Reservations, tickets, and confirmations for the trip — encrypted on your device and locked behind a passcode.",
        selector: "[data-guide='document-vault']",
      },
    ],
  },
  "/trips/$tripId": {
    name: "Inside a trip",
    steps: [
      {
        title: "Let Béa plan",
        body: "The sparkle is Béa's planner, not the page tour. It can build a plan, import one, rearrange the stops you already have, or compare two drafts. Costs are optional. After a draft you can ask for alternatives or rebuild the trip. Béa does not book or check availability — you reserve hotels, tables and tickets yourself.",
        selector: "[data-guide='bea-plan']",
      },
      {
        title: "Where you're going",
        body: "City by city, with arrive and depart dates. Stops feed the timeline, the directions and the map, so filling this in once saves you doing it three times.",
        selector: "[data-guide='trip-stops']",
      },
      {
        title: "Add a stop quickly",
        body: "The pin icon adds a city or stopover without scrolling to the section. From saved pulls one out of your recommendation vault instead, keeping its address and map pin.",
        selector: "[data-guide='add-stop']",
      },
      {
        title: "The shared timeline",
        body: "Day by day, and live: anyone invited sees the same plan as you edit it. After Get directions you can add those legs straight to the timeline. Turn-by-turn is kept on this phone only if you download it in trip settings.",
        selector: "[data-guide='trip-timeline']",
      },
      {
        title: "Optimize the timeline",
        body: "Once a trip has a couple of stops, Optimize asks Béa to reshuffle them — closest together, rainy-day indoor, easy mornings, a rest day, even pace, or meals first. You approve the new order before it saves.",
        selector: "[data-guide='optimize-trip']",
      },
      {
        title: "Before you go",
        body: "The checklist icon opens everything still to be done before you leave, in two views. To do holds the errands — renew the passport, book the transfer, tell the bank. Packing holds the list; add a copy of a pack you saved under You, then tick things off.",
        selector: "[data-guide='trip-prep']",
      },
    ],
  },
  "/recommendations": {
    name: "Recommendation vault",
    steps: [
      {
        title: "Find anything you've saved",
        body: "Search by the place, the city, or the person who told you about it. A typo or a missing accent still finds a match.",
        selector: "[data-guide='reco-search']",
      },
      {
        title: "Filter by city",
        body: "These chips are cities from your saved recs — not pins. Tap one to see every restaurant, hotel or spot there.",
        selector: "[data-guide='reco-places']",
      },
      {
        title: "Filter by kind",
        body: "These chips filter by category — restaurants, bars, hotels, whatever you've been tagging.",
        selector: "[data-guide='reco-categories']",
      },
      {
        title: "Pin something nearby",
        body: "Open the map of where you are and drop a pin on a suggested place, or tap anywhere to save that exact spot.",
        selector: "[data-guide='pin-nearby']",
      },
      {
        title: "Ways to save something",
        body: "Paste a link, search the web, pin where you are, type it in, or paste a list — names from your notes, or a page of things to do. Béa reads the suggestions, looks each one up, and you can edit them before anything is saved. She guesses travel tags so she can pick them when you ask her to plan.",
        selector: "[data-guide='reco-add']",
      },
      {
        title: "Pick the exact spot",
        body: "On the details card, search a place or address and tap the right result. Use this when Béa missed the pin, or when you typed a rec by hand. Near and trip directions need that spot.",
        selector: "[data-guide='reco-location']",
      },
      {
        title: "Share places with someone",
        body: "Tick a few saved places and Béa makes a code you can send. Whoever opens it keeps the ones they want, with your name on them. They never see the rest of your vault, and your own notes stay private unless you tick the box.",
        selector: "[data-guide='reco-share']",
      },
      {
        title: "Your vault",
        body: "Everything saved, newest first, with who recommended it, the note you left, and the travel tags Béa guessed. Tap Remove to let one go.",
        selector: "[data-guide='reco-list']",
      },
    ],
  },
  "/help": {
    name: "Help",
    steps: [
      {
        title: "Welcome to Béa",
        body: "A conversation, not a manual — start here, then open any question. Ask Béa (the page sparkle) still walks the screen you're on.",
        selector: "[data-guide='help-faq']",
      },
    ],
  },
  "/profile": {
    name: "You",
    steps: [
      {
        title: "Your account",
        body: "Sign in here to keep everything synced across your phone and laptop.",
        selector: "[data-guide='profile-account']",
      },
      {
        title: "Your travel preferences",
        body: "Open Profile settings for your name, home city, travel style, and the appearance switch — warm cream by day, black and light grey at night. Those preferences are what Béa plans with. Customize home lives in here too.",
        selector: "[data-guide='profile-settings']",
      },
      {
        title: "Replay the full tour",
        body: "The story walk and the Deep Dive live here. Sample travel data is a separate button under Your account — Béa will not load either until you ask.",
        selector: "[data-guide='replay-tour']",
      },
      {
        title: "Customize home",
        body: "Hide the trip card, Waiting for you, or a Future Me note. Saved on this device.",
        selector: "[data-guide='home-customize']",
      },
      {
        title: "Packing lists",
        body: "Reusable templates — weekend, beach, ski, work. Attach a copy to a trip; ticking things off stays on that trip only.",
        selector: "[data-guide='packing-lists']",
      },
      {
        title: "What is kept on this phone",
        body: "Béa needs a connection to open, so nothing here is a no-signal app yet. What is kept locally: trip settings → Saved directions puts the walk or drive steps on this phone so you do not fetch them twice. This list shows which trips already have them.",
        selector: "[data-guide='offline-options']",
      },
      {
        title: "Legal and copyright",
        body: "Privacy policy, terms, and a note that Béa is Mathilde E. Larochelle's work. You keep what you save in it.",
        selector: "[data-guide='legal']",
      },
      {
        title: "Feedback",
        body: "This banner at the bottom is always yours. Pick a category — it broke, a missing stat, a wish, the map has opinions — then write it. If Béa dropped the ball, throw it back.",
        selector: "[data-guide='feedback']",
      },
    ],
  },
  "/preferences": {
    name: "Travel preferences",
    steps: [
      {
        title: "Travel style",
        body: "Comfort seeker, explorer, food led — pick as many as feel true. Let Béa plan reads these.",
        selector: "[data-guide='pref-style']",
      },
      {
        title: "Budget and currency",
        body: "How you like to spend, and which currency prices should speak.",
        selector: "[data-guide='pref-budget']",
      },
      {
        title: "Daily pace",
        body: "Slow, balanced, or full. Plan a day trip and Optimize both lean on this.",
        selector: "[data-guide='pref-pace']",
      },
      {
        title: "Countries you love",
        body: "Béa leans on these when she suggests where to go next.",
        selector: "[data-guide='pref-countries']",
      },
      {
        title: "Interests — travel tags",
        body: "The same tags that land on your recs. They weight Near and Let Béa plan.",
        selector: "[data-guide='pref-interests']",
      },
      {
        title: "Hard rules",
        body: "Food needs, allergies, mobility, anything you refuse. Béa will not plan around these.",
        selector: "[data-guide='pref-rules']",
      },
    ],
  },
  "/photos": {
    name: "Photos",
    steps: [
      {
        title: "Privacy first",
        body: "You'll see this note before every upload. Photos stay private to your account.",
        selector: "[data-guide='photo-privacy']",
      },
      {
        title: "What Béa keeps",
        body: "Keep the pictures on your city memory pages, or choose Locations only — Béa reads where each one was taken and stores nothing from the photo itself.",
        selector: "[data-guide='photo-keep']",
      },
    ],
  },
  "/memories": {
    name: "City memories",
    steps: [
      {
        title: "A page per city",
        body: "Photos are grouped by city and visit. Import more from Photos any time.",
        selector: "[data-guide='city-memories']",
      },
      {
        title: "Future Me notes",
        body: "Open a city and leave a note to your future self. Béa hands it back when you return.",
        selector: "[data-guide='future-me']",
      },
    ],
  },
  "/story": {
    name: "Travel story",
    steps: [
      {
        title: "Play it back",
        body: "The cities you've photographed, in the order you were there. Play, pause, or skip a stop. This is a story of places you already lived, not a new itinerary.",
        selector: "[data-guide='story-play']",
      },
    ],
  },
  "/calendar": {
    name: "Calendar",
    steps: [
      {
        title: "Every trip on one page",
        body: "Month by month: trips, flights, hotels and reservations from every timeline. Tap a day to see what's on it.",
        selector: "[data-guide='calendar-month']",
      },
    ],
  },
  "/expenses": {
    name: "Receipts",
    steps: [
      {
        title: "Photograph a receipt",
        body: "Béa can read the merchant and amount. Tag the trip so the spend lands on that budget. Fill it in by hand if the photo is unclear.",
        selector: "[data-guide='new-receipt']",
      },
      {
        title: "Send it to accounting",
        body: "Download a spreadsheet with every amount, date, category and its value in your home currency. Not tax advice, and not an official document.",
        selector: "[data-guide='expense-export']",
      },
    ],
  },
};

export function PageGuide() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<SpotlightBox | null>(null);

  const guide = useMemo(() => {
    const key = guideKeyForPath(pathname, Object.keys(guides));
    return key ? (guides[key] ?? null) : null;
  }, [pathname]);
  const steps = useMemo(
    () =>
      !guide || typeof document === "undefined"
        ? []
        : guide.steps.filter((candidate) => findGuideTarget(candidate.selector)),
    [guide, open],
  );
  const step = steps[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = findGuideTarget(step.selector);
    if (!el) {
      setBox(null);
      return;
    }
    setBox(measureGuideTarget(el));
  }, [step]);

  useEffect(() => {
    if (!open || !step) return;
    const el = findGuideTarget(step.selector);
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    const stopSettle = el
      ? trackGuideTargetSettle(el, setBox)
      : (() => {
          setBox(null);
          return () => undefined;
        })();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      stopSettle();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, i, step, measure]);

  useEffect(() => {
    setOpen(false);
    setI(0);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!guide) return null;

  if (!open) {
    return (
      <button
        onClick={() => {
          setI(0);
          setOpen(true);
        }}
        className="grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        aria-label={`Ask Béa about ${guide.name}`}
        title="Ask Béa"
      >
        <Sparkles className="size-3" />
      </button>
    );
  }

  if (!step) return null;

  const last = i === steps.length - 1;

  return (
    <>
      <button
        onClick={() => setOpen(false)}
        className="grid size-7 place-items-center rounded-full border border-primary bg-card text-primary"
        aria-label="Close Ask Béa"
        title="Close Ask Béa"
      >
        <Sparkles className="size-3" />
      </button>

      {createPortal(
        <div role="dialog" aria-label={`${guide.name} walkthrough`}>
          <SpotlightOverlay box={box} onDismiss={() => setOpen(false)}>
            <div className="w-full max-w-[420px] rounded-2xl border border-border bg-background p-3.5 shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="label-caps">
                  {guide.name} · {i + 1} of {steps.length}
                </p>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close walkthrough"
                  className="text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <h2 className="mt-1.5 font-display text-[20px] leading-tight">{step?.title}</h2>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">
                {step?.body}
              </p>
              {!box && (
                <p className="mt-1.5 text-[12px] italic text-muted-foreground">
                  This part isn't on screen right now.
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

              <div className="mt-3 flex gap-2">
                {i > 0 && (
                  <button
                    onClick={() => setI(i - 1)}
                    className="flex-1 rounded-xl border border-border px-4 py-2 text-[14.5px] font-semibold"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => (last ? setOpen(false) : setI(i + 1))}
                  className="flex-1 rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground"
                >
                  {last ? "Got it" : "Next"}
                </button>
              </div>
            </div>
          </SpotlightOverlay>
        </div>,
        document.body,
      )}
    </>
  );
}
