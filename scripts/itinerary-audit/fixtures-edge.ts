/**
 * The edge cases the outside review (Gemini, Sept 2026) said the audit never
 * tried: vague times, alternatives, places passed but not visited, an
 * overnight flight, stops outside the city, prices in the text, two branches
 * of one chain, a border town, and a plan too long for the old 60-stop cap.
 *
 *   node scripts/itinerary-audit/audit.mjs --fixtures edge
 */
import type { Fixture } from "./fixtures.ts";

/** Three weeks, seven stops a day: longer than the old 60-stop cap. */
function longPlan(): string {
  const days: string[] = [];
  const start = new Date("2026-05-01T00:00:00Z");
  for (let d = 0; d < 20; d++) {
    const date = new Date(start.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    days.push(`Day ${d + 1} — ${date} — Rome, Italy`);
    const stops = [
      "08:30 Breakfast at Sant'Eustachio Il Caffè, Piazza di Sant'Eustachio 82",
      "10:00 Pantheon",
      "12:00 Campo de' Fiori",
      "13:00 Lunch at Roscioli, Via dei Giubbonari 21",
      "15:00 Galleria Borghese — booked",
      "18:00 Spanish Steps",
      "20:00 Dinner at Armando al Pantheon, Salita de' Crescenzi 31",
    ];
    days.push(...stops);
  }
  return days.join("\n");
}

export const FIXTURES: Fixture[] = [
  {
    id: "florence-vague-times",
    traps: ["times given as parts of the day", "one clock time only"],
    tripCity: "Florence, Italy",
    startDate: "2026-05-12",
    text: `Florence, Tuesday May 12. Morning: Uffizi Gallery, give it three hours. Lunch around 1:30 PM at All'Antico Vinaio on Via dei Neri. Afternoon: cross the Ponte Vecchio and see Palazzo Pitti. Late evening: sunset at Piazzale Michelangelo.`,
    expect: {
      days: 1,
      stops: 5,
      times: ["13:30"],
      booked: 0,
      flights: 0,
      mustInclude: ["Uffizi", "Antico Vinaio", "Ponte Vecchio", "Pitti", "Michelangelo"],
    },
  },
  {
    id: "naples-alternatives",
    traps: ["an alternative in brackets", "a backup restaurant is not a second stop"],
    tripCity: "Naples, Italy",
    startDate: "2026-06-03",
    text: `Naples day
- 10:00 Naples National Archaeological Museum
- 12:30 Lunch at L'Antica Pizzeria da Michele (or Sorbillo if the line is too long)
- 15:00 Spaccanapoli walk
- 17:00 Castel dell'Ovo
- 20:00 Dinner at Trattoria Da Nennella, or Tandem if it's full`,
    expect: {
      days: 1,
      stops: 5,
      times: ["10:00", "12:30", "15:00", "17:00", "20:00"],
      booked: 0,
      flights: 0,
      mustInclude: [
        "Archaeological Museum",
        "Da Michele",
        "Spaccanapoli",
        "Castel dell'Ovo",
        "Nennella",
      ],
      mustExclude: ["Sorbillo", "Tandem"],
    },
  },
  {
    id: "rome-passed-not-visited",
    traps: ["walked past, did not go in", "skipped summit"],
    tripCity: "Rome, Italy",
    startDate: "2026-06-16",
    text: `What we did in Rome on Tuesday: 9am walked past the Colosseum (didn't go in, the line was huge), then 10am the Roman Forum for two hours. 1pm lunch at Trattoria Luzzi. 3pm Basilica of San Clemente — went down to the excavations. We were going to climb St Peter's dome at 5 but skipped it, too tired. 8pm dinner at Da Enzo al 29.`,
    expect: {
      days: 1,
      stops: 4,
      times: ["10:00", "13:00", "15:00", "20:00"],
      booked: 0,
      flights: 0,
      mustInclude: ["Roman Forum", "Luzzi", "San Clemente", "Da Enzo"],
      mustExclude: ["Colosseum", "St Peter"],
    },
  },
  {
    id: "overnight-flight",
    traps: ["flight lands the next day", "arrival day starts at the hotel"],
    tripCity: "Paris, France",
    startDate: "2026-10-11",
    text: `Day 1 — 2026-10-11 — Montréal, Canada → Paris, France
16:00 Dinner at Olive et Gourmando, 351 Rue Saint-Paul Ouest
18:30 Flight AC 870 from Montréal-Trudeau Airport to Paris-Charles de Gaulle Airport — lands next day 07:30; book ahead
Day 2 — 2026-10-12 — Paris, France
10:00 Check in at Hôtel des Grands Boulevards, 17 Boulevard Poissonnière
12:30 Lunch at Bouillon Chartier, 7 Rue du Faubourg Montmartre`,
    expect: {
      days: 2,
      stops: 4,
      times: ["16:00", "18:30", "10:00", "12:30"],
      booked: 0,
      flights: 1,
      toBook: 2,
      mustInclude: ["Olive et Gourmando", "AC 870", "Grands Boulevards", "Chartier"],
      cities: [
        { match: "Olive et Gourmando", city: "Montr" },
        { match: "AC 870", city: "Montr" },
        { match: "Chartier", city: "Paris" },
      ],
    },
  },
  {
    id: "paris-beauvais-disneyland",
    traps: ["an airport 80 km out", "a park outside the city's box", "a coach from the airport"],
    tripCity: "Paris, France",
    startDate: "2026-07-01",
    text: `Day 1 — 2026-07-01 — Paris, France
08:05 Land at Beauvais-Tillé Airport on FR 1234
09:00 Coach from Beauvais-Tillé Airport to Paris Porte Maillot
11:30 Check in at Hôtel Balzac, 6 Rue Balzac
13:00 Lunch at Le Relais de l'Entrecôte, 15 Rue Marbeuf
Day 2 — 2026-07-02 — Paris, France
09:00 Disneyland Park, Marne-la-Vallée — tickets booked
19:30 Dinner at Walt's – An American Restaurant, Disneyland Park`,
    expect: {
      days: 2,
      stops: 6,
      times: ["08:05", "09:00", "11:30", "13:00", "09:00", "19:30"],
      booked: 1,
      flights: 1,
      mustInclude: [
        "Beauvais",
        "Porte Maillot",
        "Balzac",
        "Entrecôte",
        "Disneyland Park",
        "Walt's",
      ],
    },
  },
  {
    id: "london-two-branches",
    traps: ["two branches of one chain the same day", "addresses tell them apart"],
    tripCity: "London, United Kingdom",
    startDate: "2026-09-05",
    text: `Saturday in London
09:30 British Museum, Great Russell Street
13:00 Lunch at Dishoom Covent Garden, 12 Upper St Martin's Lane
15:00 Tate Modern, Bankside
19:30 Dinner at Dishoom Shoreditch, 7 Boundary Street — the other branch, for the courtyard`,
    expect: {
      days: 1,
      stops: 4,
      times: ["09:30", "13:00", "15:00", "19:30"],
      booked: 0,
      flights: 0,
      mustInclude: ["British Museum", "Dishoom Covent Garden", "Tate Modern", "Dishoom Shoreditch"],
      addresses: ["12 Upper St Martin's Lane", "7 Boundary Street"],
    },
  },
  {
    id: "barcelona-prices",
    traps: ["prices in the line", "a booked tasting menu"],
    tripCity: "Barcelona, Spain",
    startDate: "2026-04-18",
    text: `Barcelona — Saturday
10:00 Casa Batlló, Passeig de Gràcia 43 — €35 each, tickets booked
13:30 Lunch at Cervecería Catalana, Carrer de Mallorca 236 — around €25 pp
17:00 Park Güell — €10
20:30 Tasting menu at Disfrutar, Carrer de Villarroel 163 (255€ pp, booked)`,
    expect: {
      days: 1,
      stops: 4,
      times: ["10:00", "13:30", "17:00", "20:30"],
      booked: 2,
      flights: 0,
      mustInclude: ["Casa Batlló", "Cervecería Catalana", "Park Güell", "Disfrutar"],
      addresses: ["Passeig de Gràcia 43", "Carrer de Mallorca 236", "Carrer de Villarroel 163"],
      mustExclude: ["€", "255"],
    },
  },
  {
    id: "niagara-both-sides",
    traps: ["one town name on both sides of a border"],
    tripCity: "Niagara Falls, Canada",
    startDate: "2026-08-14",
    text: `Day 1 — 2026-08-14 — Niagara Falls, Ontario, Canada
09:00 Journey Behind the Falls, 6650 Niagara Parkway
11:00 Clifton Hill
13:00 Lunch at Queen Victoria Place Restaurant, 6345 Niagara Parkway
15:00 Cross the Rainbow Bridge to Niagara Falls, New York, USA
15:30 Cave of the Winds, Goat Island, Niagara Falls State Park
18:00 Old Fort Niagara, Youngstown, New York`,
    expect: {
      days: 1,
      stops: 5,
      times: ["09:00", "11:00", "13:00", "15:00", "15:30", "18:00"],
      booked: 0,
      flights: 0,
      mustInclude: [
        "Journey Behind the Falls",
        "Clifton Hill",
        "Queen Victoria",
        "Cave of the Winds",
        "Old Fort Niagara",
      ],
    },
  },
  {
    id: "rome-three-weeks",
    traps: ["140 stops: over the old 60-stop cap"],
    tripCity: "Rome, Italy",
    startDate: "2026-05-01",
    text: longPlan(),
    expect: {
      days: 20,
      stops: 140,
      times: Array.from({ length: 20 }, () => [
        "08:30",
        "10:00",
        "12:00",
        "13:00",
        "15:00",
        "18:00",
        "20:00",
      ]).flat(),
      booked: 20,
      flights: 0,
      mustInclude: ["Sant'Eustachio", "Roscioli", "Galleria Borghese", "Armando al Pantheon"],
    },
  },
];
