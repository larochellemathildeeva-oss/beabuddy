/**
 * Help Center copy. Organised by what a traveller is trying to do — planning
 * first, because that is what most people open Béa for — with a "Show me"
 * walk on the answers a screen explains better than words.
 *
 * Béa is spoken about in the third person, never "I" (docs/WHAT_BEA_BELIEVES.md).
 * See docs/BRANDING.md. Keep answers explaining, encouraging, or reassuring.
 */
import { BEA_HELPS, BEA_MISSION } from "./bea-voice.ts";
import type { WalkId } from "./tour.ts";

export type Faq = {
  q: string;
  a: string;
  /** The walk that shows this on the real screens. */
  walk?: WalkId;
};

export const HELP_WELCOME = {
  title: "How can Béa help?",
  lead: BEA_HELPS,
  body: "Pick what you're trying to do and Béa walks you through it on the real screens, or search for an answer below. The ? at the top of every page explains that page.",
} as const;

export const HELP_CLOSING = {
  title: "A final note",
  body: `Travel plans change. Flights get delayed. Recommendations get forgotten. Cities surprise us.\n\nBéa can't prevent any of that. But Béa can help make sure the places, plans and memories that matter to you don't get lost along the way.\n\n${BEA_MISSION}`,
} as const;

export const HELP_FAQ_GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What does Béa do?",
        a: "Béa plans trips from the places you've saved and the way you like to travel, then helps every day you're on them: the day's plan, directions, bookings and what's nearby. Afterwards she keeps your map of everywhere you've been.\n\nShe starts from your own tips and history, not a list invented for you. How Béa works shows the whole thing on one page.",
      },
      {
        q: "Where should I start?",
        a: "Most people start with a trip. On Trips, Plan with Béa → Build a new trip drafts the days; Import your plan reads one you already have.\n\nNo trip yet? Save a few places a friend told you about on Recs, or add the cities you've been to on World. Every walk under Show me how to… points at the real buttons, one step at a time.",
        walk: "plan",
      },
      {
        q: "What's the difference between the ? button and Plan with Béa?",
        a: "The ? at the top right of a page is help: it says what that page is for and what you can do there, and Show me around highlights each part of the screen.\n\nPlan with Béa is the planner, at the top of Trips and on every trip: Build a new trip, Import your plan, Optimize my trip or Compare options.",
      },
      {
        q: "Do I need an account?",
        a: "Yes, to keep anything. An account means your pins, trips, recommendations, and photos follow you onto any phone or laptop.",
      },
    ],
  },
  {
    title: "Planning a trip",
    items: [
      {
        q: "How do I plan my first trip?",
        a: "On Trips, tap Plan with Béa, then Build a new trip. Tell Béa where and when, and anything that matters: a pace, a budget, who is coming. She drafts the days from your saved places and Travel preferences, and shows you the plan before anything saves.\n\nPrefer to start empty? The + on Trips makes a trip with a name, a city and dates; add stops as you go.",
        walk: "plan",
      },
      {
        q: "How does trip planning work?",
        a: "Béa builds trips from your saved places, recommendations, travel preferences and travel style, so planning starts from things you've already said matter to you.\n\nBefore she drafts, she runs a quick search for events, strikes and closures at your destination on your dates, and shows what she found under the plan. Set your style, budget and pace once on You → Travel preferences; she reads them every time.",
        walk: "plan",
      },
      {
        q: "Can I bring in a plan I already have?",
        a: "Yes. Plan with Béa → Import your plan reads pasted text, a photo, a PDF or a calendar file and turns it into a trip. Each stop she can find is pinned on the map; any she can't place, or isn't sure about, is marked so you can check it.",
        walk: "import",
      },
      {
        q: "Can I bring in a plan from another assistant?",
        a: 'Yes. Help → Plan a trip, and Get the AI prompt under Plan with Béa → Import your plan, both have a prompt to copy into whichever one you use. Fill in the city, dates and what you\'d like, then paste its answer into Plan with Béa → Import your plan.\n\nThe prompt asks for one place per line, each with a time and a street address, and no "walk to…" lines. That is the shape Béa reads most precisely: each stop lands on the map on its own, and trips between them stay out of your timeline.',
        walk: "import",
      },
      {
        q: "What does Optimize my trip do?",
        a: "It puts each day's stops in a better order, so you spend less time getting between them, and can make sure places are open when you get there. It shows you the new order before anything moves.",
      },
      {
        q: "Can Béa compare two plans?",
        a: "Yes, and this is different from Help me choose.\n\nPlan with Béa → Compare options takes two whole itineraries — a friend's plan and one from an AI, say — reads each, then goes day by day on what actually differs and what you trade for it. Tell it what matters to you and it commits to a pick, with two plain sentences on why, plus the one thing worth borrowing from the plan it did not choose.\n\nIt reports indoor share, active hours a day, walking distance and estimated spend by category. It will not invent travel times it cannot measure, and if one plan is shorter it says nothing planned for that day rather than filling it in.",
      },
      {
        q: "How does Help me choose work?",
        a: "Sometimes choosing is harder than dreaming.\n\nHelp me choose compares saved destinations using your preferences, timing, distance, saved history, and travel interests. Béa explains its reasoning so you can decide for yourself.",
        walk: "save",
      },
      {
        q: "Does Béa automatically book anything?",
        a: "No. Béa helps organize and plan. It does not make bookings or purchases on your behalf — and it does not book restaurants or hotels.",
      },
      {
        q: "Will Béa always have the right answer?",
        a: "No. And that's okay.\n\nBéa offers suggestions, rankings and ideas, but travel decisions are personal. When she is less sure, she says so.",
      },
    ],
  },
  {
    title: "On the trip",
    items: [
      {
        q: "What does Béa do while I'm travelling?",
        a: "Home shows the trip you're on and the next stop. Inside the trip, Now follows the day with you: tap I'm here and Leaving, and Béa says when to set off. Map draws the day, Bookings keeps flights, stays and tickets together, and Get directions walks, drives or takes transit the way you like to get around.",
        walk: "on-trip",
      },
      {
        q: "How do I get directions?",
        a: "Open a trip and tap Get directions. Choose how you get around: walk what's close, public transit, walk everywhere, car, or your own distance rules. Transit times are typical times, not a timetable, so Béa opens Google Maps for the real lines.",
        walk: "on-trip",
      },
      {
        q: "Does Béa work without a connection?",
        a: "Partly. Installed on your home screen, Béa is designed to open without signal, and a trip you keep offline comes with it: in the trip menu (•••) → Offline maps, download its directions and Béa keeps its plan, the saved directions (walk or drive steps) and, where this phone can draw it, the map around each day's stops.\n\nEverything else — recommendations, photos, new searches and the vault — needs a connection. You → Data & imports lists the trips kept on this phone. The directions are also kept in your account, so signing out (which clears them from this phone) or a new phone never loses them: sign in with a signal and they come back. Keep a screenshot or your maps app too, in case.",
        walk: "on-trip",
      },
      {
        q: "How do I keep bookings and tickets?",
        a: "In Trip documents, on Trips or inside a trip. Add a PDF or photo and Fill in from this file reads the dates and details for you; Paste text does the same for a confirmation email. Nothing saves until you check it. Anything private goes in Protected, encrypted with your passcode.",
        walk: "import",
      },
      {
        q: "What is Things to do on a trip?",
        a: "The errands a trip needs that are not places and not packing — renew the passport, book the transfer, tell the bank, print the tickets.\n\nOpen it from To do at the top of a trip, beside Plan with Béa, or from To-do on Home. Add something and give it a due date afterwards if it needs one; Start me off suggests the usual ones based on whether the trip is international, has flights, or has somewhere to stay.",
      },
      {
        q: "Can Béa turn nearby saves into a day trip?",
        a: "Yes. On Home, open the places near you, tick a few, pick today's pace, Arrange with Béa, then save as a day trip. Still starting from what you already kept.",
        walk: "on-trip",
      },
    ],
  },
  {
    title: "Saving places",
    items: [
      {
        q: "How do I save a place?",
        a: "One field on Recs takes whatever you have. Type a name and Béa looks it up as you pause — tap Save on a suggestion to keep it straight away, or tap the row to fill in the note, category, who told you and the exact map spot first. Paste a link from Maps, Instagram or a blog and Béa reads it the same way.\n\nFrom my trips and I'm here now sit just below the field, and Explore nearby opens a live map to pin somewhere around you. The + at the top holds the rest: By hand, Paste a list, and sending or opening shares.",
        walk: "save",
      },
      {
        q: "Why save recommendations?",
        a: "Because \"I'll remember that later\" is surprisingly unreliable.\n\nSave places from friends, family, articles, social media or your own discoveries. When you plan a trip there, Béa starts from them, and when you're nearby, Home shows them.",
        walk: "save",
      },
      {
        q: "What's the difference between a recommendation and the bucket list?",
        a: "Bucket list: a place you personally want to go — a city or country on World, or a café, landmark or activity in Recs.\n\nRecommendation: a place someone suggested to you, or a specific spot worth remembering.\n\nCities and countries live on World; cafés, restaurants, museums, landmarks and activities live in Recs, and each city on World shows the recs saved for it.",
      },
      {
        q: "Can I remember who suggested a place?",
        a: "Absolutely. One of the most useful parts of Béa is remembering who told you, why they recommended it, and any notes you added.\n\nRecommendations are often more valuable with context. You can also add travel tags (Museums, Coffee shops, and so on) so planning can match how you travel.",
      },
      {
        q: "Can I send my saved places to someone?",
        a: "Yes. On Recs, tap the + beside the add field: Send places lets you tick a few places and turns them into a code you can text or email. Whoever opens it keeps the ones they want, and each kept place arrives with your name on it.\n\nThey never see the rest of your vault — a share is a copy of exactly what you ticked, so editing or deleting a place later does not change a list someone already has. Your own notes stay private unless you tick Send my notes too. Codes last thirty days and you can stop one at any time.\n\nOpen a share is how you take in a list someone sent you. Anything already in your vault is flagged so you do not keep it twice.",
      },
      {
        q: "Why is Béa showing me this place?",
        a: "Because at some point, you thought it was worth saving.\n\nBéa noticed you were nearby and wanted to remind you.\n\nOr, as Béa would put it: Past You left a breadcrumb.",
      },
      {
        q: "Where did the Near tab go?",
        a: "It lives on Home now. The places you saved nearby appear there as soon as you share your location, sorted by how close you are.\n\nIt is the same list your vault holds — Near was never a different set of places, just a different order.",
      },
    ],
  },
  {
    title: "Your map & memories",
    items: [
      {
        q: "What is the globe for?",
        a: "The globe is your travel life in one place. It helps you see where you've been, where you want to go, places you're saving for later, and recommendations waiting for future trips.\n\nPin colours: been there, bucket list, and recommendation. Chips above the globe hide whole groups when the map gets busy. You can also add cities or countries by hand, and choose which travel statistics to show.",
        walk: "map",
      },
      {
        q: "Why does Béa track memories by city?",
        a: "Cities often become chapters in a travel story.\n\nGrouping photos, visits, notes, and recommendations by city makes it easier to revisit experiences over time.",
        walk: "map",
      },
      {
        q: "What are Future Me notes?",
        a: 'They\'re messages from Present You to Future You.\n\nExamples: "Try the bakery next visit." "Come back in spring." "Stay longer next time."\n\nSmall reminders often become the most valuable ones.',
      },
      {
        q: "What is Playback?",
        a: "Playback is your travel story — Play your story, on City memories.\n\nBéa can walk through cities you've visited, in order, using photos and memories to create a timeline of your adventures. Think of it as a personal travel highlight reel.",
      },
      {
        q: "How are my stats calculated?",
        a: "Stats are based on information you've added to Béa — saved cities, trips, photos, recommendations.\n\nThey're meant to be fun and informative, not official records.",
      },
      {
        q: "Why do some stats seem incomplete?",
        a: "Béa can only count what it knows. The more places, trips, and memories you add, the richer your travel story becomes.\n\nOn World you can choose which counters to show, including countries as a world share.",
      },
      {
        q: "How do I customize Home?",
        a: "At the foot of Home, under Customize home. You can hide Weather, Trips, Saved places or the Future me note. The choice is saved to your account, so it follows you to every device you sign in on.",
      },
    ],
  },
  {
    title: "Travelling together",
    items: [
      {
        q: "Can friends edit a trip with me?",
        a: "Yes. Share an invite code; whoever joins can edit the timeline, stops, and budget. Alone, the trip says Flying Solo. Join with a code accepts someone else's invite.\n\nCodes expire in about seven days and are designed to work once — create a new one if you need another join. In the trip menu (•••) → Invite and people you can revoke a code, remove someone (if you own the trip), or leave the trip yourself. The same place makes a read-only link for anyone who only needs to see the plan; turn it off whenever you like.\n\nDates can be Tentative or Confirmed. Packing lists live under You — attach a copy to a trip. Get directions between cities, and trip menu → Offline maps keeps the directions and the map on this phone.",
      },
    ],
  },
  {
    title: "Privacy & your data",
    items: [
      {
        q: "Who can see my travel data?",
        a: "Trips, memories, recommendations, and photos are private by default. They aren't publicly visible, and we don't share them unless you choose to use a sharing feature.",
      },
      {
        q: "Does Béa track my location all the time?",
        a: "Béa only accesses your location when you've granted permission. Location-enabled features use that information to provide services such as Nearby opportunities.",
      },
      {
        q: "Can I use Béa without sharing my location?",
        a: "Yes. Most of Béa works without location access. You'll only miss features that depend on your current location.",
      },
      {
        q: "What happens to my photos?",
        a: "That's your choice.\n\nYou can import photos and locations, import locations only, or remove imported photos later.\n\nYour travel memories should stay under your control.",
      },
      {
        q: "What is the Document Vault for?",
        a: "A place to keep trip-useful documents — reservations, tickets, booking confirmations, boarding passes, and similar items you may need while travelling.\n\nIt is not intended for identity documents such as passports or visas.",
      },
      {
        q: "How secure is the Document Vault?",
        a: "Document contents are encrypted on your device before being uploaded. Unlock is passcode-only.\n\nKind, label, and expiry stay readable so you can find items while locked. The Vault is designed so that only someone with your Vault credentials can view encrypted contents.",
      },
      {
        q: "Can Béa read my Vault documents?",
        a: "Vault document contents are designed so that Béa cannot view them without access to your Vault credentials. Labels and kinds are stored so the list can show while locked.",
      },
      {
        q: "What if I forget my Vault passcode?",
        a: "If you forget your Vault passcode, recovery options may be limited or unavailable. We recommend storing your passcode somewhere safe.",
      },
      {
        q: "Why does Béa ask for permissions?",
        a: "Only for features that need them.\n\nLocation → Nearby opportunities\nPhotos → Memories and city pages\nCamera → Receipt scanning and photo imports\n\nYou can choose which permissions to grant.",
      },
      {
        q: "Do you sell my data?",
        a: "Béa is designed to help organize your travel life, not to build advertising profiles. For details about how information is used, see our Privacy Policy.",
      },
      {
        q: "Will Béa sign me out automatically?",
        a: "If you're signed in and leave the app idle for about 45 minutes with no taps or typing, Béa is designed to sign you out on this device. That helps on shared phones. Sign back in anytime.",
      },
      {
        q: "Can I delete my data?",
        a: "You can delete many types of information you add to Béa, including trips, recommendations, notes, memories, and documents.\n\nUnder Profile → Legal, privacy and such you can erase all your data and stay signed in — Béa asks twice (Are you sure? then Are you sure that you're sure?) before that runs. You can also delete the whole account by typing DELETE.\n\nSome information may remain in backups or with AI providers for a limited period as described in the Privacy Policy.",
      },
      {
        q: "How does Béa use AI?",
        a: "AI helps with things like trip planning, itinerary imports, recommendation organization, and decision support. Those requests go to Google Gemini; the provider may process or retain prompts under their policy.\n\nBéa provides suggestions, not decisions. You'll always have the final say.\n\nAI-generated suggestions may be incomplete, inaccurate, or unsuitable for your situation. We encourage you to review recommendations before acting on them.",
      },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      {
        q: "Béa can't find a place",
        a: "Try checking spelling, using the nearest city, searching the country first, or adding it manually. Some locations are easier to match than others. Search still works with typos and missing accents.",
      },
      {
        q: "A stop is pinned in the wrong place",
        a: "Open the stop and tap Change place to pick the right spot. Béa remembers your pick for next time. With Places to confirm on (trip view settings), the trip header lists every pin Béa was unsure of, so you can approve or fix them in one go.",
      },
      {
        q: "Something looks wrong",
        a: "We'd like to hear about it. Use You → Feedback.\n\nOne of the categories is literally: It broke and I laughed. We appreciate both bug reports and honesty.",
      },
    ],
  },
  {
    title: "About Béa",
    items: [
      {
        q: "Why is the app called Béa?",
        a: "Because travel feels better with a companion.\n\nNot one that tells you where to go. One that helps you remember why you wanted to go there in the first place.",
      },
      {
        q: "Who owns Béa?",
        a: "Béa — the app, its name, design, features and original ideas — is Mathilde E. Larochelle's work. You keep what you save in it. The copyright notice lives under You → Privacy & legal, next to privacy and terms.",
      },
    ],
  },
];

/** Lowercase, no accents: "cafe" finds "café", "bea" finds "Béa". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

/**
 * The groups with only the questions that match every word typed, in either
 * the question or the answer. An empty search gives back every group.
 */
export function searchHelp(
  query: string,
  groups: { title: string; items: Faq[] }[] = HELP_FAQ_GROUPS,
): { title: string; items: Faq[] }[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return groups;
  return groups
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) => {
        const text = fold(`${item.q} ${item.a} ${group.title}`);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((group) => group.items.length > 0);
}
