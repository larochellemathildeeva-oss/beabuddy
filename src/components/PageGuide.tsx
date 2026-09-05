import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";

type GuideStep = {
  title: string;
  body: string;
  /** CSS selector for the element to highlight. */
  selector?: string;
};

type Guide = { name: string; steps: GuideStep[] };

const navStep = (to: string, label: string, body: string): GuideStep => ({
  title: label,
  body,
  selector: `nav a[href="${to}"]`,
});

const guides: Record<string, Guide> = {
  "/": {
    name: "Home",
    steps: [
      {
        title: "Your trip right now",
        body: "The trip you're on, or the next one coming, sits here with its dates and the first few things on the plan. Tap it to open the whole folder.",
        selector: "[data-guide='home-trip']",
      },
      navStep("/world", "The map", "Every pin you've ever saved lives on the World map."),
      navStep("/trips", "Trips", "Plans, packing, budgets and documents, one folder per trip."),
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
        body: "Open this to see your counters — countries, cities, saved places and photos — adding themselves up as you travel.",
        selector: "[data-guide='travel-stats']",
      },
      {
        title: "Heatmap",
        body: "Switch this on to see where you've spent the most time, as a warm cloud instead of dots.",
        selector: "[data-guide='heatmap']",
      },
    ],
  },
  "/trips": {
    name: "Trips",
    steps: [
      {
        title: "Start a trip",
        body: "Name it, search the starting city — the country fills itself in — and tick a budget if you want one.",
        selector: "[data-guide='new-trip']",
      },
      {
        title: "Inside a trip",
        body: "Tap any trip to open it: where you're going city by city, the shared timeline, who's invited, the budget and offline directions.",
        selector: "[data-guide='trip-list']",
      },
      {
        title: "Packing lists",
        body: "Build reusable packs — weekend, beach, ski, work — and tick items off as you fill the bag.",
        selector: "[data-guide='packing-lists']",
      },
      {
        title: "Document vault",
        body: "Passports, visas and boarding passes, scrambled on your own device and locked behind a passcode.",
        selector: "[data-guide='document-vault']",
      },
    ],
  },
  "/recommendations": {
    name: "Recommendation vault",
    steps: [
      {
        title: "Find anything you've saved",
        body: "Search by the place, the city, or the person who told you about it.",
        selector: "[data-guide='reco-search']",
      },
      {
        title: "Narrow it down",
        body: "These chips filter by kind — restaurants, bars, hotels, whatever you've been tagging.",
        selector: "[data-guide='reco-categories']",
      },
      {
        title: "Four ways to save something",
        body: "Paste a link and Béa reads the name and address out of it, search the web by name, tap 'I'm here now' to pin where you're standing, or type it in by hand.",
        selector: "[data-guide='reco-add']",
      },
      {
        title: "Your vault",
        body: "Everything saved, newest first, with who recommended it and the note you left. Tap Remove to let one go.",
        selector: "[data-guide='reco-list']",
      },
    ],
  },
  "/opportunities": {
    name: "Near me",
    steps: [
      {
        title: "Your location, your rules",
        body: "Béa only looks when you say so, and you pick how long — just once, an hour, today, or until you switch it off.",
        selector: "[data-guide='location-card']",
      },
      {
        title: "How close counts as near",
        body: "Set the distance that earns a nudge, and how often you want to hear from Béa.",
        selector: "[data-guide='alert-settings']",
      },
      {
        title: "What's around you",
        body: "Everything you've saved, sorted by how far away it is right now, with directions one tap away.",
        selector: "[data-guide='near-list']",
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
        body: "Open Profile settings to add the interests, pace, food, budget and travel style Béa should use when advising you.",
        selector: "[data-guide='profile-settings']",
      },
      {
        title: "Replay the full tour",
        body: "The whole walkthrough of Béa lives here, any time you want it again.",
        selector: "[data-guide='replay-tour']",
      },
    ],
  },
};

function findTarget(step: GuideStep): HTMLElement | null {
  if (step.selector) {
    const el = document.querySelector<HTMLElement>(step.selector);
    if (el) return el;
  }
  return null;
}

type Box = { top: number; left: number; width: number; height: number };

export function PageGuide() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  const guide = useMemo(() => guides[pathname] ?? null, [pathname]);
  const steps = useMemo(
    () =>
      !guide || typeof document === "undefined"
        ? []
        : guide.steps.filter((candidate) => findTarget(candidate)),
    [guide, open],
  );
  const step = steps[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step);
    if (!el) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
  }, [step]);

  useEffect(() => {
    if (!open || !step) return;
    const el = findTarget(step);
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    const frame = window.requestAnimationFrame(measure);
    const observer = el ? new ResizeObserver(measure) : null;
    if (el) observer?.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
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
  const belowTarget = box ? box.top + box.height < window.innerHeight * 0.55 : true;

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
        <div
          role="dialog"
          aria-label={`${guide.name} walkthrough`}
          className="pointer-events-none fixed inset-0 z-[60]"
        >
        {box ? (
          <>
            <div
              className="pointer-events-auto absolute bg-black/55"
              style={{ top: 0, left: 0, right: 0, height: Math.max(box.top, 0) }}
              onClick={() => setOpen(false)}
            />
            <div
              className="pointer-events-auto absolute bg-black/55"
              style={{ top: box.top + box.height, left: 0, right: 0, bottom: 0 }}
              onClick={() => setOpen(false)}
            />
            <div
              className="pointer-events-auto absolute bg-black/55"
              style={{ top: box.top, left: 0, width: Math.max(box.left, 0), height: box.height }}
              onClick={() => setOpen(false)}
            />
            <div
              className="pointer-events-auto absolute bg-black/55"
              style={{ top: box.top, left: box.left + box.width, right: 0, height: box.height }}
              onClick={() => setOpen(false)}
            />
            <div
              className="absolute rounded-2xl ring-2 ring-primary transition-all duration-300"
              style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
            />
          </>
        ) : (
          <div className="pointer-events-auto absolute inset-0 bg-black/55" onClick={() => setOpen(false)} />
        )}

        <div
          className="pointer-events-auto absolute inset-x-0 flex justify-center px-4"
          style={belowTarget ? { top: (box ? box.top + box.height : 0) + 14 } : { bottom: 90 }}
        >
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
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step?.body}</p>
            {!box && (
              <p className="mt-1.5 text-[11px] italic text-muted-foreground">
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
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold"
                >
                  Back
                </button>
              )}
              <button
                onClick={() => (last ? setOpen(false) : setI(i + 1))}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                {last ? "Got it" : "Next"}
              </button>
            </div>
          </div>
          </div>
        </div>,

        document.body,
      )}
    </>
  );
}
