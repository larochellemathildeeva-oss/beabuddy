export type TourMode = "quick" | "deep";

export type TourStep = {
  title: string;
  body: string;
  to?: string;
  /** Search params for `to`. Near is a filter on the vault, not a route. */
  search?: Record<string, string>;
  /** Route only makes sense once signed in. Applied automatically for gated paths. */
  needsAuth?: boolean;
  /** CSS selector for the spotlight cutout (PageGuide `data-guide` targets). */
  selector?: string;
  /**
   * Traveller must click the highlighted control before Next unlocks.
   * Skip still works. Used for a few first-run “do something” beats.
   */
  awaitClick?: boolean;
  /**
   * Shown while awaiting the tap — include “then Next” so the unlock is obvious
   * on a phone (e.g. "Tap Lisbon, then Next").
   */
  actionHint?: string;
  /** Shown after the tap registers; defaults to "Got it — tap Next". */
  actionDoneHint?: string;
};

/**
 * Pages behind AppShell’s member gate. Home, Help, and legal stay readable
 * signed-out; everything else would bounce to /auth if the tour navigated.
 */
export function routeNeedsAuth(to?: string): boolean {
  if (!to) return false;
  if (
    to === "/" ||
    to === "/help" ||
    to === "/how-it-works" ||
    to === "/privacy" ||
    to === "/terms"
  )
    return false;
  return true;
}

function withAuthFlags(steps: TourStep[]): TourStep[] {
  return steps.map((step) => ({
    ...step,
    needsAuth: step.needsAuth ?? routeNeedsAuth(step.to),
  }));
}

/**
 * First-run “walk around the block” — story, not a feature TOC.
 *
 * Thread: Béa remembers your travel life, helps you choose what to do next,
 * and turns saved ideas into real trips.
 *
 * Every step names only what a fresh account can see too: the sample data is
 * opt-in, so no step promises Paris or Lisbon. Steps on World name the view
 * (`search.tab`) their control lives on — World opens on Map, and a step that
 * spotlights Bucket list without asking for it points at nothing.
 *
 * Planning is described by its entry point (Plan with Béa on a trip), never by
 * the planner's own tabs, which change more often than this walk does.
 */
export const QUICK_STEPS: TourStep[] = [
  {
    title: "What is Béa?",
    body: "Béa remembers your travel life so Future You doesn't miss what matters. This walk points at the real screens, one at a time. Skip anytime.",
  },
  {
    title: "Your travel globe",
    body: "Everywhere you've been, on one globe: the countries, their provinces or states, and a dot for each city. Drag to spin it. The + adds places by hand.",
    to: "/world",
    search: { tab: "map" },
    selector: "[data-guide='globe']",
  },
  {
    title: "Never forget a tip",
    body: "That restaurant a friend mentioned months ago? Béa keeps who told you, the note and travel tags — a recommendation you can find again and plan with.",
    to: "/recommendations",
    selector: "[data-guide='reco-list']",
  },
  {
    title: "Where next?",
    body: "Most apps invent a list for you. Béa asks: of the places you already care about, which one next? On Bucket list, Help me choose weighs two to five of them.",
    to: "/world",
    search: { tab: "bucket" },
    selector: "[data-guide='compare-pins']",
  },
  {
    title: "Ideas become trips",
    body: "Each trip is one folder: days, stops, bookings, to-dos. Open one and Plan with Béa drafts it from the places you already saved. Nothing changes until you approve.",
    to: "/trips",
    selector: "[data-guide='trip-list']",
  },
  {
    title: "Near something you saved",
    body: "Share your location and Home shows your own saves within reach, nearest first. Tick a few and Béa arranges a day trip around them.",
    to: "/",
    selector: "[data-guide='home-near']",
  },
  {
    title: "Your travel story",
    body: "Every trip becomes part of your memory: Been there lists each place, Stats counts them. Replay this walk, or the Deep Dive, from You → About Béa.",
    to: "/world",
    search: { tab: "been" },
    selector: "[data-guide='world-tabs']",
  },
];

/**
 * Deep Dive — what competitors miss, in six pillars. Replay from You only.
 * Supporting tools (budget, packing, vault, calendar) stay out of this walk.
 */
export const DEEP_STEPS: TourStep[] = [
  {
    title: "Deep Dive — six pillars",
    body: "This walk is the unique thread: memory, recommendations, decisions, opportunities, planning from your vault, and the connected system. Skip anytime.",
  },

  // —— Pillar 1: The Memory Layer ——
  {
    title: "Pillar 1 — Memory",
    body: "Most travel apps focus on planning. Béa focuses on remembering your travel life across years — not just one trip.",
    to: "/world",
    search: { tab: "map" },
    selector: "[data-guide='globe']",
  },
  {
    title: "Everywhere you've been",
    body: "Been there lists the countries, provinces and states you've visited, and your cities — in any language you saved them in. Tap a city and the globe spins to it.",
    to: "/world",
    search: { tab: "been" },
    selector: "[data-guide='places-list']",
  },
  {
    title: "Travel statistics",
    body: "Countries, cities, trips and pins — choose which counters to show. Your history feels alive, not buried in folders.",
    to: "/world",
    search: { tab: "stats" },
    selector: "[data-guide='travel-stats']",
  },
  {
    title: "Photos become places",
    body: "Import pictures from You → Data & imports. Béa reads where they were taken and builds city memories. A privacy note comes before every upload.",
    to: "/photos",
    selector: "[data-guide='photo-privacy']",
  },
  {
    title: "City memories",
    body: "Each city gets a page — visits years apart, photos, and spots you cared about. Competitors stop when the trip ends; Béa keeps going.",
    to: "/memories",
    selector: "[data-guide='city-memories']",
  },
  {
    title: "Future Me notes",
    body: "Open a city and leave a note for next time — a rooftop, a warning, a bakery. Béa hands it back when you return.",
    to: "/memories",
    selector: "[data-guide='future-me']",
  },
  {
    title: "Travel story playback",
    body: "From City memories, playback walks the cities in your photos in the order you were there. Your story, not a new itinerary.",
    to: "/story",
    selector: "[data-guide='story-play']",
  },

  // —— Pillar 2: The Recommendation Vault ——
  {
    title: "Pillar 2 — Recommendations",
    body: '"You HAVE to try that place in Lisbon" usually disappears. Béa treats recommendations like assets — who, note, tags, city — not bookmarks.',
    to: "/recommendations",
    selector: "[data-guide='reco-list']",
  },
  {
    title: "Ways to capture a tip",
    body: "Type a name or paste a map link in the field. The + at the top adds from your trips, where you are, by hand, or a pasted list. You review before it saves.",
    to: "/recommendations",
    selector: "[data-guide='reco-add']",
  },
  {
    title: "Search your vault",
    body: "The button beside the field opens everything you saved: search by place, city or who told you — typos and missing accents still match — then filter by City and Type.",
    to: "/recommendations",
    selector: "[data-guide='reco-search']",
  },

  // —— Pillar 3: Decision Support ——
  {
    title: "Pillar 3 — Help me choose",
    body: 'Most apps answer "What should I do in Paris?" Béa answers: of the places you already care about, which one next? Tick two to five and she ranks them, with reasons.',
    to: "/world",
    search: { tab: "bucket" },
    selector: "[data-guide='compare-pins']",
  },

  // —— Pillar 4: Opportunity Engine ——
  {
    title: "Pillar 4 — Opportunities",
    body: "You saved a restaurant, a museum, a hike months ago. Share your location and Home shows which of them are near you now. Snooze when it's not the moment.",
    to: "/",
    selector: "[data-guide='home-near']",
  },
  {
    title: "Day trip from your vault",
    body: "Tap Plan a day trip, tick nearby saves, pick a pace, Arrange with Béa, then save it as a trip — still starting from places you already kept.",
    to: "/",
    selector: "[data-guide='home-near']",
  },

  // —— Pillar 5: Planning Without a Blank Page ——
  {
    title: "Pillar 5 — Plan from you",
    body: "Most planners open a blank page. Béa starts with your saved places, preferences, recommendations and travel style — set them here.",
    to: "/preferences",
    selector: "[data-guide='pref-style']",
  },
  {
    title: "Plan with Béa",
    body: "Open a trip and tap Plan with Béa. She drafts days from what you saved, reads a plan you already have, can optimize the order or compare two drafts. You approve before anything saves.",
    to: "/trips",
    selector: "[data-guide='trip-list']",
  },

  // —— Pillar 6: Travel Operating System ——
  {
    title: "Pillar 6 — One system",
    body: "Map → recommendations → decisions → trips → photos → memories → the next opportunity. Most apps solve one problem; Béa connects them.",
    to: "/",
    selector: "[data-guide='home-near']",
  },
  {
    title: "Ask Béa anytime",
    body: "The sparkle at the top of each page explains the screen you're on. Plan with Béa, on a trip, is the planner. Same companion, different jobs.",
    to: "/help",
    selector: "[data-guide='help-faq']",
  },
  {
    title: "You're all set",
    body: "Three things to remember: save tips from anyone, see them when you're near, and keep a searchable travel history. Replay from You → About Béa anytime.",
    to: "/",
  },
];

const QUICK_TOUR = withAuthFlags(QUICK_STEPS);
const DEEP_TOUR = withAuthFlags(DEEP_STEPS);

/** Stable arrays — new objects every call would re-trigger Tour effects and freeze the app. */
export function tourSteps(mode: TourMode): TourStep[] {
  return mode === "deep" ? DEEP_TOUR : QUICK_TOUR;
}
