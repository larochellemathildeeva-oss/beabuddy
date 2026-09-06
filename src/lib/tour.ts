export type TourMode = "quick" | "deep";

export type TourStep = {
  title: string;
  body: string;
  to?: string;
  linkLabel?: string;
  /** Route only makes sense once signed in. */
  needsAuth?: boolean;
};

/** The original welcome walk — keep this list as-is. */
export const QUICK_STEPS: TourStep[] = [
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
    body: "On any trip, tap the sparkle next to the name. Béa can build a day-by-day plan from your travel preferences, read a photo or pasted itinerary, rearrange the stops you already have (closest together, rainy-day indoor, easy mornings…), or compare two drafts. Costs stay off unless you ask. After a draft you can swap selected stops or rebuild the whole trip. Tick what you want and save it onto that trip.",
    to: "/trips",
  },
  {
    title: "Budgets and calendar",
    body: "A trip can have a budget — planned expenses and a live spending tracker that updates when you claim a receipt. You turn it on; it does not start itself. The calendar lays every trip and plan out by date.",
    to: "/calendar",
    needsAuth: true,
  },
  {
    title: "Recommendations",
    body: "Paste a link, search the web, pin a nearby place on the map, tap 'I'm here now', or paste a list — including a page of things to do. Search forgives typos — a missing or doubled letter still finds the place.",
    to: "/recommendations",
  },
  {
    title: "Near me",
    body: "Standing somewhere with a free hour? Béa ranks everything you've saved by how close it is, from right here to a day trip away. Tick a few recs, pick today's pace, and she will arrange them into a Day trip.",
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
    title: "Tell Béa something",
    body: "On You, open the Feedback banner at the bottom. A missing travel stat, a wish, a bug that made you laugh — if Béa dropped the ball, this is where you throw it back. She reads it. She's trying.",
    to: "/profile",
  },
  {
    title: "You're all set",
    body: "That's the highlights. Replay from Profile settings and pick Deep Dive if you want every cupboard, tap Ask Béa on any page for that screen, and You → Feedback is always there if you want a new stat or have an idea.",
    to: "/",
  },
];

/** Every feature, explained. Replay from You if you want the short walk instead. */
export const DEEP_STEPS: TourStep[] = [
  {
    title: "Welcome — the long way",
    body: "This is the Deep Dive. Béa will walk every cupboard: the map, the vault, trips, planning, Near, photos, money, documents, and You. Nothing is booked along the way. Skip any time, or Back on the first screen to pick the short walk instead.",
  },
  {
    title: "Home — the trip card",
    body: "Your current or next trip sits at the top of Home with its dates and the first few things on the plan. Tap the card to open the whole folder. If you have nothing coming up, Home stays quiet until you make a trip.",
    to: "/",
  },
  {
    title: "Home — story and memories",
    body: "Two shortcuts live under the trip: Travel story plays your journey city by city, and City memories gathers photos, notes and saved spots. Further down, Waiting for you surfaces a saved recommendation, and Recent memories shows cities from your latest photos.",
    to: "/",
  },
  {
    title: "Customize Home",
    body: "On You → Profile settings, Customize home lets you hide the trip card, the story shortcuts, Waiting for you, Recent memories, or a Future Me note. The choice is saved on this device, so Home can be as quiet as you like.",
    to: "/profile",
  },
  {
    title: "World — the globe",
    body: "Drag to spin, pinch or scroll to zoom. Every saved place is a pin: blue you've been, green for next time, yellow wish list, purple a recommendation. Tap a pin to open it.",
    to: "/world",
  },
  {
    title: "World — pin filters",
    body: "The chips above the globe hide and show whole groups of pins. Turn off recommendations, or keep only places you've visited, when the map gets busy.",
    to: "/world",
  },
  {
    title: "Help me choose",
    body: "Tick two to five saved places, say what matters — warm, cheap, a long weekend — and Béa weighs them up with a pick and honest trade-offs. She does not invent new cities here; she only ranks what you already saved.",
    to: "/world",
  },
  {
    title: "Travel statistics",
    body: "Open Travel statistics for countries, cities, trips, photos and pins. Tap Choose stats to turn counters on or off. Countries can be a share of the world — 1 of 195, or a percent. Want a number Béa does not count yet? Tell her on You → Feedback.",
    to: "/world",
  },
  {
    title: "Heatmap",
    body: "Switch the heatmap on to see where you've spent the most time as a warm cloud instead of dots. Toggle between days and photos — days come from how long you stayed, photos from how many pictures you imported.",
    to: "/world",
  },
  {
    title: "Add a city by hand",
    body: "Not every visit has a photo. On World, open Add a city by hand: type one city or country, or paste / upload a list from your notes. Country names are recognised straight away. Other names are looked up so you can pick the pin before anything is saved. If one name is not recognised, tap Correct it and type the usual name. Those places count in your travel stats too.",
    to: "/world",
  },
  {
    title: "The recommendation vault",
    body: "Recs is the shelf of places people told you about — restaurants, hotels, walks, shops. Newest first, with who recommended it, the note you left, and the travel tags Béa guessed. Tap Remove to let one go.",
    to: "/recommendations",
  },
  {
    title: "Search and chips",
    body: "Search by the place, the city, or the person who told you. A typo, a missing accent, a doubled letter still finds it — café and cafe both work. City chips filter by cities already in your vault. Kind chips filter by category: restaurants, bars, hotels, and so on.",
    to: "/recommendations",
  },
  {
    title: "Ways to save a place",
    body: "Paste a link, search the web, pin a nearby place on the map, tap I'm here now, type it in by hand, or paste / upload a list. The list can be names from your notes, a photo, a file, or a page of things to do — Béa reads the page, looks each one up, and you edit name, note or category before anything is saved.",
    to: "/recommendations",
  },
  {
    title: "Travel tags",
    body: "When you save a rec, Béa guesses tags — Museums, Coffee shops, Parks, Nightlife. Let Béa plan and Plan a day trip lean on those tags, plus the preferences you set on You, so the draft matches how you actually travel.",
    to: "/recommendations",
  },
  {
    title: "Start a trip",
    body: "Name it, search the starting city, pick dates if you know them, and tick a budget only if you want one. A budget does not turn on by itself. Dates can stay Tentative until the flights are real. After you create the trip you can still change dates, cities, friends and money — this is a first draft of a holiday, not a boarding pass.",
    to: "/trips",
  },
  {
    title: "Flying Solo and invite codes",
    body: "A trip with only you says Flying Solo. Share an invite code and whoever joins can edit the timeline, stops and budget. On Trips, Join with a code is how you accept someone else's invite. You'll see their changes as they make them.",
    to: "/trips",
  },
  {
    title: "Cities, stops and layovers",
    body: "Inside a trip, Where you're going holds every city with arrival and leaving dates, in travel order. One trip can cover several countries. Mark a stop as a layover when you're only changing planes.",
    to: "/trips",
  },
  {
    title: "The shared timeline",
    body: "The timeline is the day-by-day plan: meals, walks, museums, free hours. Everyone on the trip can add to it. Nothing here is a reservation — treat it as the plan until you book it yourself.",
    to: "/trips",
  },
  {
    title: "Let Béa plan — build or import",
    body: "The sparkle on a trip card is the planner, not the page tour. Build a day-by-day plan from your travel preferences and tagged recs, or import a photo or pasted itinerary. Compare two drafts side by side if you want a second opinion.",
    to: "/trips",
  },
  {
    title: "Costs, alternatives and rebuild",
    body: "Approximate costs stay off unless you switch them on. After a draft, tick stops you want swapped and ask for alternatives, or Rebuild my trip to start the whole plan again. Tick what you want and save it onto that trip. Béa does not book hotels, tables or tickets, and she cannot check whether something is actually free.",
    to: "/trips",
  },
  {
    title: "Optimize",
    body: "Once a trip has a couple of stops, Optimize reshuffles what you already have — closest together, rainy-day indoor, easy mornings, a rest day, even pace, or meals first. You approve the new order before it saves. Flights, hotels and reservations stay put unless they have to move.",
    to: "/trips",
  },
  {
    title: "Get directions",
    body: "Get directions between the cities on the trip. After they arrive you can add those walking or driving legs to the timeline. Turn-by-turn stays on this phone only if you download Offline directions in trip settings — maps, photos and the vault still need a connection.",
    to: "/trips",
  },
  {
    title: "Packing lists on a trip",
    body: "The paper icon attaches a copy of a saved packing list to this trip. Tick things off here; what you add or remove stays on this trip only. Build the reusable templates — weekend, beach, ski, work — under You → Create packing lists.",
    to: "/trips",
  },
  {
    title: "Trip settings",
    body: "Open settings on a trip to turn the budget on or off after the fact, download Offline directions, or delete the trip. Deleting takes the timeline, stops, budget and invites with it — Béa asks you to confirm first.",
    to: "/trips",
  },
  {
    title: "The document vault",
    body: "Passports, visas and boarding passes live on the trip and on You. They are scrambled on your own device before they're stored, then locked behind a passcode or your fingerprint.",
    to: "/trips",
  },
  {
    title: "Budgets",
    body: "When a budget is on, you can add planned expenses and watch a live spending tracker. Claiming a receipt on Expenses updates the trip across your devices. Leave the budget off if you do not want the numbers.",
    to: "/trips",
  },
  {
    title: "Calendar",
    body: "The calendar lays every trip and plan out by date, so overlapping holidays and a work week in another city sit on one page.",
    to: "/calendar",
    needsAuth: true,
  },
  {
    title: "Near me — location rules",
    body: "Béa always asks before using your location. You choose how long it stays on — just this once, an hour, today, or until you turn it off. She does not watch you in the background unless you said she could.",
    to: "/opportunities",
  },
  {
    title: "How close, how often, snooze",
    body: "Set the distance that counts as near, and how often you want a nudge. If a place is a bit much right now, snooze it. What's around you is everything you've saved, ranked from right here to a day trip away, with directions one tap away.",
    to: "/opportunities",
  },
  {
    title: "Plan a day trip",
    body: "Tick two or more nearby recs, pick today's pace, and lean into the tags you care about. Arrange with Béa lines them up for one day using your saved travel preferences. Review the draft, then save it as a trip — Day trip, that city. Nothing is booked.",
    to: "/opportunities",
  },
  {
    title: "Photos become memories",
    body: "Import pictures from your phone. Béa reads the location saved inside each one, sorts them into city memory pages, and drops a pin on your map. You'll see a privacy note before every upload. Choose Locations only if you want the pin and nothing stored.",
    to: "/photos",
    needsAuth: true,
  },
  {
    title: "City memories and Future Me",
    body: "Every city you visit gets its own memory page with photos and pins. Leave a note to your future self on any place — a bakery, a warning, a secret garden — and Béa hands it back when you return.",
    to: "/memories",
    needsAuth: true,
  },
  {
    title: "Travel story",
    body: "Playback walks your journey city by city, in the order you were there. Play, pause, or skip a stop. It is a story of places you already lived, not a new itinerary.",
    to: "/story",
    needsAuth: true,
  },
  {
    title: "Receipts and expenses",
    body: "Photograph each receipt, tag the trip, and download a tidy spreadsheet. Receipts in euros, dollars or pounds roll into one total in your home currency at today's real exchange rates. This is also You → Work travel.",
    to: "/expenses",
    needsAuth: true,
  },
  {
    title: "You — the account",
    body: "Sign in on You so pins, trips, recs and photos follow you onto any phone or laptop. This is also where packing lists, offline options, legal pages and Help live.",
    to: "/profile",
  },
  {
    title: "Travel preferences",
    body: "Style, budget, pace, interests, favourite countries and dietary notes live under Profile settings and on the Travel preferences page. Let Béa plan, Optimize and Plan a day trip all read these, so a Comfort seeker who likes museums gets a different draft from an Outdoors full-pace trip.",
    to: "/preferences",
    needsAuth: true,
  },
  {
    title: "Light, dark and packing",
    body: "Profile settings has the appearance switch: warm cream by day, black and light grey at night. Under You, Create packing lists stores reusable templates you attach to a trip as a copy.",
    to: "/profile",
  },
  {
    title: "Offline options",
    body: "Béa cannot pack maps, photos, recommendations or the vault onto this phone yet. What does work: open a trip → settings → Offline directions. You → Offline options lists every trip that already has those steps saved here.",
    to: "/profile",
  },
  {
    title: "Legal and copyright",
    body: "You → Legal, privacy and such holds the privacy policy, the terms, and a note that Béa — the app, its name, design and original ideas — is Mathilde E. Larochelle's work. You keep what you save in it.",
    to: "/profile",
  },
  {
    title: "Help, and Ask Béa",
    body: "Help & FAQ answers the usual questions. Ask Béa is the sparkle at the top of a page — it highlights each part of that screen. Let Béa plan is the sparkle on a trip card. They are different sparkles on purpose.",
    to: "/help",
  },
  {
    title: "Tell Béa something",
    body: "On You, open the Feedback banner at the bottom. Pick a category — it broke, a missing stat, a wish, the map has opinions, or something nice — then write it. If Béa dropped the ball, this is where you throw it back. She reads it. She's trying.",
    to: "/profile",
  },
  {
    title: "You're all set",
    body: "That's every cupboard. Replay from Profile settings any time and pick the quick walk if you only wanted the highlights. Ask Béa still lives on each page, and You → Feedback is always there if you want a new stat or have an idea.",
    to: "/",
  },
];

export function tourSteps(mode: TourMode): TourStep[] {
  return mode === "deep" ? DEEP_STEPS : QUICK_STEPS;
}
