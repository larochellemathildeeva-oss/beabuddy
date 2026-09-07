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
 * First-run walk — one product loop on seeded data, not a feature table of contents.
 * Starts immediately (no chooser). Replay from You can still pick this or Deep Dive.
 *
 * Loop: save → globe → trip → near → you.
 * Home shows Paris in spring (upcoming); Lisbon is past + Near demo density.
 */
export const QUICK_STEPS: TourStep[] = [
  {
    title: "Welcome",
    body: "Your vault already has sample places and trips. We'll walk the loop Béa is for — Skip anytime.",
  },
  {
    title: "A place someone told you about",
    body: "Recs is the shelf. Sample Lisbon spots are here — tap an Add option to open the form (nothing is saved yet).",
    to: "/recommendations",
    selector: "[data-guide='reco-add']",
    awaitClick: true,
    actionHint: "Tap an Add option, then Next",
  },
  {
    title: "On the globe",
    body: "Your saved spots become pins. Spin the globe — Lisbon is the dense cluster.",
    to: "/world",
    selector: "[data-guide='globe']",
  },
  {
    title: "On a trip",
    body: "That's Paris in spring at the top of Home. Trips hold the day-by-day plan.",
    to: "/",
    selector: "[data-guide='home-trip']",
    awaitClick: true,
    actionHint: "Tap your Paris trip, then Next",
  },
  {
    title: "When you're nearby",
    body: "Near ranks your saves by distance. No GPS? Pretend you're in Lisbon.",
    to: "/opportunities",
    selector: "[data-guide='demo-city-lisbon']",
    awaitClick: true,
    actionHint: "Tap Lisbon, then Next",
  },
  {
    title: "You",
    body: "Preferences, packing, and Replay live here. Want every cupboard? Replay and pick Deep Dive.",
    to: "/profile",
    selector: "[data-guide='profile-account']",
  },
  {
    title: "You're all set",
    body: "Save → globe → trip → near. Ask Béa explains any page. Feedback is on You if something's missing.",
    to: "/",
  },
];

/** Every feature, explained. Offered on Replay from You — not on first sign-in. */
export const DEEP_STEPS: TourStep[] = [
  {
    title: "Welcome — the long way",
    body: "This is the Deep Dive through every cupboard. Nothing is booked. Skip anytime, or Back to pick the short walk.",
  },
  {
    title: "Home — the trip card",
    body: "Your current or next trip sits at the top with dates and the first few plan items. Tap the card to open the folder.",
    to: "/",
    selector: "[data-guide='home-trip']",
  },
  {
    title: "Home — story and memories",
    body: "Travel story plays city by city; City memories gathers photos and pins. Waiting for you and Recent memories sit further down.",
    to: "/",
    selector: "[data-guide='home-shortcuts']",
  },
  {
    title: "Customize Home",
    body: "On You → Profile settings, Customize home hides the trip card, shortcuts, Waiting for you, Recent memories, or a Future Me note.",
    to: "/profile",
    selector: "[data-guide='home-customize']",
  },
  {
    title: "World — the globe",
    body: "Drag to spin, pinch or scroll to zoom. Pins: blue visited, green next time, yellow wishlist, purple recommendation.",
    to: "/world",
    selector: "[data-guide='globe']",
  },
  {
    title: "World — pin filters",
    body: "The chips above the globe hide and show whole groups of pins when the map gets busy.",
    to: "/world",
    selector: "[data-guide='pin-filters']",
  },
  {
    title: "Help me choose",
    body: "Tick two to five saved places, say what matters, and Béa ranks what you already saved — she does not invent cities.",
    to: "/world",
    selector: "[data-guide='compare-pins']",
  },
  {
    title: "Travel statistics",
    body: "Open Travel statistics for countries, cities, trips and pins. Choose which counters to show; ask on You → Feedback for new ones.",
    to: "/world",
    selector: "[data-guide='travel-stats']",
  },
  {
    title: "Heatmap",
    body: "Switch the heatmap on for time as a warm cloud. Toggle days (how long you stayed) or photos (how many you imported).",
    to: "/world",
    selector: "[data-guide='heatmap']",
  },
  {
    title: "Add a city by hand",
    body: "Type a city or country, or paste a list. Countries recognise straight away; other names are looked up before they save.",
    to: "/world",
    selector: "[data-guide='add-city']",
  },
  {
    title: "The recommendation vault",
    body: "Recs holds places people told you about — newest first, with who recommended them and the tags Béa guessed.",
    to: "/recommendations",
    selector: "[data-guide='reco-list']",
  },
  {
    title: "Search and chips",
    body: "Search by place, city, or who told you. Typos and missing accents still match. City and kind chips filter the shelf.",
    to: "/recommendations",
    selector: "[data-guide='reco-search']",
  },
  {
    title: "Ways to save a place",
    body: "Paste a link, search the web, pin nearby, I'm here now, type by hand, or paste a list. You edit before anything saves.",
    to: "/recommendations",
    selector: "[data-guide='reco-add']",
  },
  {
    title: "Travel tags",
    body: "Béa guesses tags like Museums or Coffee shops so Let Béa plan and day trips can match how you travel.",
    to: "/recommendations",
    selector: "[data-guide='reco-list']",
  },
  {
    title: "Start a trip",
    body: "Name it, search the starting city, optional dates (Tentative or Confirmed), and tick a budget only if you want one.",
    to: "/trips",
    selector: "[data-guide='new-trip']",
  },
  {
    title: "Flying Solo and invite codes",
    body: "Alone it says Flying Solo. Share an invite code so friends can edit the timeline. Join with a code accepts theirs.",
    to: "/trips",
    selector: "[data-guide='join-trip']",
  },
  {
    title: "Cities, stops and layovers",
    body: "Where you're going lists cities with arrival and leaving dates. Mark a layover when you're only changing planes.",
    to: "/trips",
    selector: "[data-guide='trip-list']",
  },
  {
    title: "The shared timeline",
    body: "The day-by-day plan — meals, walks, free hours. Everyone on the trip can add. Nothing here is a reservation.",
    to: "/trips",
    selector: "[data-guide='trip-list']",
  },
  {
    title: "Let Béa plan — build or import",
    body: "The trip sparkle builds a plan from preferences and tagged recs, or imports a photo or pasted itinerary.",
    to: "/trips",
    selector: "[data-guide='bea-plan']",
  },
  {
    title: "Costs, alternatives and rebuild",
    body: "Costs stay off unless you ask. Swap selected stops or rebuild the draft. Béa does not book or check availability.",
    to: "/trips",
    selector: "[data-guide='bea-plan']",
  },
  {
    title: "Optimize",
    body: "Reshuffle stops you already have — closest together, rainy-day indoor, easy mornings, and more. You approve before it saves.",
    to: "/trips",
    selector: "[data-guide='optimize-trip']",
  },
  {
    title: "Get directions",
    body: "Get walking or driving between cities, then add legs to the timeline. Offline turn-by-turn needs a trip download.",
    to: "/trips",
    selector: "[data-guide='trip-list']",
  },
  {
    title: "Packing lists on a trip",
    body: "The paper icon attaches a copy of a saved list. Build reusable templates under You → Create packing lists.",
    to: "/trips",
    selector: "[data-guide='packing-lists']",
  },
  {
    title: "Trip settings",
    body: "Turn budget on or off, download offline directions, or delete the trip (timeline, stops, invites go with it).",
    to: "/trips",
    selector: "[data-guide='trip-list']",
  },
  {
    title: "The document vault",
    body: "Passports and boarding passes are scrambled on your device, then locked behind a passcode or fingerprint.",
    to: "/trips",
    selector: "[data-guide='document-vault']",
  },
  {
    title: "Budgets",
    body: "When a budget is on, add planned spend and watch live totals. Claimed receipts update the trip across devices.",
    to: "/trips",
  },
  {
    title: "Calendar",
    body: "Every trip and plan by date — overlapping holidays and a work week in another city on one page.",
    to: "/calendar",
    selector: "[data-guide='calendar-month']",
  },
  {
    title: "Near me — location rules",
    body: "Béa asks before using location. Choose once, an hour, today, or until you turn it off — no background watch by default.",
    to: "/opportunities",
    selector: "[data-guide='location-card']",
  },
  {
    title: "How close, how often, snooze",
    body: "Set distance and nudge frequency. Snooze a place for now. Saves rank from right here to a day trip away.",
    to: "/opportunities",
    selector: "[data-guide='alert-settings']",
  },
  {
    title: "Plan a day trip",
    body: "Tick nearby recs, pick today's pace, Arrange with Béa, then save as a day-trip. Nothing is booked.",
    to: "/opportunities",
    selector: "[data-guide='day-trip']",
  },
  {
    title: "Photos become memories",
    body: "Import pictures; Béa reads embedded location, builds city memories, and can drop a pin. Privacy note before every upload.",
    to: "/photos",
    selector: "[data-guide='photo-privacy']",
  },
  {
    title: "City memories and Future Me",
    body: "Each city gets a memory page. Leave a note to your future self — Béa hands it back when you return.",
    to: "/memories",
    selector: "[data-guide='city-memories']",
  },
  {
    title: "Travel story",
    body: "Playback walks cities in the order you were there. A story of places you lived — not a new itinerary.",
    to: "/story",
    selector: "[data-guide='story-play']",
  },
  {
    title: "Receipts and expenses",
    body: "Photograph receipts, tag the trip, export a spreadsheet. Multi-currency totals use today's live rates.",
    to: "/expenses",
    selector: "[data-guide='new-receipt']",
  },
  {
    title: "You — the account",
    body: "Sign in so pins, trips, and photos follow you. Packing lists, offline options, legal, and Help live here too.",
    to: "/profile",
    selector: "[data-guide='profile-account']",
  },
  {
    title: "Travel preferences",
    body: "Style, budget, pace, interests, and dietary notes feed Let Béa plan, Optimize, and day trips.",
    to: "/preferences",
    selector: "[data-guide='pref-style']",
  },
  {
    title: "Light, dark and packing",
    body: "Appearance lives in Profile settings. Create packing lists on You, then attach a copy to a trip.",
    to: "/profile",
    selector: "[data-guide='packing-lists']",
  },
  {
    title: "Offline options",
    body: "Maps and the vault still need a connection. Trip settings → Offline directions keeps walk/drive steps on this phone.",
    to: "/profile",
    selector: "[data-guide='offline-options']",
  },
  {
    title: "Legal and copyright",
    body: "You → Legal holds privacy, terms, and that Béa is Mathilde E. Larochelle's work. You keep what you save.",
    to: "/profile",
    selector: "[data-guide='legal']",
  },
  {
    title: "Help, and Ask Béa",
    body: "Help & FAQ answers the usual questions. Ask Béa is the page sparkle; Let Béa plan is the trip sparkle.",
    to: "/help",
    selector: "[data-guide='help-faq']",
  },
  {
    title: "Tell Béa something",
    body: "You → Feedback: pick a category and write it. If Béa dropped the ball, this is where you throw it back.",
    to: "/profile",
    selector: "[data-guide='feedback']",
  },
  {
    title: "You're all set",
    body: "Replay from You anytime for the quick walk or this Deep Dive. Ask Béa and Feedback stay on every visit.",
    to: "/",
  },
];

export function tourSteps(mode: TourMode): TourStep[] {
  return withAuthFlags(mode === "deep" ? DEEP_STEPS : QUICK_STEPS);
}
