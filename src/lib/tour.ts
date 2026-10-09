export type TourMode = "quick" | "plan" | "import" | "save" | "on-trip" | "map";

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
   * Shown instead when `selector` is not on screen: a fresh account has no
   * saves, so Near and Help me choose are not drawn at all, and the step
   * dimmed the whole page over nothing.
   */
  fallback?: string;
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
 * Thread: Béa turns saved ideas into real trips and helps on the way, then
 * remembers your travel life and helps you choose what to do next. Planning
 * comes straight after the welcome — it is what a new traveller came for.
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
    body: "Béa turns the places you saved into a real trip, then helps every day you're on it — and remembers your travel life so Future You doesn't miss what matters. Skip anytime.",
  },
  {
    title: "Ideas become trips",
    body: "Each trip holds its days, stops, bookings and to-dos. Plan with Béa drafts the days from places you saved, or reads a plan you have. On the road she gives directions you can keep offline. You approve every change.",
    to: "/trips",
    selector: "[data-guide='plan-with-bea']",
  },
  {
    title: "Never forget a tip",
    body: "That restaurant a friend mentioned months ago? Béa keeps who told you, the note and travel tags — a recommendation you can find again and plan with.",
    to: "/recommendations",
    selector: "[data-guide='reco-list']",
  },
  {
    title: "Near something you saved",
    body: "Share your location and Home shows your own saves within reach, nearest first. Tick a few and Béa arranges a day trip around them.",
    to: "/",
    selector: "[data-guide='home-near']",
    fallback: "[data-guide='home-empty']",
  },
  {
    title: "Where next?",
    body: "Most apps invent a list for you. Béa asks: of the places you already care about, which one next? On Bucket list, Help me choose weighs two to five of them.",
    to: "/world",
    search: { tab: "bucket" },
    selector: "[data-guide='compare-pins']",
    fallback: "[data-guide='bucket-list']",
  },
  {
    title: "Your travel map",
    body: "Everywhere you've been, on one map: the countries you've been to, shaded, and a dot for each city. Globe controls and geography, below it, opens the globe to spin. Add places fills in more.",
    to: "/world",
    search: { tab: "map" },
    selector: "[data-guide='globe']",
  },
  {
    title: "Your travel story",
    body: "Every trip becomes part of your memory: Been there lists each place, Stats counts them. Help has a step-by-step walk for each thing Béa does.",
    to: "/world",
    search: { tab: "been" },
    selector: "[data-guide='world-tabs']",
  },
];

/**
 * Walks that each teach one thing a traveller came to do, start to finish,
 * on the real screens. They replace the old "six pillars" Deep Dive, which
 * described Béa against its competitors instead of showing how to use it.
 *
 * Every step names only what a fresh account can see too, or carries a
 * `fallback` that one has (`tour.test.ts` checks).
 */
export type WalkId = "plan" | "import" | "save" | "on-trip" | "map";

export type Walk = {
  id: WalkId;
  /** "Show me how to…" finishes with this. */
  title: string;
  /** One line under the title in the chooser and in Help. */
  hint: string;
  steps: TourStep[];
};

export const WALKS: Walk[] = [
  {
    id: "plan",
    title: "Plan a trip",
    hint: "From your saved places to a day-by-day plan.",
    steps: [
      {
        title: "Start with Plan with Béa",
        body: "Everything starts here, at the top of Trips. Tell Béa where and when; she drafts the days from the places you saved and how you like to travel.",
        to: "/trips",
        selector: "[data-guide='plan-with-bea']",
      },
      {
        title: "Build my trip",
        body: "Build my trip drafts the days. The other cards read a plan you already have, put a trip's stops in a better order, or compare two plans. Nothing saves until you approve it.",
        to: "/trips/plan",
        selector: "[data-guide='plan-cards']",
      },
      {
        title: "Say it your way",
        body: "A pace, a budget, who is coming, what to skip. Béa takes it into the draft. Not sure what to ask? The examples start one for you.",
        to: "/trips/plan",
        selector: "[data-guide='plan-ask']",
        fallback: "[data-guide='plan-examples']",
      },
      {
        title: "Teach her how you travel",
        body: "Style, budget and pace live in Travel preferences. Béa reads them every time she plans, so set them once.",
        to: "/preferences",
        selector: "[data-guide='pref-style']",
      },
      {
        title: "Or start one yourself",
        body: "The + starts an empty trip: a name, a city, dates if you know them. Add stops as you go, and ask Béa to tidy the order later.",
        to: "/trips",
        selector: "[data-guide='new-trip']",
      },
    ],
  },
  {
    id: "import",
    title: "Bring in a plan you already have",
    hint: "From a friend, a PDF, an email or another assistant.",
    steps: [
      {
        title: "Import a plan",
        body: "On Plan with Béa, Import a plan reads pasted text, a photo, a PDF or a calendar file and turns it into a trip, pinning each stop she can find.",
        to: "/trips/plan",
        selector: "[data-guide='plan-cards']",
      },
      {
        title: "Planning somewhere else?",
        body: "Plan a trip, in Help, has a prompt to copy into the assistant you use. It asks for the shape Béa reads best, so the plan comes in cleanly when you paste the answer back.",
        to: "/help",
        selector: "[data-guide='plan-prompt']",
      },
      {
        title: "Bookings too",
        body: "Confirmations and tickets go in Trip documents. Add a PDF or photo and Fill in from this file reads the dates and details for you.",
        to: "/trips",
        selector: "[data-guide='document-vault']",
      },
    ],
  },
  {
    id: "save",
    title: "Save places from friends",
    hint: "Keep every tip, with who told you, ready to plan with.",
    steps: [
      {
        title: "One field takes anything",
        body: "Type a name, or paste a Maps, Instagram or blog link. Béa finds the place; tap Save. Add who told you and why, so the tip keeps its story.",
        to: "/recommendations",
        selector: "[data-guide='reco-add']",
      },
      {
        title: "Find it again",
        body: "Search by place, city or who told you. Typos and missing accents still match.",
        to: "/recommendations",
        selector: "[data-guide='reco-search']",
      },
      {
        title: "Your saved places",
        body: "Everything you kept, grouped and on the map. When you plan a trip there, Béa starts from these.",
        to: "/recommendations",
        selector: "[data-guide='reco-list']",
      },
      {
        title: "Can't decide?",
        body: "Help me choose weighs two to five places you saved and says which fits you best, with its reasons.",
        to: "/world",
        search: { tab: "bucket" },
        selector: "[data-guide='compare-pins']",
        fallback: "[data-guide='bucket-list']",
      },
    ],
  },
  {
    id: "on-trip",
    title: "Use Béa on the trip",
    hint: "Today's plan, directions, bookings and what's nearby.",
    steps: [
      {
        title: "Home knows where you are in the trip",
        body: "The trip you're on sits at the top of Home, with the next stop. Shortcuts jump to the itinerary, to-dos and packing.",
        to: "/",
        selector: "[data-guide='home-trip']",
        fallback: "[data-guide='home-empty']",
      },
      {
        title: "Open the trip",
        body: "Inside a trip, Now follows the day with you and says when to leave. Map draws it, and Get directions walks or drives you there, the way you like to get around.",
        to: "/trips",
        selector: "[data-guide='trip-list']",
        fallback: "[data-guide='new-trip']",
      },
      {
        title: "Tickets at hand",
        body: "Bookings, tickets and confirmations, shared with everyone on the trip. Anything private goes in Protected, locked with your passcode.",
        to: "/trips",
        selector: "[data-guide='document-vault']",
      },
      {
        title: "No signal? Keep it offline",
        body: "In a trip's menu (•••), Offline maps keeps the plan, the directions and the map on this phone. Profile settings → Data & imports lists them.",
        to: "/profile",
        selector: "[data-guide='profile-settings']",
      },
      {
        title: "Saved places nearby",
        body: "Share your location and Home lists the places you saved within reach. Tick a few and Béa arranges a day trip.",
        to: "/",
        selector: "[data-guide='home-near']",
        fallback: "[data-guide='home-empty']",
      },
    ],
  },
  {
    id: "map",
    title: "Map where you've been",
    hint: "Your countries, cities and memories on one globe.",
    steps: [
      {
        title: "Your map",
        body: "Every country and city you've been to, shaded in. Globe controls and geography opens the globe to spin.",
        to: "/world",
        search: { tab: "map" },
        selector: "[data-guide='globe']",
      },
      {
        title: "Add places",
        body: "Add the cities and countries you've been to, one by one or as a list.",
        to: "/world",
        search: { tab: "map" },
        selector: "[data-guide='add-city']",
      },
      {
        title: "From your photos",
        body: "Import photos and Béa reads where they were taken. A privacy note comes before every upload, and you choose what is kept.",
        to: "/photos",
        selector: "[data-guide='photo-privacy']",
      },
      {
        title: "City memories",
        body: "Each city gets a page: your visits, photos, and notes you left for next time.",
        to: "/memories",
        selector: "[data-guide='city-memories']",
      },
    ],
  },
];

const QUICK_TOUR = withAuthFlags(QUICK_STEPS);
const WALK_TOURS = new Map<TourMode, TourStep[]>(
  WALKS.map((walk) => [walk.id, withAuthFlags(walk.steps)]),
);

export const TOUR_MODES: readonly TourMode[] = ["quick", ...WALKS.map((walk) => walk.id)];

export function isTourMode(value: unknown): value is TourMode {
  return typeof value === "string" && (TOUR_MODES as readonly string[]).includes(value);
}

/** The label the walk's sheet wears: "Around the block", or the walk's title. */
export function tourLabel(mode: TourMode): string {
  return mode === "quick"
    ? "Around the block"
    : (WALKS.find((walk) => walk.id === mode)?.title ?? "Show me");
}

/** Stable arrays — new objects every call would re-trigger Tour effects and freeze the app. */
export function tourSteps(mode: TourMode): TourStep[] {
  return mode === "quick" ? QUICK_TOUR : (WALK_TOURS.get(mode) ?? QUICK_TOUR);
}
