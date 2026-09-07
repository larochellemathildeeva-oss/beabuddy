/**
 * Help Center copy — conversation with a travel companion, not a software manual.
 * See docs/BRANDING.md. Keep answers explaining, encouraging, or reassuring.
 */

export type Faq = { q: string; a: string };

export const HELP_WELCOME = {
  title: "Hi, I'm Béa.",
  lead: "I remember travel things so you don't have to.",
  body: "Recommendations from friends. Places you've been meaning to visit. Cities you've explored. Trips you're planning. Memories you want to keep. Béa helps keep them connected.\n\nIf you're not sure where to start, you're in the right place.",
} as const;

export const HELP_CLOSING = {
  title: "A final note",
  body: "Travel plans change. Flights get delayed. Recommendations get forgotten. Cities surprise us.\n\nBéa can't prevent any of that.\n\nBut Béa can help make sure the places, ideas, memories, and plans that matter to you don't get lost along the way.\n\nBéa remembers your travel life so Future You doesn't miss what matters.",
} as const;

export const HELP_FAQ_GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What exactly is Béa?",
        a: "Béa is your travel memory, recommendation, and planning companion.\n\nThink of it as one place for places you've visited, places you want to visit, recommendations from friends, future trip ideas, travel memories and photos, and planned adventures.\n\nThe goal isn't to plan every trip for you. The goal is to help you make better use of everything you've already discovered.",
      },
      {
        q: "Why would I use Béa?",
        a: "Most travel ideas end up scattered across screenshots, Google Maps, Instagram saves, group chats, notes apps, and memory.\n\nBéa brings those pieces together so they're easier to find, remember, and use.",
      },
      {
        q: "Where should I start?",
        a: "Try this: save a recommendation, add a city you've visited, explore your globe, try Help me choose, or let Béa build a sample trip.\n\nYou'll understand the app much faster by using it than by reading about it. First sign-in also offers a quick walk around the block; Replay under You can open that again or the Deep Dive.",
      },
      {
        q: "What's the difference between Ask Béa and Let Béa plan?",
        a: "Ask Béa is the sparkle at the top of a page — it highlights each part of that screen and explains it.\n\nLet Béa plan is the sparkle on a trip: it builds or imports a day-by-day itinerary onto that trip.",
      },
      {
        q: "Do I need an account?",
        a: "Yes, to keep anything. An account means your pins, trips, recommendations, and photos follow you onto any phone or laptop.",
      },
    ],
  },
  {
    title: "Recommendations & places",
    items: [
      {
        q: "Why save recommendations?",
        a: "Because \"I'll remember that later\" is surprisingly unreliable.\n\nSave places from friends, family, articles, social media, travel blogs, or your own discoveries. Later, Béa can help surface them when you're planning or nearby.",
      },
      {
        q: "What's the difference between a recommendation and a wishlist?",
        a: "Wishlist: a place you personally want to visit.\n\nRecommendation: a place someone suggested to you, or a specific spot worth remembering.\n\nA city can be a wishlist. A café, restaurant, museum, or hidden gem is often a recommendation.",
      },
      {
        q: "Can I remember who suggested a place?",
        a: "Absolutely. One of the most useful parts of Béa is remembering who told you, why they recommended it, and any notes you added.\n\nRecommendations are often more valuable with context. You can also add travel tags (Museums, Coffee shops, and so on) so planning can match how you travel.",
      },
      {
        q: "How do I save a place?",
        a: "Paste a link, search the web, pin nearby, use I'm here now, type by hand, or paste a list. You review each one — name, note, category, who told you, exact map spot — before anything saves.",
      },
    ],
  },
  {
    title: "World & memories",
    items: [
      {
        q: "What is the globe for?",
        a: "The globe is your travel life in one place. It helps you see where you've been, where you want to go, places you're saving for later, and recommendations waiting for future trips.\n\nPin colours: visited, next time, wishlist, and recommendation. Chips above the globe hide whole groups when the map gets busy. You can also add cities or countries by hand, turn on the heatmap, and choose which travel statistics to show.",
      },
      {
        q: "Why does Béa track memories by city?",
        a: "Cities often become chapters in a travel story.\n\nGrouping photos, visits, notes, and recommendations by city makes it easier to revisit experiences over time.",
      },
      {
        q: "What are Future Me notes?",
        a: "They're messages from Present You to Future You.\n\nExamples: \"Try the bakery next visit.\" \"Come back in spring.\" \"Stay longer next time.\"\n\nSmall reminders often become the most valuable ones.",
      },
      {
        q: "What is Playback?",
        a: "Playback is your travel story — also called Travel story on Home.\n\nBéa can walk through cities you've visited, in order, using photos and memories to create a timeline of your adventures. Think of it as a personal travel highlight reel.",
      },
      {
        q: "How do I customize Home?",
        a: "On You → Profile settings, open Customize home. You can hide the trip card, Travel story and City memories shortcuts, Waiting for you, Recent memories, or a Future Me note. The choice is saved on this device.",
      },
    ],
  },
  {
    title: "Planning trips",
    items: [
      {
        q: "How does trip planning work?",
        a: "Béa can help build trips using your saved places, recommendations, travel preferences, and travel style.\n\nRather than starting from a blank page, planning begins with things you've already said matter to you. Set preferences on You → Travel preferences.",
      },
      {
        q: "Does Béa automatically book anything?",
        a: "No. Béa helps organize and plan. It does not make bookings or purchases on your behalf — and it does not book restaurants or hotels.",
      },
      {
        q: "How does Help me choose work?",
        a: "Sometimes choosing is harder than dreaming.\n\nHelp me choose compares saved destinations using your preferences, timing, distance, saved history, and travel interests. Béa explains its reasoning so you can decide for yourself.",
      },
      {
        q: "Will Béa always have the right answer?",
        a: "No. And that's okay.\n\nBéa can offer suggestions, rankings, and ideas, but travel decisions are personal. Whenever confidence is lower, we'll try to tell you honestly.",
      },
      {
        q: "Can friends edit a trip with me?",
        a: "Yes. Share an invite code; whoever joins can edit the timeline, stops, and budget. Alone, the trip says Flying Solo. Join with a code accepts someone else's invite.\n\nDates can be Tentative or Confirmed. Packing lists live under You — attach a copy to a trip. Get directions between cities, and download Offline directions in trip settings if you want turn-by-turn on this phone.",
      },
      {
        q: "Can Béa turn nearby saves into a day trip?",
        a: "Yes. On Near, tick a few saved places, pick today's pace, Arrange with Béa, then save as a day trip. Still starting from what you already kept.",
      },
    ],
  },
  {
    title: "Near",
    items: [
      {
        q: "Why is Béa showing me this place?",
        a: "Because at some point, you thought it was worth saving.\n\nBéa noticed you were nearby and wanted to remind you.\n\nOr, as Béa would put it: Past You left a breadcrumb.",
      },
      {
        q: "Does Béa always track my location?",
        a: "No. Location is only used when you choose to share it. You control when location access starts and stops.",
      },
      {
        q: "Can I use Near without sharing my location?",
        a: "Yes. You can use demo cities to explore how Near works without GPS access.",
      },
    ],
  },
  {
    title: "Privacy & security",
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
        q: "Why do you ask for photo access?",
        a: "To help organize memories, create city pages, and build your travel story from photos you choose to import.",
      },
      {
        q: "What happens to my recommendations and saved places?",
        a: "They're saved to your account so Béa can help you organize them, plan trips, and rediscover them later.",
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
        q: "Do I own my data?",
        a: "You retain control over the trips, memories, recommendations, notes, and photos you store in Béa.",
      },
      {
        q: "Do you sell my data?",
        a: "Béa is designed to help organize your travel life, not to build advertising profiles. For details about how information is used, see our Privacy Policy.",
      },
      {
        q: "Can I delete my data?",
        a: "You can delete many types of information you add to Béa, including trips, recommendations, notes, memories, and documents.\n\nUnder Profile → Legal, privacy and such you can delete the whole account. Some information may remain in backups or with AI providers for a limited period as described in the Privacy Policy.",
      },
      {
        q: "How does Béa use AI?",
        a: "AI helps with things like trip planning, itinerary imports, recommendation organization, and decision support. Those requests go to Google Gemini; the provider may process or retain prompts under their policy.\n\nBéa provides suggestions, not decisions. You'll always have the final say.\n\nAI-generated suggestions may be incomplete, inaccurate, or unsuitable for your situation. We encourage you to review recommendations before acting on them.",
      },
      {
        q: "Is Béa always right?",
        a: "No.\n\nWhen Béa is uncertain, we'll do our best to say so. Travel is complicated, and honest uncertainty is better than confident nonsense.",
      },
      {
        q: "In one sentence, how does Béa think about privacy?",
        a: "Your travel life is yours. Béa's role is to help you organize it, remember it, and make better use of it.",
      },
    ],
  },
  {
    title: "Travel statistics",
    items: [
      {
        q: "How are my stats calculated?",
        a: "Stats are based on information you've added to Béa — saved cities, trips, photos, recommendations.\n\nThey're meant to be fun and informative, not official records.",
      },
      {
        q: "Why do some stats seem incomplete?",
        a: "Béa can only count what it knows. The more places, trips, and memories you add, the richer your travel story becomes.\n\nOn World you can choose which counters to show, including countries as a world share.",
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
        q: "Something looks wrong",
        a: "We'd like to hear about it. Use You → Feedback.\n\nOne of the categories is literally: It broke and I laughed. We appreciate both bug reports and honesty.",
      },
      {
        q: "Does Béa work offline?",
        a: "Not as a full offline app. Maps, photos, recommendations, and the vault still need a connection.\n\nWhat does work: trip Settings → Offline directions keeps walk or drive steps on this phone. You → Offline options lists trips that already have those steps saved here.",
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
        a: "Béa — the app, its name, design, features and original ideas — is Mathilde E. Larochelle's work. You keep what you save in it. The copyright notice lives under You → Legal, next to privacy and terms.",
      },
    ],
  },
];
