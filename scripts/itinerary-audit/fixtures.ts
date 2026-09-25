/**
 * Ten short itineraries for auditing "I already have a plan".
 *
 * Each is written the way people actually paste plans — a tidy list, a blog
 * paragraph, a WhatsApp thread, another language — and each carries one or
 * two traps Béa has fallen into before or plausibly could. `expect` is the
 * answer a careful human would give; `audit.mjs` scores Béa against it.
 */

export type Fixture = {
  id: string;
  /** What the fixture is testing, in a few words. */
  traps: string[];
  tripCity: string;
  startDate: string | null;
  text: string;
  expect: {
    days: number;
    /** Stops a person would see on the timeline, give or take one. */
    stops: number;
    /** Every clock time the source gives a stop, as HH:MM. */
    times: string[];
    /** How many stops the source marks as booked. */
    booked: number;
    /** Titles that must survive, matched loosely. */
    mustInclude: string[];
    /** Addresses given in the source, which must come back verbatim. */
    addresses?: string[];
    /** Plans the source drops or cancels, which must not be stops. */
    mustExclude?: string[];
    /**
     * Where a stop must be pinned: the stop that mentions `match` must have
     * a place containing `place` (the restaurant, not the street it is on).
     */
    pins?: { match: string; place: string }[];
  };
};

export const FIXTURES: Fixture[] = [
  {
    id: "paris-tidy",
    traps: ["baseline: tidy 24h list"],
    tripCity: "Paris, France",
    startDate: "2026-10-10",
    text: `Paris — Saturday
08:30 Breakfast at Café de Flore
10:00 Musée d'Orsay (tickets booked, conf #ORS-55821)
13:00 Lunch at Bouillon Chartier, 7 Rue du Faubourg Montmartre
15:00 Walk along the Seine to Île de la Cité
16:00 Sainte-Chapelle
19:30 Dinner at Le Comptoir du Relais`,
    expect: {
      days: 1,
      stops: 6,
      times: ["08:30", "10:00", "13:00", "15:00", "16:00", "19:30"],
      booked: 1,
      mustInclude: ["Café de Flore", "Orsay", "Chartier", "Sainte-Chapelle", "Comptoir"],
      addresses: ["7 Rue du Faubourg Montmartre"],
    },
  },
  {
    id: "tokyo-days-ampm",
    traps: ["Day 1/Day 2 with no dates", "am/pm", "travel legs as their own lines", "✅ booked"],
    tripCity: "Tokyo, Japan",
    startDate: null,
    text: `Day 1
9am - Tsukiji Outer Market breakfast
11am - Take the Hibiya line to Ginza
11:30am - Ginza Six rooftop
2pm - teamLab Planets ✅
6:30pm - Omoide Yokocho for yakitori

Day 2
8am - Meiji Jingu
10am - Walk to Harajuku, Takeshita Street
1pm - Lunch at Afuri Ebisu
4pm - Shibuya Sky ✅ (sunset slot)
8pm - Golden Gai`,
    expect: {
      days: 2,
      stops: 9,
      times: [
        "09:00",
        "11:00",
        "11:30",
        "14:00",
        "18:30",
        "08:00",
        "10:00",
        "13:00",
        "16:00",
        "20:00",
      ],
      booked: 2,
      mustInclude: [
        "Tsukiji",
        "Ginza Six",
        "teamLab",
        "Omoide",
        "Meiji",
        "Takeshita",
        "Afuri",
        "Shibuya Sky",
        "Golden Gai",
      ],
    },
  },
  {
    id: "lisbon-blog",
    traps: [
      "blog prose, no clock times",
      "morning/afternoon/evening",
      "several places per sentence",
    ],
    tripCity: "Lisbon, Portugal",
    startDate: "2026-05-02",
    text: `One perfect day in Lisbon. Start your morning with a pastel de nata at Manteigaria in Chiado — they come out warm every half hour. From there, hop on the famous Tram 28 up to Alfama and get lost in the lanes around the Sé Cathedral before climbing to Miradouro de Santa Luzia for the view.

In the afternoon, head down to Belém: the Jerónimos Monastery is unmissable (buy tickets online, the queue is brutal), and yes, you should try the original pastéis at Pastéis de Belém even if you already had one.

Evening is for Bairro Alto. Grab dinner at Cervejaria Ramiro for seafood, then finish with fado at Tasca do Chico.`,
    expect: {
      days: 1,
      stops: 8,
      times: [],
      booked: 0,
      mustInclude: [
        "Manteigaria",
        "Sé",
        "Santa Luzia",
        "Jerónimos",
        "Pastéis de Belém",
        "Ramiro",
        "Tasca do Chico",
      ],
    },
  },
  {
    id: "nyc-dates-ranges",
    traps: ["weekday + month dates", "time ranges", "confirmation numbers", "duration"],
    tripCity: "New York, USA",
    startDate: "2026-11-14",
    text: `Sat Nov 14
- 9:00–10:30 Breakfast at Russ & Daughters, 179 E Houston St
- 11:00–13:00 Tenement Museum tour (booked, ref TM-20931)
- 14:00 Brooklyn Bridge walk (about 1h)
- 16:00 DUMBO, Jane's Carousel
- 19:00 Dinner, Lilia — reservation confirmed #8843

Sun Nov 15
- 10:00 The Met (3h)
- 14:00 Central Park, Bethesda Terrace
- 17:30 Top of the Rock
- 20:00 Broadway: Hamilton, Richard Rodgers Theatre (tickets booked)`,
    expect: {
      days: 2,
      stops: 9,
      times: ["09:00", "11:00", "14:00", "16:00", "19:00", "10:00", "14:00", "17:30", "20:00"],
      booked: 3,
      mustInclude: [
        "Russ & Daughters",
        "Tenement",
        "Brooklyn Bridge",
        "Carousel",
        "Lilia",
        "Met",
        "Bethesda",
        "Top of the Rock",
        "Hamilton",
      ],
      addresses: ["179 E Houston St"],
      pins: [{ match: "Hamilton", place: "Richard Rodgers" }],
    },
  },
  {
    id: "kyoto-slashes-rough",
    traps: ["~ rough times", "A / B multi-place lines", "Japanese names in brackets"],
    tripCity: "Kyoto, Japan",
    startDate: "2026-10-04",
    text: `Kyoto day
~7:00 Fushimi Inari Taisha (伏見稲荷大社) — go early, before the crowds
~9:30 Tofuku-ji / Komyo-in
12:00 Lunch: Nishiki Market (錦市場)
14:00 Kiyomizu-dera + Sannenzaka + Ninenzaka
~17:00 Yasaka Shrine
18:30 Gion, Hanamikoji Street, maybe spot a geiko
20:00 Dinner at Pontocho (booked, Kyoto Gion Yuki)`,
    expect: {
      days: 1,
      stops: 7,
      times: ["07:00", "09:30", "12:00", "14:00", "17:00", "18:30", "20:00"],
      booked: 1,
      mustInclude: [
        "Fushimi Inari",
        "Tofuku",
        "Komyo-in",
        "Nishiki",
        "Kiyomizu",
        "Sannenzaka",
        "Yasaka",
        "Hanamikoji",
        "Pontocho",
      ],
      pins: [{ match: "Yuki", place: "Yuki" }],
    },
  },
  {
    id: "barcelona-spanish",
    traps: ["Spanish source", "13h30 and 19h time styles", "Día 1 / Día 2"],
    tripCity: "Barcelona, Spain",
    startDate: "2026-06-20",
    text: `Día 1
9h30 Sagrada Família (entradas compradas ✅)
12h Paseo por el Eixample, Casa Batlló por fuera
13h30 Comida en Cervecería Catalana
16h Park Güell (reservado)
20h30 Cena en El Xampanyet, Born

Día 2
10h Mercat de la Boqueria
11h30 Barrio Gótico y la Catedral
14h Playa de la Barceloneta, comida en La Cova Fumada
19h Búnkers del Carmel para la puesta de sol`,
    expect: {
      days: 2,
      stops: 9,
      times: ["09:30", "12:00", "13:30", "16:00", "20:30", "10:00", "11:30", "14:00", "19:00"],
      booked: 2,
      mustInclude: [
        "Sagrada",
        "Batlló",
        "Cervecería Catalana",
        "Güell",
        "Xampanyet",
        "Boqueria",
        "Gótic",
        "Barceloneta",
        "Cova Fumada",
        "Búnkers",
      ],
      pins: [{ match: "Cova Fumada", place: "Cova Fumada" }],
    },
  },
  {
    id: "rome-emoji",
    traps: ["emoji-heavy", "prices in the text", "🎟️ booked"],
    tripCity: "Rome, Italy",
    startDate: "2026-04-18",
    text: `ROME IN A DAY 🇮🇹✨
☕ 8:00 cornetto @ Sant'Eustachio Il Caffè
🏛️ 9:00 Colosseum + Roman Forum 🎟️ booked (€24)
🍕 12:30 Pizza at Forno Campo de' Fiori (€8)
⛲ 14:30 Trevi Fountain → Spanish Steps
🏛️ 16:00 Pantheon (€5)
🍝 20:00 Cacio e pepe at Da Enzo al 29, Trastevere 🎟️ booked`,
    expect: {
      days: 1,
      stops: 6,
      times: ["08:00", "09:00", "12:30", "14:30", "16:00", "20:00"],
      booked: 2,
      mustInclude: [
        "Sant'Eustachio",
        "Colosseum",
        "Roman Forum",
        "Forno",
        "Trevi",
        "Spanish Steps",
        "Pantheon",
        "Da Enzo",
      ],
    },
  },
  {
    id: "cdmx-chat",
    traps: ["WhatsApp thread", "9ish / noon", "a cancelled plan", "chit-chat"],
    tripCity: "Mexico City, Mexico",
    startDate: "2026-03-07",
    text: `[07/03, 21:14] Ana: ok so saturday: breakfast at Panadería Rosetta 9ish?
[07/03, 21:15] Me: yes!! then Frida Kahlo museum, we have tickets for 11:00
[07/03, 21:15] Ana: amazing. lunch at noon-ish in Coyoacán market
[07/03, 21:16] Me: then Xochimilco boats in the afternoon? like 3pm
[07/03, 21:18] Ana: hmm actually skip Xochimilco it's too far, let's do Chapultepec Castle instead at 3
[07/03, 21:19] Me: ok 👍 and dinner Contramar 8pm, I booked it
[07/03, 21:30] Ana: sunday Teotihuacan balloon at 5am!!! 🎈 booked
[07/03, 21:31] Me: lol ok then tacos at El Huequito when we're back, 2pm`,
    expect: {
      days: 2,
      stops: 7,
      times: ["09:00", "11:00", "12:00", "15:00", "20:00", "05:00", "14:00"],
      booked: 3,
      mustInclude: [
        "Rosetta",
        "Frida Kahlo",
        "Coyoacán",
        "Chapultepec",
        "Contramar",
        "Teotihuacan",
        "Huequito",
      ],
      mustExclude: ["Xochimilco"],
    },
  },
  {
    id: "london-bookings",
    traps: ["flight + hotel + train with codes", "check-in time", "arrivals", "duration"],
    tripCity: "London, UK",
    startDate: "2026-09-12",
    text: `Sat 12 Sep
07:45 Land LHR T5 — BA 94 from Toronto (booking ref QX7KLM)
10:30 Drop bags at The Hoxton, Holborn, 199-206 High Holborn (check-in from 15:00, conf 44781093)
11:30 British Museum (2h)
14:00 Lunch at Dishoom Covent Garden
16:00 Tate Modern
19:00 Dinner at Padella, Borough Market

Sun 13 Sep
09:00 Columbia Road Flower Market
12:31 Eurostar 9O 9031 London St Pancras → Paris Gare du Nord (booked, seat 64, coach 11)`,
    expect: {
      days: 2,
      stops: 8,
      times: ["07:45", "10:30", "11:30", "14:00", "16:00", "19:00", "09:00", "12:31"],
      booked: 3,
      mustInclude: [
        "BA 94",
        "Hoxton",
        "British Museum",
        "Dishoom",
        "Tate Modern",
        "Padella",
        "Columbia Road",
        "Eurostar",
      ],
      addresses: ["199-206 High Holborn"],
    },
  },
  {
    id: "miyajima-daytrip",
    traps: [
      "day trip away from the trip city",
      "ferry legs",
      "'be at … by' reminders",
      "date without a year",
    ],
    tripCity: "Hiroshima, Japan",
    startDate: "2026-10-05",
    text: `Oct 5 — Miyajima day trip
08:10 JR Sanyo line Hiroshima → Miyajimaguchi
08:45 Be at the JR ferry pier by 08:45
09:10 Ferry to Miyajima
09:30 Itsukushima Shrine (厳島神社) + the floating torii
11:00 Daisho-in Temple
12:30 Lunch: anago-meshi at Ueno, Miyajimaguchi side (booked 12:30)
14:30 Mt Misen ropeway
18:00 Back in Hiroshima — okonomiyaki at Okonomimura`,
    expect: {
      days: 1,
      stops: 6,
      times: ["08:45", "09:30", "11:00", "12:30", "14:30", "18:00"],
      booked: 1,
      mustInclude: ["Itsukushima", "Daisho-in", "Ueno", "Misen", "Okonomimura"],
    },
  },
  {
    id: "sf-chat-us",
    traps: [
      "Android chat export with US dates (3/6/26)",
      "a booking cancelled and replaced",
      "'like 1' with no am/pm",
      "a stop mentioned out of order",
    ],
    tripCity: "San Francisco, USA",
    startDate: "2026-03-07",
    text: `3/6/26, 8:02 PM - Sam: ok SF plan for tomorrow
3/6/26, 8:03 PM - Sam: Tartine Bakery at 8:30 for breakfast?
3/6/26, 8:03 PM - Jo: yes. then Alcatraz, I got us the 10:30 ferry, tickets booked
3/6/26, 8:05 PM - Sam: lunch at the Ferry Building after, like 1
3/6/26, 8:07 PM - Jo: I booked State Bird Provisions for 7 but let's cancel, too pricey
3/6/26, 8:08 PM - Sam: fine, Zuni Café at 7:30 instead, I'll book it now
3/6/26, 8:12 PM - Jo: done, Zuni confirmed 7:30
3/6/26, 8:15 PM - Sam: oh and Lands End trail around 3:30 before dinner`,
    expect: {
      days: 1,
      stops: 5,
      times: ["08:30", "10:30", "13:00", "15:30", "19:30"],
      booked: 2,
      mustInclude: ["Tartine", "Alcatraz", "Ferry Building", "Lands End", "Zuni"],
      mustExclude: ["State Bird"],
    },
  },
  {
    id: "seoul-implied-bookings",
    traps: [
      "bookings said without 'booked' ('we have seats', 'got our passes')",
      "'no booking needed' is not booked",
      "a show at a named theatre",
    ],
    tripCity: "Seoul, South Korea",
    startDate: "2026-11-14",
    text: `Sat 14 Nov — Seoul
09:30 Gyeongbokgung Palace (free entry if you wear hanbok)
12:30 Lunch at Tosokchon Samgyetang (no booking needed, just queue)
14:30 Bukchon Hanok Village
16:00 N Seoul Tower — got our cable car passes already
19:00 NANTA at Myeongdong Theatre, we have seats in row F
21:30 Gwangjang Market for bindaetteok`,
    expect: {
      days: 1,
      stops: 6,
      times: ["09:30", "12:30", "14:30", "16:00", "19:00", "21:30"],
      booked: 2,
      mustInclude: ["Gyeongbokgung", "Tosokchon", "Bukchon", "Seoul Tower", "NANTA", "Gwangjang"],
      pins: [{ match: "NANTA", place: "Myeongdong Theatre" }],
    },
  },
];
