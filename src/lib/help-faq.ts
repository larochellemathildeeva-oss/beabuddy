export type Faq = { q: string; a: string };

export const HELP_FAQ_GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What is Béa?",
        a: "Béa is one place for everything about your travels: the map of where you've been and where you want to go, your trips and their timelines, the places people recommend to you, your photos, your documents and your receipts. She can also help you choose between pins, plan a trip or a day out from your recs, and keep packing lists and travel preferences for next time.",
      },
      {
        q: "Do I need an account?",
        a: "Yes, to keep anything. An account means your pins, trips, recommendations and photos are saved to you and follow you onto any phone or laptop.",
      },
      {
        q: "What's the difference between Ask Béa and Let Béa plan?",
        a: "Ask Béa is the sparkle at the top of a page — it highlights each part of that screen and explains it. Let Béa plan is the sparkle on a trip card: it builds or imports a day-by-day itinerary onto that trip. The welcome tour lives in Profile settings — you pick a quick walk around the block, or a Deep Dive through every feature.",
      },
      {
        q: "How do I get a tour of a page?",
        a: "Tap Ask Béa (the sparkle) at the top of any page. Béa highlights each part of that page and explains what it does. You can also replay the welcome tour from Profile settings and choose the short walk or the Deep Dive.",
      },
      {
        q: "What's the difference between the quick walk and the Deep Dive?",
        a: "The welcome tour asks first. A quick walk around the block is the highlights — Home, World, trips, Near, photos, You. The Deep Dive goes through every feature and explains it: pin filters, travel stats, adding a city by hand, travel tags, Flying Solo, Optimize, day trips, packing, offline directions, legal, the lot. Replay from Profile settings any time and pick again.",
      },
      {
        q: "How do I customize what shows on Home?",
        a: "On You → Profile settings, open Customize home. You can hide the trip card, the Travel story and City memories shortcuts, Waiting for you, Recent memories, or a Future Me note. The choice is saved on this device.",
      },
      {
        q: "How do I set the travel preferences Béa plans with?",
        a: "Open You → Profile settings → Travel preferences, or go to the Travel preferences page. Style, budget, pace, interests (travel tags), favourite countries, dietary notes and things to avoid all go into Let Béa plan, Optimize and Plan a day trip.",
      },
      {
        q: "How do I tell Béa I want something new?",
        a: "On You, open the Feedback banner at the bottom. Pick a category — it broke, a missing travel stat, a wish, something unhinged in a plan, the map has opinions, or something nice — then write it. If Béa dropped the ball, this is where you throw it back. What you write is saved so we can read it. The welcome tour also stops here so you know where it lives.",
      },
    ],
  },
  {
    title: "Trips & planning",
    items: [
      {
        q: "How do I let Béa plan a trip?",
        a: "Open a trip — or tap the sparkle on the trip card — and choose Let Béa plan. You can build a new day-by-day plan from your saved travel preferences and the travel tags on your recs, import a photo or pasted itinerary, optimize the stops you already have, or compare two drafts side by side. Approximate costs stay off unless you switch them on. After a draft, tick the stops you want swapped and ask Béa for alternatives, or use Rebuild my trip to start the whole plan again. Tick the stops you want and save them onto that trip's timeline. Béa does not book hotels, restaurants or tickets, and she cannot check whether something is actually free — you reserve and confirm those yourself.",
      },
      {
        q: "Does Béa book restaurants or hotels?",
        a: "No. There is no booking connection — no OpenTable, hotel site or ticket desk. Béa can suggest a reservation on the timeline, but she cannot hold a table, check a room, or confirm a ticket. You book those yourself and treat anything she wrote as a draft until you have.",
      },
      {
        q: "Can Béa rearrange a trip I already planned?",
        a: "Yes. Open the trip and tap Optimize, or open Let Béa plan and choose Optimize. Pick what matters — closest together, rainy-day indoor activities, easy mornings, a rest day, even pace, or meals first — and Béa reshuffles the existing timeline. You review the new order before anything is saved. Flights, hotels and reservations stay put unless they have to move.",
      },
      {
        q: "Can Béa turn nearby recs into a day trip?",
        a: "Yes. On Near, share your location, tick two or more saved places, pick today's pace (and any preferences you want to lean into), then Arrange with Béa. She orders them for one day using your saved travel preferences. Review the draft, then save it as a trip — nothing is booked.",
      },
      {
        q: "Can one trip cover several countries?",
        a: "Yes. Inside a trip, 'Where you're going' holds every city with its arrival and leaving dates, in the order you'll travel. Stops can be marked as layovers too.",
      },
      {
        q: "How do I join a trip someone shared?",
        a: "On Trips, tap Join with a code and type the invite code. You'll land in that folder and can edit the timeline, stops and budget with everyone else.",
      },
      {
        q: "Can someone else edit my trip?",
        a: "Yes. Share the trip's invite code and whoever joins can add to the timeline, the budget and the stops. You'll see their changes as they make them. A trip with only you says Flying Solo until someone joins.",
      },
      {
        q: "What does Flying Solo mean?",
        a: "It means nobody else is on that trip yet — just you. Invite someone with a code when you want company on the plan. Béa never labels you as a generic Traveller.",
      },
      {
        q: "Do I have to track a budget?",
        a: "No. When you create a trip, the budget box is off unless you tick it. You can turn a budget on or off later in trip settings. Claiming a receipt on Expenses only updates a trip that has a budget on.",
      },
      {
        q: "Can I still change a trip after I create it?",
        a: "Yes. Dates, cities, friends, packing and the budget stay editable. Creating a trip is a first draft of a holiday, not a boarding pass.",
      },
      {
        q: "What does Tentative mean on the dates?",
        a: "When you pick dates you can mark them Tentative or Confirmed. Tentative stays on the trip card and Home until you know the flights are real. You can flip it later in trip settings.",
      },
      {
        q: "How do packing lists work?",
        a: "On You, open Create packing lists and build reusable templates — weekend, beach, ski, work. When you create a trip, or later from the paper icon on the trip, attach a copy. Ticking things off only affects that trip.",
      },
      {
        q: "How do I get walking or driving directions?",
        a: "Open a trip and tap Get directions between the cities. After they arrive you can add those legs to the timeline. Turn-by-turn stays on this phone only if you download Offline directions in trip settings.",
      },
      {
        q: "How do I delete a trip?",
        a: "Open the trip and choose 'Delete trip'. Béa asks you to confirm first, because the timeline, stops, budget and invites go with it.",
      },
    ],
  },
  {
    title: "Map, pins & recommendations",
    items: [
      {
        q: "What do the pin colours mean?",
        a: "Visited is where you've been, Next time is somewhere you nearly made it, Wishlist is a dream, and Recommendation is a place someone told you about.",
      },
      {
        q: "How do I hide some pins?",
        a: "On World, the chips above the globe hide and show whole groups — visited, next time, wishlist, recommendations — so a busy map calms down in one tap.",
      },
      {
        q: "Can I choose which travel stats Béa shows?",
        a: "Yes. On World, open Travel statistics and tap Choose stats. Turn counters on or off, and switch Countries as a world share to see how many of the 195 widely recognised countries you have visited — for example 1 of 195, or 1%. If you want a number Béa does not count yet, tell her on You → Feedback.",
      },
      {
        q: "What is the heatmap?",
        a: "On World, switch the heatmap on to see where you've spent the most time as a warm cloud instead of dots. Toggle between days (how long you stayed) and photos (how many pictures you imported).",
      },
      {
        q: "How do I add cities I already visited?",
        a: "On World, open Add a city by hand — now labelled Add cities or countries. Type one place, or paste / upload a list of cities or countries from your notes. Country names are recognised straight away. Other names are looked up so you can pick the pin before anything is saved to the globe. If one name is not recognised, tap Correct it, type the usual country or city name, and look that one up again. Those places count in your travel stats too.",
      },
      {
        q: "Where do recommendations come from?",
        a: "You can type one in, paste a link, search the web, pin a place on the nearby map, save where you're standing, or paste / upload a list. The list can be names from your notes, a photo, a file, or a page of things to do — Béa reads the page and picks up the suggestions. You review each one, edit the name, note or category, pick the right pin, then save. On the details card you can search and pick the exact map spot yourself if Béa missed it or you typed the rec by hand. She also guesses travel tags from the place — Museums, Coffee shops, and so on — so Let Béa plan can pick recs that match what you like.",
      },
      {
        q: "What are travel tags?",
        a: "Tags on a saved rec — Museums, Coffee shops, Parks, Nightlife — describe what the place is. Béa guesses them when you save, and you can change them. Let Béa plan and Plan a day trip lean on those tags plus your travel preferences.",
      },
      {
        q: "Does search need the exact spelling?",
        a: "No. Searching your vault or a place name still finds a match if a letter is off, doubled, or missing — café and cafe both work.",
      },
    ],
  },
  {
    title: "Photos & memories",
    items: [
      {
        q: "Does importing photos use up space?",
        a: "Only if you want it to. When you import, choose 'Locations only' and Béa reads where each picture was taken to drop a pin, then keeps nothing at all.",
      },
      {
        q: "Who can see my photos?",
        a: "Only you. Photos live in your private storage and are served to you through short-lived private links.",
      },
      {
        q: "What is Travel story?",
        a: "On Home, tap Travel story — or open it from the Playback shortcut. Béa plays the cities you've photographed, in the order you were there. Play, pause, or skip a stop. It is a story of places you already lived, not a new itinerary.",
      },
      {
        q: "What is a Future Me note?",
        a: "On a city memory page, leave a note to your future self — a bakery, a warning, a secret garden. Béa hands it back when you open that city again.",
      },
    ],
  },
  {
    title: "Documents & privacy",
    items: [
      {
        q: "How safe is the document vault?",
        a: "Documents are scrambled on your own device with a passphrase only you know before they ever leave it. Without your passphrase nobody — including us — can read them.",
      },
      {
        q: "What if I forget my vault passphrase?",
        a: "It can't be recovered, by design. You'd need to reset the vault and add the documents again.",
      },
      {
        q: "Who owns Béa?",
        a: "Béa — the app, its name, design, features and original ideas — is Mathilde E. Larochelle's work. You keep what you save in it. The copyright notice lives under You → Legal, privacy and such, next to the privacy policy and the terms.",
      },
    ],
  },
  {
    title: "Receipts & expenses",
    items: [
      {
        q: "Is the expense report an official document?",
        a: "No. Béa helps you stay organised and nothing more. It is not tax advice and not an official record — always check figures with your accountant or tax authority.",
      },
      {
        q: "Can I send my expenses to accounting?",
        a: "Yes. Export a spreadsheet from the receipts page with every amount, date, category and its value in your home currency. Photograph a receipt and Béa can read the merchant and amount; you can still fill it in by hand. Tag a trip so the spend lands on that budget.",
      },
    ],
  },
  {
    title: "Appearance & offline",
    items: [
      {
        q: "How do I switch to dark mode?",
        a: "Open You → Profile settings. The switch is labelled Light or Dark mode: warm cream by day, black and light grey at night. Béa remembers the choice on this phone.",
      },
      {
        q: "Does Béa work without signal?",
        a: "Not as a full offline app. Maps, photos, recommendations, itineraries and the vault still need a connection — the Download list on You was only a toggle, and it did not save those. What does work: on a trip, Settings → Offline directions keeps the walk or drive steps on this phone. You → Offline options lists every trip that already has those steps saved here. Get directions can also add each leg to the timeline.",
      },
    ],
  },
];
