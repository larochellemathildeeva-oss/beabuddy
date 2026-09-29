/**
 * What the "?" help at the top right of each page says: what the page is for,
 * what you can do on it, and the spotlight steps behind "Show me around".
 *
 * Plain data, so tests can check every page has an overview and every step
 * points at a control that exists (`guide-targets.test.ts`).
 */
export type GuideStep = {
  title: string;
  body: string;
  /** CSS selector for the element to highlight. */
  selector?: string;
};

export type Guide = {
  name: string;
  /** One line: what this page is for. Shown first when Help opens. */
  about: string;
  /** What you can do here, in the page's own words. */
  features: string[];
  /** The spotlight walk behind "Show me around"; only steps on screen are shown. */
  steps: GuideStep[];
};

export const guides: Record<string, Guide> = {
  "/": {
    name: "Home",
    about:
      "Your day at a glance: the trip you're on or the next one, and the places you saved that are near you right now.",
    features: [
      "See your current or next trip, with its dates and a shortcut into it",
      "Share your location to list your saved places within reach, nearest first",
      "Get directions to one, or snooze it when it's not the moment",
      "Tick a few nearby places and let Béa arrange a day trip",
      "Check the weather where you are",
      "Choose what Home shows under You → Appearance",
    ],
    steps: [
      {
        title: "What's around you",
        body: "The places you already saved, sorted by how close you are right now, with directions one tap away. Béa only looks when you tap Share, and you pick for how long. Plan a day trip strings a few of them together.",
        selector: "[data-guide='home-near']",
      },
      {
        title: "Your trip right now",
        body: "The trip you're on, or the next one coming, sits here with its dates and where it goes. Tap it to open the whole folder.",
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
        body: "Nothing saved yet. Save a place, import photos, or load the sample travel data to try things out — you can remove it later from You → Data & imports.",
        selector: "[data-guide='home-empty']",
      },
    ],
  },
  "/world": {
    name: "World",
    about: "Everywhere you've been and everywhere you want to go, on one globe.",
    features: [
      "Map: spin the globe of the countries, provinces and cities you've visited",
      "Add places you've been by hand, or paste a whole list",
      "Bucket list: keep destinations you want to visit",
      "Help me choose: compare two to five saved places and get a pick with reasons",
      "Been there: every country, province and city, grouped",
      "Stats: counters for countries, cities, trips and pins",
    ],
    steps: [
      {
        title: "The map itself",
        body: "Drag to spin the globe, pinch or scroll to zoom. It shows where you've been: the countries, the provinces or states inside them, and a dot for each city.",
        selector: "[data-guide='globe']",
      },
      {
        title: "Where you've been",
        body: "Every country you've visited, its provinces or states, and your cities. Tap a city and the globe spins to it. A place saved as Japon or 日本 is still Japan.",
        selector: "[data-guide='places-list']",
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
        body: "The + on the globe adds a city or country you have been to. Type one city or country, or paste / upload a list from your notes. Country names are recognised straight away. Other names are looked up so you can pick the pin before anything lands on the globe. If one name is not recognised, tap Correct it and type the usual name. Those places count in your travel stats too.",
        selector: "[data-guide='add-city']",
      },
    ],
  },
  "/trips": {
    name: "Trips",
    about: "Every trip you're planning, on, or back from — each one its own folder.",
    features: [
      "Start a trip with a name, a city and dates (confirmed or tentative)",
      "Join a friend's trip with their invite code",
      "Switch between upcoming and past trips",
      "Open a trip to plan its days, stops, budget and packing",
      "Keep bookings and tickets in Trip documents, locked behind a passcode",
    ],
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
    about: "One trip, day by day: the plan, the people, and everything still to do.",
    features: [
      "Plan with Béa: draft a plan from your saved places, or bring in one you already have",
      "Add stops, saved places, or another city on the route",
      "Edit the shared timeline; everyone invited sees the same plan live",
      "Get directions between stops and keep them on this phone",
      "Track to-dos and packing, and convert prices into your money",
      "The trip menu (•••): invite people, budget, flights, hotels, print or save as PDF, offline maps",
    ],
    steps: [
      {
        title: "Plan with Béa",
        body: "Béa's planner, not the page tour. It can draft a plan from what you saved, read one you already have, optimize the order of your stops, or compare two drafts. You approve before anything saves. Béa does not book or check availability — you reserve hotels, tables and tickets yourself.",
        selector: "[data-guide='bea-plan']",
      },
      {
        title: "Add a stop quickly",
        body: "Add stop offers three ways in: a stop on the itinerary, in the Timeline Editor; a place from Saved, keeping its address and map pin; or another city or location on the trip's route.",
        selector: "[data-guide='add-stop']",
      },
      {
        title: "The shared timeline",
        body: "Day by day, and live: anyone invited sees the same plan as you edit it. After Get directions you can add those legs straight to the timeline. Turn-by-turn is kept on this phone only if you download it in trip settings.",
        selector: "[data-guide='trip-timeline']",
      },
      {
        title: "To do",
        body: "To do opens everything still to be done, in two views. To do holds the errands — renew the passport, book the transfer, tell the bank. Packing holds the list; add a copy of a pack you saved under You, then tick things off.",
        selector: "[data-guide='trip-prep']",
      },
    ],
  },
  "/recommendations": {
    name: "Recommendation vault",
    about: "Every place someone told you about, kept with who said it and why.",
    features: [
      "Search a name or paste a map link to save a place",
      "The + at the top: add from your trips, where you are, by hand, or a pasted list",
      "Open map to pin somewhere near you",
      "Browse your collections: Recommendations, Wishlist, Next time",
      "Search and filter everything you saved by city and type",
      "Send places to a friend, or open a share someone sent you",
    ],
    steps: [
      {
        title: "Find anything you've saved",
        body: "This opens everything you saved. Search by the place, the city, or the person who told you about it — a typo or a missing accent still finds a match — then filter by City and Type.",
        selector: "[data-guide='reco-search']",
      },
      {
        title: "Filter by city",
        body: "Pick a city from your saved recs to see every restaurant, hotel or spot there.",
        selector: "[data-guide='reco-places']",
      },
      {
        title: "Filter by kind",
        body: "Narrow to one category — restaurants, bars, hotels, whatever you've been tagging.",
        selector: "[data-guide='reco-categories']",
      },
      {
        title: "Pin something nearby",
        body: "Open the map of where you are and drop a pin on a suggested place, or tap anywhere to save that exact spot.",
        selector: "[data-guide='pin-nearby']",
      },
      {
        title: "Ways to save something",
        body: "Type a name or paste a link in the field. The + at the top holds the rest: places from your trips, where you are, by hand, or a pasted list — names from your notes, or a page of things to do. Béa reads the suggestions, looks each one up, and you can edit them before anything is saved. She guesses travel tags so she can pick them when you ask her to plan.",
        selector: "[data-guide='reco-add']",
      },
      {
        title: "Pick the exact spot",
        body: "On the details card, search a place or address and tap the right result. Use this when Béa missed the pin, or when you typed a rec by hand. Near and trip directions need that spot.",
        selector: "[data-guide='reco-location']",
      },
      {
        title: "Share places with someone",
        body: "Under the + at the top, Send places lets you tick a few saved places and Béa makes a code you can send; Open a share takes in one sent to you. Whoever opens it keeps the ones they want, with your name on them. They never see the rest of your vault, and your own notes stay private unless you tick the box.",
        selector: "[data-guide='reco-add']",
      },
      {
        title: "Your vault",
        body: "Your collections — Recommendations, Wishlist, Next time — and what you saved most recently. Open one to see who recommended it, the note you left, and the travel tags Béa guessed.",
        selector: "[data-guide='reco-list']",
      },
    ],
  },
  "/help": {
    name: "Help",
    about: "Answers about Béa, grouped by topic.",
    features: [
      "Open any question to read the answer",
      "Find the prompt to use when another assistant writes your plan",
      "Replay the tour from You → About Béa",
    ],
    steps: [
      {
        title: "Welcome to Béa",
        body: "A conversation, not a manual — start here, then open any question. The ? at the top right of any page says what that page does, and can walk you around it.",
        selector: "[data-guide='help-faq']",
      },
    ],
  },
  "/profile": {
    name: "You",
    about: "Your profile, your preferences, and how Béa works for you.",
    features: [
      "Edit your name, photo, home city and travel tags",
      "Set travel preferences: style, pace, budget, interests and diet",
      "Keep reusable packing lists",
      "Choose Béa's personality and how much she suggests",
      "Change the theme and what Home shows (Appearance)",
      "Import photos, open the calendar, load sample data (Data & imports)",
      "Send feedback, read privacy and terms, replay the tour (About Béa)",
    ],
    steps: [
      {
        title: "Your account",
        body: "Your name, home city, and how many trips and places you've saved. Edit profile changes them; everything stays synced across your phone and laptop.",
        selector: "[data-guide='profile-account']",
      },
      {
        title: "Settings",
        body: "Your name, home city and travel tags. Travel preferences, just below, holds your style, pace and budget — what Béa plans with. Appearance, further down, sets the theme and what Home shows.",
        selector: "[data-guide='profile-settings']",
      },
      {
        title: "Replay the tour",
        body: "About Béa holds How Béa works, the quick walk and the Deep Dive. Sample travel data is under Data & imports — Béa will not load either until you ask.",
        selector: "[data-guide='replay-tour']",
      },
      {
        title: "Customize home",
        body: "Under Appearance: hide Weather, Trips, Saved places or the Future me note on Home. Saved on this device.",
        selector: "[data-guide='home-customize']",
      },
      {
        title: "Packing lists",
        body: "Reusable templates — weekend, beach, ski, work. Attach a copy to a trip; ticking things off stays on that trip only.",
        selector: "[data-guide='packing-lists']",
      },
      {
        title: "Data & imports",
        body: "Import photos, open the trip calendar, load or remove sample data, and see what is kept on this phone. Béa needs a connection to open; trip settings → Saved directions keeps the steps between stops here so you do not fetch them twice.",
        selector: "[data-guide='offline-options']",
      },
      {
        title: "Legal and copyright",
        body: "Privacy policy, terms, and a note that Béa is Mathilde E. Larochelle's work. You keep what you save in it.",
        selector: "[data-guide='legal']",
      },
      {
        title: "Feedback",
        body: "Always yours. Pick a category — it broke, a missing stat, a wish, the map has opinions — then write it. If Béa dropped the ball, throw it back.",
        selector: "[data-guide='feedback']",
      },
    ],
  },
  "/preferences": {
    name: "Travel preferences",
    about: "How you like to travel. Béa plans, ranks and suggests with these.",
    features: [
      "Pick your travel styles",
      "Set budget and currency",
      "Choose a daily pace: slow, balanced or full",
      "List countries you love",
      "Choose interests, the same tags your saved places carry",
      "Add hard rules: diet, allergies, mobility, anything you refuse",
    ],
    steps: [
      {
        title: "Travel style",
        body: "Comfort seeker, explorer, food led — pick as many as feel true. Plan with Béa reads these.",
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
        body: "The same tags that land on your recs. They weight Near and Plan with Béa.",
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
    about: "Bring your travel photos in, so Béa can place them on your map.",
    features: [
      "Import photos from your phone",
      "Béa reads where each one was taken and groups them by city",
      "Keep the pictures, or keep only their locations",
      "Read the privacy note before anything uploads",
    ],
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
    about: "A page for each city you've photographed, across every visit.",
    features: [
      "See each city's visits and photos",
      "Leave Future Me notes for the next time you're there",
      "Play your story: the cities in the order you were there",
      "Import more photos any time",
    ],
    steps: [
      {
        title: "A page per city",
        body: "Photos are grouped by city and visit. Import more any time, or play your story — the cities in the order you were there.",
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
    about: "Your travel life played back, city by city, from your photos.",
    features: [
      "Play, pause or skip through your cities in order",
      "It fills in once you import photos",
    ],
    steps: [
      {
        title: "Play it back",
        body: "The cities you've photographed, in the order you were there. Play, pause, or skip a stop. This is a story of places you already lived, not a new itinerary. It fills in once you import photos.",
        selector: "[data-guide='story-play']",
      },
    ],
  },
  "/profile/bea": {
    name: "Your Béa",
    about: "Béa's personality, and how much she suggests and helps.",
    features: [
      "Choose a preset, or set the mix of traits yourself",
      "Preview how your Béa sounds, and ask for new examples",
      "Turn her quirks on or off: asides, rare surprises, reactions",
    ],
    steps: [],
  },
  "/profile/documents": {
    name: "Trip documents",
    about:
      "Bookings, tickets and confirmations, encrypted on your device and locked with a passcode.",
    features: [
      "Add a PDF, photo or file for a trip",
      "Fill in from this file: Béa reads the booking and fills the form (only when you tap it)",
      "Search, sort and choose which documents to show",
      "Lock Trip documents behind Face ID, fingerprint or your passcode on this device",
    ],
    steps: [],
  },
  "/calendar": {
    name: "Calendar",
    about: "Every trip on one calendar.",
    features: [
      "See trips, flights, hotels and reservations month by month",
      "Tap a day to see what's on it",
    ],
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
    about: "Travel spending, from the receipt to the spreadsheet.",
    features: [
      "Photograph a receipt; Béa reads the merchant and amount",
      "Tag the trip so it counts toward that budget",
      "Download a spreadsheet of every expense in your home currency",
    ],
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
