/**
 * Five day trips around the world, written after 6.7.4 shipped and never
 * tuned against: each has a hotel, and most a flight in or out, as a
 * traveller's own plan would. In the format Béa's prompt for other
 * assistants asks for (ai-plan-prompt.ts).
 *
 *   node scripts/itinerary-audit/audit.mjs --fixtures world
 */
import type { Fixture } from "./fixtures.ts";

export const FIXTURES: Fixture[] = [
  {
    id: "capetown-arrival-peninsula",
    traps: [
      "landing then hotel",
      "drive down the peninsula and back",
      "Afrikaans and English names",
    ],
    tripCity: "Cape Town, South Africa",
    startDate: "2026-11-02",
    text: `Day 1 — 2026-11-02 — Cape Town, South Africa
07:10 Arrive at Cape Town International Airport
09:00 Check in at The Silo Hotel, Silo Square — drop bags
10:00–12:00 Table Mountain Aerial Cableway, Tafelberg Road — book ahead; check the wind
13:00 Lunch at The Pot Luck Club, 373-375 Albert Road — small plates
15:00 Boulders Beach (getting there: drive, 50 min) — penguins
16:30 Cape Point — lighthouse walk
19:30 Dinner at Harbour House, Kalk Bay Harbour — fish of the day`,
    expect: {
      days: 1,
      stops: 7,
      times: ["07:10", "09:00", "10:00", "13:00", "15:00", "16:30", "19:30"],
      booked: 0,
      flights: 1,
      toBook: 2,
      mustInclude: [
        "Cape Town International",
        "Silo Hotel",
        "Table Mountain",
        "Pot Luck",
        "Boulders",
        "Cape Point",
        "Harbour House",
      ],
      addresses: ["373-375 Albert Road"],
      kinds: [{ match: "Silo Hotel", kind: ["lodging", "hotel"] }],
    },
  },
  {
    id: "reykjavik-golden-circle-flight-out",
    traps: [
      "Icelandic letters",
      "a drive of 250 km in one day",
      "flight home at night",
      "check out first",
    ],
    tripCity: "Reykjavík, Iceland",
    startDate: "2026-09-20",
    text: `Day 5 — 2026-09-24 — Reykjavík, Iceland → Toronto, Canada
07:30 Check out at Canopy by Hilton Reykjavik City Centre, Smiðjustígur 4
09:00–10:30 Þingvellir National Park (getting there: drive, 45 min) — walk the Almannagjá gorge
11:30 Geysir — Strokkur erupts every few minutes
12:30 Lunch at Geysir Glíma — lamb soup
13:30 Gullfoss
15:30 Kerið crater
18:00 Arrive at Keflavík International Airport
20:15 Flight FI 603 from Keflavík International Airport to Toronto Pearson Airport`,
    expect: {
      days: 1,
      stops: 7,
      times: ["07:30", "09:00", "11:30", "12:30", "13:30", "15:30", "18:00", "20:15"],
      booked: 0,
      flights: 1,
      toBook: 1,
      mustInclude: ["Canopy", "Þingvellir", "Geysir", "Gullfoss", "Kerið", "Keflavík"],
      addresses: ["Smiðjustígur 4"],
      cities: [{ match: "Flight FI 603", city: "Reykjav|Kefla" }],
    },
  },
  {
    id: "sydney-blue-mountains",
    traps: ["day trip by train and back", "hotel booked", "lookout named for a rock formation"],
    tripCity: "Sydney, Australia",
    startDate: "2026-10-18",
    text: `Day 2 — 2026-10-19 — Sydney, Australia
07:00 Breakfast at Park Hyatt Sydney, 7 Hickson Road — booked
08:18 Train from Sydney Central Station to Katoomba Station — Blue Mountains Line
10:30 Echo Point Lookout — the Three Sisters
12:00–14:00 Scenic World, Violet Street — railway and skyway
14:30 Lunch at Leura Garage, 84 Railway Parade, Leura
16:47 Train from Katoomba Station back to Sydney Central Station
19:30 Dinner at Quay, Upper Level, Overseas Passenger Terminal — book ahead`,
    expect: {
      days: 1,
      stops: 7,
      times: ["07:00", "08:18", "10:30", "12:00", "14:30", "16:47", "19:30"],
      booked: 1,
      flights: 0,
      mustInclude: [
        "Park Hyatt",
        "Central Station",
        "Echo Point",
        "Scenic World",
        "Leura Garage",
        "Quay",
      ],
      addresses: ["7 Hickson Road", "84 Railway Parade"],
      cities: [
        { match: "Echo Point", city: "Katoomba" },
        { match: "Scenic World", city: "Katoomba" },
        { match: "Quay", city: "Sydney" },
      ],
    },
  },
  {
    id: "kyoto-nara-arrival",
    traps: [
      "landing at KIX then train to Kyoto",
      "day trip to Nara in the afternoon",
      "Japanese block addresses",
    ],
    tripCity: "Kyoto, Japan",
    startDate: "2026-11-10",
    text: `Day 1 — 2026-11-10 — Kyoto, Japan
06:40 Arrive at Kansai International Airport
07:30 Train from Kansai Airport Station to Kyoto Station — Haruka express, book ahead
09:00 Check in at The Thousand Kyoto (ザ・サウザンド京都), 570 Higashishiokojicho — drop bags until 15:00
10:30 Train from Kyoto Station to Kintetsu Nara Station — Kintetsu Limited Express
11:30 Todai-ji (東大寺), 406-1 Zoshicho — the Great Buddha
13:00 Lunch at Mellow Café (メロウカフェ), 1-8 Konishicho
14:30 Kasuga Taisha (春日大社), 160 Kasuganocho — lantern-lined paths
16:30 Train from Kintetsu Nara Station to Kyoto Station
19:00 Dinner at Pontocho (先斗町) — kaiseki and yakitori alleys`,
    expect: {
      days: 1,
      stops: 9,
      times: ["06:40", "07:30", "09:00", "10:30", "11:30", "13:00", "14:30", "16:30", "19:00"],
      booked: 0,
      flights: 1,
      mustInclude: [
        "Kansai International",
        "Thousand Kyoto",
        "Todai-ji",
        "Mellow",
        "Kasuga Taisha",
        "Pontocho",
      ],
      addresses: ["406-1 Zoshicho", "1-8 Konishicho", "160 Kasuganocho"],
      cities: [
        { match: "Thousand Kyoto", city: "Kyoto" },
        { match: "Todai-ji", city: "Nara" },
        { match: "Mellow", city: "Nara" },
        { match: "Kasuga", city: "Nara" },
        { match: "Pontocho", city: "Kyoto" },
      ],
    },
  },
  {
    id: "cusco-machu-picchu",
    traps: [
      "early train to Machu Picchu and back",
      "Spanish names and addresses",
      "hotel with a Spanish street",
    ],
    tripCity: "Cusco, Peru",
    startDate: "2026-06-08",
    text: `Day 3 — 2026-06-10 — Cusco, Peru
05:05 Train from Poroy Station to Machu Picchu Station — PeruRail Vistadome, booked
08:40 Bus from Aguas Calientes to Machu Picchu — Consettur shuttle, 25 min
09:30–12:30 Machu Picchu — circuit 2, booked
13:30 Lunch at Indio Feliz, Calle Lloque Yupanqui 103, Aguas Calientes
15:20 Train from Machu Picchu Station to Poroy Station — PeruRail Vistadome, booked
19:30 Check in at Belmond Hotel Monasterio, Calle Palacio 136 — booked
20:30 Dinner at Chicha por Gastón Acurio, Plaza Regocijo 261`,
    expect: {
      days: 1,
      stops: 6,
      times: ["05:05", "08:40", "09:30", "13:30", "15:20", "19:30", "20:30"],
      booked: 4,
      flights: 0,
      mustInclude: ["Poroy", "Machu Picchu", "Indio Feliz", "Monasterio", "Chicha"],
      addresses: ["Calle Palacio 136", "Plaza Regocijo 261"],
      cities: [
        { match: "Indio Feliz", city: "Machu Picchu|Aguas Calientes" },
        { match: "Monasterio", city: "Cusco" },
        { match: "Chicha", city: "Cusco" },
      ],
    },
  },
];
