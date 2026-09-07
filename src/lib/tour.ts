export type TourMode = "quick" | "deep";

export type TourStep = {
  title: string;
  body: string;
  to?: string;
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
  if (to === "/" || to === "/help" || to === "/privacy" || to === "/terms") return false;
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
 * Seeded demo: Paris upcoming on Home; Lisbon density on World / Near / Recs.
 */
export const QUICK_STEPS: TourStep[] = [
  {
    title: "What is Béa?",
    body: "Béa remembers your travel life so Future You doesn't miss what matters. Skip anytime.",
  },
  {
    title: "Your Travel Brain",
    body: "Most people save ideas in Maps, screenshots, and texts. On the globe, visited, wishlist, recommendations, and next-time pins become one memory bank. Spin Lisbon.",
    to: "/world",
    selector: "[data-guide='globe']",
  },
  {
    title: "Never forget a tip",
    body: "That restaurant a friend mentioned months ago? Béa keeps who told you, the note, and travel tags — searchable and ready for a trip. Lisbon samples are in.",
    to: "/recommendations",
    selector: "[data-guide='reco-list']",
  },
  {
    title: "Where next?",
    body: "Most apps invent a list for Paris. Béa asks: of the places you already care about, which one should you do next? Open Help me choose.",
    to: "/world",
    selector: "[data-guide='compare-pins']",
  },
  {
    title: "Ideas become trips",
    body: "Most apps help after you've decided. Béa builds from what you already saved — Let Béa plan, Optimize, Compare. Open Paris in spring.",
    to: "/",
    selector: "[data-guide='home-trip']",
    awaitClick: true,
    actionHint: "Tap your Paris trip, then Next",
  },
  {
    title: "Opportunity mode",
    body: "You're near something Future You wanted. Near ranks your own saves by distance and why they matter right now. Demo as Lisbon.",
    to: "/opportunities",
    selector: "[data-guide='demo-city-lisbon']",
    awaitClick: true,
    actionHint: "Tap Lisbon, then Next",
  },
  {
    title: "Your travel story",
    body: "Every trip becomes history — Travel story playback and City memories. Remember → choose → plan → opportunity → story. Deep Dive from You covers the six pillars.",
    to: "/",
    selector: "[data-guide='home-story']",
    awaitClick: true,
    actionHint: "Tap Travel story, then Next",
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
    selector: "[data-guide='globe']",
  },
  {
    title: "Your vault on the globe",
    body: "Visited, next time, wishlist, and recommendation pins. Filter chips calm a busy map. This is one memory bank for everywhere you've saved.",
    to: "/world",
    selector: "[data-guide='pin-filters']",
  },
  {
    title: "Travel statistics",
    body: "Countries, cities, trips, and days — choose which counters to show. Your history feels alive, not buried in folders.",
    to: "/world",
    selector: "[data-guide='travel-stats']",
  },
  {
    title: "Photos become places",
    body: "Import pictures; Béa reads where they were taken, builds city memories, and can drop a pin. Privacy note before every upload.",
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
    body: "Leave a note for next time — a rooftop, a warning, a bakery. Béa hands it back when you open that city again.",
    to: "/memories",
    selector: "[data-guide='future-me']",
  },
  {
    title: "Travel story playback",
    body: "Playback walks cities in the order you were there — Montreal → Paris → Lisbon — with photos changing. Your story, not a new itinerary.",
    to: "/story",
    selector: "[data-guide='story-play']",
  },

  // —— Pillar 2: The Recommendation Vault ——
  {
    title: "Pillar 2 — Recommendations",
    body: "\"You HAVE to try that place in Lisbon\" usually disappears. Béa treats recommendations like assets — who, note, tags, city — not bookmarks.",
    to: "/recommendations",
    selector: "[data-guide='reco-list']",
  },
  {
    title: "Who, note, tags",
    body: "Save who suggested it, what they said, and travel tags Béa guesses. Later you find it instantly — or Near surfaces it for you.",
    to: "/recommendations",
    selector: "[data-guide='reco-list']",
  },
  {
    title: "Ways to capture a tip",
    body: "Paste a Maps or Yelp link, search the web, pin nearby, I'm here now, type by hand, or paste a whole list. You review before it saves.",
    to: "/recommendations",
    selector: "[data-guide='reco-add']",
  },
  {
    title: "Search your vault",
    body: "Search by place, city, or who told you. Typos and missing accents still match. City and kind chips filter the shelf.",
    to: "/recommendations",
    selector: "[data-guide='reco-search']",
  },

  // —— Pillar 3: Decision Support ——
  {
    title: "Pillar 3 — Decide",
    body: "Most apps answer \"What should I do in Paris?\" Béa answers: of the places you already care about, which one next?",
    to: "/world",
    selector: "[data-guide='compare-pins']",
  },
  {
    title: "Help me choose",
    body: "Tick two to five saved places, say what matters, and Béa ranks them with reasons — a recommendation engine on your own travel life.",
    to: "/world",
    selector: "[data-guide='compare-pins']",
  },

  // —— Pillar 4: Opportunity Engine ——
  {
    title: "Pillar 4 — Opportunities",
    body: "You saved a restaurant, a museum, a hike months ago. Near says you're 900m from something Future You wanted.",
    to: "/opportunities",
    selector: "[data-guide='near-list']",
  },
  {
    title: "Near — your saves, ranked",
    body: "Share location or demo a city. Distance and preference score bring forgotten intentions back as experiences. Snooze when it's not the moment.",
    to: "/opportunities",
    selector: "[data-guide='location-card']",
  },
  {
    title: "Day trip from your vault",
    body: "Tick nearby saves, pick today's pace, Arrange with Béa, then save as a day-trip — still starting from places you already kept.",
    to: "/opportunities",
    selector: "[data-guide='day-trip']",
  },

  // —— Pillar 5: Planning Without a Blank Page ——
  {
    title: "Pillar 5 — Plan from you",
    body: "Most planners open a blank page. Béa starts with your saved places, preferences, recommendations, and travel style.",
    to: "/preferences",
    selector: "[data-guide='pref-style']",
  },
  {
    title: "Let Béa plan",
    body: "On a trip, build a day-by-day plan from prefs and tagged recs — or import a photo or pasted itinerary. You're never starting from scratch.",
    to: "/trips",
    selector: "[data-guide='bea-plan']",
  },
  {
    title: "Optimize",
    body: "Reshuffle stops you already have — closest together, rainy-day indoor, easy mornings, rest day, even pace, meals first. You approve before it saves.",
    to: "/trips",
    selector: "[data-guide='optimize-trip']",
  },
  {
    title: "Compare drafts",
    body: "Still deciding? Compare two plan drafts side by side — metrics and a clear pick grounded in how you travel.",
    to: "/trips",
    selector: "[data-guide='bea-plan']",
  },

  // —— Pillar 6: Travel Operating System ——
  {
    title: "Pillar 6 — One system",
    body: "Map → recommendations → decisions → trips → photos → memories → the next opportunity. Most apps solve one problem; Béa connects them.",
    to: "/",
    selector: "[data-guide='home-shortcuts']",
  },
  {
    title: "Ask Béa anytime",
    body: "The page sparkle explains the screen you're on. Let Béa plan is the trip sparkle. Same companion, different jobs.",
    to: "/help",
    selector: "[data-guide='help-faq']",
  },
  {
    title: "You're all set",
    body: "Three things to remember: save tips from anyone, get nudged when you're near them, and keep a searchable travel history. Replay from You anytime.",
    to: "/",
  },
];

const QUICK_TOUR = withAuthFlags(QUICK_STEPS);
const DEEP_TOUR = withAuthFlags(DEEP_STEPS);

/** Stable arrays — new objects every call would re-trigger Tour effects and freeze the app. */
export function tourSteps(mode: TourMode): TourStep[] {
  return mode === "deep" ? DEEP_TOUR : QUICK_TOUR;
}
