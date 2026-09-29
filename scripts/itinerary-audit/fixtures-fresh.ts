/**
 * Ten more short itineraries, written after the Japan departure-day audit
 * (Sept 2026) and never tuned against before their first run. The first set
 * (fixtures.ts) had been fixed against for weeks, so a clean score there says
 * little about a plan Béa has not seen.
 *
 *   node scripts/itinerary-audit/audit.mjs --fixtures fresh
 *
 * These lean on what the Japan day got wrong: getting to an airport read as a
 * flight, a travel day's second town used too early, hotels left and come back
 * to, and places whose names share a word with something else nearby.
 */
import type { Fixture } from "./fixtures.ts";

export const FIXTURES: Fixture[] = [
  {
    id: "osaka-departure",
    traps: [
      "getting to the airport is not a flight",
      "travel day: the flight leaves from the first town",
      "hotel left and come back to",
    ],
    tripCity: "Osaka, Japan",
    startDate: "2026-11-14",
    text: `Day 1 — 2026-11-14 — Osaka, Japan → Toronto, Canada
08:00 Hotel Granvia Osaka (ホテルグランヴィア大阪), 3-1-1 Umeda — check out, leave bags at the front desk
08:45–10:00 Kuromon Market (黒門市場), 2-4-1 Nipponbashi — breakfast grazing
10:30–12:00 Osaka Castle (大阪城), 1-1 Osakajo — main keep
12:30 Lunch at Kiji (きじ), Umeda Sky Building B1 — okonomiyaki
14:00 Hotel Granvia Osaka — collect bags
14:30 Take the Haruka express from Osaka Station to Kansai Airport
15:45 Arrive at Kansai International Airport
18:30 Flight AC 16 from Kansai International Airport to Toronto Pearson`,
    expect: {
      days: 1,
      stops: 6,
      times: ["08:00", "08:45", "10:30", "12:30", "14:00", "14:30", "15:45", "18:30"],
      booked: 0,
      flights: 1,
      toBook: 1,
      mustInclude: ["Granvia", "Kuromon", "Osaka Castle", "Kiji", "Kansai International Airport"],
      addresses: ["3-1-1 Umeda", "2-4-1 Nipponbashi", "1-1 Osakajo"],
      kinds: [{ match: "Flight AC 16", kind: ["flight"] }],
      cities: [
        { match: "Flight AC 16", city: "Osaka" },
        { match: "Kuromon", city: "Osaka" },
      ],
      pins: [{ match: "Kiji", place: "Kiji" }],
    },
  },
  {
    id: "lisbon-porto-train",
    traps: ["two days, second is a travel day", "tram ride is a leg", "hotel change"],
    tripCity: "Lisbon, Portugal",
    startDate: "2026-05-04",
    text: `Day 1 — Lisbon
09:00 Pastéis de Belém, Rua de Belém 84-92 — custard tarts
10:00 Jerónimos Monastery — cloisters
12:30 Lunch at Time Out Market
15:00 Tram 28 to Alfama
15:30 Miradouro de Santa Luzia
20:00 Dinner at Taberna da Rua das Flores
Day 2 — Lisbon → Porto
08:15 Check out of Memmo Alfama
09:09 Train from Lisboa Santa Apolónia to Porto Campanhã (Alfa Pendular, booked ✅)
12:30 Check in at Torel Avantgarde, Rua da Restauração 336
14:00 Livraria Lello
16:00 Walk across the Dom Luís I Bridge to Vila Nova de Gaia
17:00 Port tasting at Graham's Lodge`,
    expect: {
      days: 2,
      stops: 11,
      times: [
        "09:00",
        "10:00",
        "12:30",
        "15:00",
        "15:30",
        "20:00",
        "08:15",
        "09:09",
        "12:30",
        "14:00",
        "16:00",
        "17:00",
      ],
      booked: 1,
      flights: 0,
      toBook: 1,
      mustInclude: [
        "Pastéis de Belém",
        "Jerónimos",
        "Time Out",
        "Santa Luzia",
        "Taberna",
        "Memmo",
        "Santa Apolónia",
        "Torel",
        "Lello",
        "Graham",
      ],
      addresses: ["Rua de Belém 84-92", "Rua da Restauração 336"],
      kinds: [{ match: "Santa Apolónia", kind: ["transport"] }],
      cities: [
        { match: "Memmo", city: "Lisbon" },
        { match: "Santa Apolónia", city: "Lisbon" },
        { match: "Torel", city: "Porto" },
        { match: "Lello", city: "Porto" },
      ],
    },
  },
  {
    id: "nyc-landing",
    traps: ["landing named by airport code only", "am/pm bullets", "booked flight and tickets"],
    tripCity: "New York, USA",
    startDate: "2026-06-11",
    text: `Thursday June 11
- 7:40am Land at JFK on AC 764 (conf QX7P2L)
- 9:30am Drop bags at The Hoxton Williamsburg, 97 Wythe Ave
- 10:30am Brunch at Sunday in Brooklyn
- 1pm Domino Park
- 3pm NYC Ferry to Wall St/Pier 11
- 4pm 9/11 Memorial & Museum (timed entry 4:15pm, tickets booked)
- 7:30pm Dinner at Katz's Delicatessen, 205 E Houston St`,
    expect: {
      days: 1,
      stops: 6,
      times: ["07:40", "09:30", "10:30", "13:00", "15:00", "16:00", "19:30"],
      booked: 2,
      flights: 1,
      toBook: 1,
      mustInclude: ["JFK", "Hoxton", "Sunday in Brooklyn", "Domino Park", "9/11 Memorial", "Katz"],
      addresses: ["97 Wythe Ave", "205 E Houston St"],
      kinds: [
        { match: "JFK", kind: ["flight"] },
        { match: "Hoxton", kind: ["lodging", "hotel"] },
      ],
    },
  },
  {
    id: "cdmx-prose-es",
    traps: ["Spanish prose", "approximate time", "taxi to the airport is a leg"],
    tripCity: "Mexico City, Mexico",
    startDate: "2026-03-07",
    text: `Día 1 (sábado 7 de marzo): Llegamos al hotel Casa Awolly en la Roma a eso de las 11. Comida a las 14:00 en Contramar (reservado a nombre de Ana). En la tarde paseo por el Bosque de Chapultepec y el Museo Nacional de Antropología hasta que cierre. Cena ligera en Tacos Orinoco.
Día 2 (domingo): 9:00 desayuno en Panadería Rosetta, luego Mercado de Coyoacán y la Casa Azul (boletos comprados para las 12:30). Regreso al hotel por las maletas a las 16:00 y taxi al aeropuerto AICM; vuelo AM 402 a las 19:15.`,
    expect: {
      days: 2,
      stops: 10,
      times: ["11:00", "14:00", "09:00", "12:30", "16:00", "19:15"],
      booked: 2,
      flights: 1,
      mustInclude: [
        "Casa Awolly",
        "Contramar",
        "Chapultepec",
        "Antropolog",
        "Orinoco",
        "Rosetta",
        "Coyoac",
        "Casa Azul",
      ],
      kinds: [{ match: "AM 402", kind: ["flight"] }],
    },
  },
  {
    id: "amsterdam-markdown",
    traps: ["markdown heading and bold times", "Dutch street addresses", "venue after 'from'"],
    tripCity: "Amsterdam, Netherlands",
    startDate: "2026-09-18",
    text: `## Amsterdam — Day 1 (Fri 18 Sep)
* **9:00** — Anne Frank House, Prinsengracht 263-267 (tickets booked for 9:00, ref AFH-20931)
* **10:30** — Coffee at Winkel 43 (apple pie!)
* **11:30** — Canal cruise from Rederij Lampedusa, Dijksgracht 6
* **13:30** — Rijksmuseum — Night Watch, Gallery of Honour
* **16:30** — Vondelpark
* **19:00** — Dinner at De Kas, Kamerlingh Onneslaan 3`,
    expect: {
      days: 1,
      stops: 6,
      times: ["09:00", "10:30", "11:30", "13:30", "16:30", "19:00"],
      booked: 1,
      flights: 0,
      mustInclude: ["Anne Frank", "Winkel 43", "Lampedusa", "Rijksmuseum", "Vondelpark", "De Kas"],
      addresses: ["Prinsengracht 263-267", "Dijksgracht 6", "Kamerlingh Onneslaan 3"],
      kinds: [
        { match: "Winkel 43", kind: ["meal"] },
        { match: "Rijksmuseum", kind: ["sight"] },
      ],
      pins: [
        { match: "Canal cruise", place: "Lampedusa" },
        { match: "Winkel", place: "Winkel 43" },
      ],
    },
  },
  {
    id: "seoul-hangul",
    traps: ["Hangul in brackets", "Korean road addresses split by commas", "market as dinner"],
    tripCity: "Seoul, South Korea",
    startDate: "2026-10-03",
    text: `Seoul — Day 1 (Oct 3)
09:00 Gyeongbokgung Palace (경복궁), 161 Sajik-ro, Jongno-gu — changing of the guard at 10:00
11:00 Bukchon Hanok Village (북촌한옥마을)
12:30 Lunch at Tosokchon Samgyetang (토속촌 삼계탕), 5 Jahamun-ro 5-gil — ginseng chicken soup
14:30 Insadong (인사동) — tea at Osulloc
17:00 N Seoul Tower (N서울타워) — take the cable car up
19:30 Dinner at Gwangjang Market (광장시장) — bindaetteok`,
    expect: {
      days: 1,
      stops: 6,
      times: ["09:00", "11:00", "12:30", "14:30", "17:00", "19:30"],
      booked: 0,
      flights: 0,
      mustInclude: [
        "Gyeongbokgung",
        "Bukchon",
        "Tosokchon",
        "Insadong",
        "N Seoul Tower",
        "Gwangjang",
      ],
      addresses: ["161 Sajik-ro", "5 Jahamun-ro 5-gil"],
      kinds: [{ match: "Gwangjang", kind: ["meal"] }],
      pins: [{ match: "Gwangjang", place: "Gwangjang Market" }],
    },
  },
  {
    id: "edinburgh-stirling",
    traps: ["day trip by train and back", "heading names two towns with &", "booked train"],
    tripCity: "Edinburgh, United Kingdom",
    startDate: "2026-09-12",
    text: `Saturday 12 September — Edinburgh & Stirling
08:30 Breakfast at The Edinburgh Larder, 15 Blackfriars St
09:33 Train from Edinburgh Waverley to Stirling (tickets booked)
10:30 Stirling Castle — Great Hall and Royal Palace
13:00 Lunch at Brea, 5 Baker St
14:30 Wallace Monument — climb the 246 steps
17:10 Train from Stirling back to Edinburgh Waverley
19:30 Dinner at The Witchery by the Castle, 352 Castlehill`,
    expect: {
      days: 1,
      stops: 7,
      times: ["08:30", "09:33", "10:30", "13:00", "14:30", "17:10", "19:30"],
      booked: 1,
      flights: 0,
      mustInclude: [
        "Edinburgh Larder",
        "Waverley",
        "Stirling Castle",
        "Brea",
        "Wallace",
        "Witchery",
      ],
      addresses: ["15 Blackfriars St", "5 Baker St", "352 Castlehill"],
      cities: [
        { match: "Larder", city: "Edinburgh" },
        { match: "Stirling Castle", city: "Stirling" },
        { match: "Lunch at Brea", city: "Stirling" },
        { match: "Wallace", city: "Stirling" },
        { match: "Witchery", city: "Edinburgh" },
      ],
    },
  },
  {
    id: "bangkok-table",
    traps: ["markdown table", "ferry row is also the visit to Wat Arun", "bar inside a hotel"],
    tripCity: "Bangkok, Thailand",
    startDate: "2026-12-05",
    text: `Bangkok day
| Time | Plan | Notes |
|---|---|---|
| 07:30 | Grand Palace & Wat Phra Kaew | dress code: covered shoulders |
| 10:00 | Wat Pho | reclining Buddha |
| 11:30 | Tha Tien Pier → cross-river ferry to Wat Arun | 5 THB |
| 13:00 | Lunch at Jay Fai, 327 Maha Chai Rd | booked for 13:00 |
| 16:00 | Jim Thompson House | |
| 18:30 | Sunset drinks at Sky Bar, lebua at State Tower | |
| 20:30 | Chinatown — Yaowarat Road street food | |`,
    expect: {
      days: 1,
      stops: 7,
      times: ["07:30", "10:00", "11:30", "13:00", "16:00", "18:30", "20:30"],
      booked: 1,
      flights: 0,
      mustInclude: [
        "Grand Palace",
        "Wat Pho",
        "Wat Arun",
        "Jay Fai",
        "Jim Thompson",
        "Sky Bar",
        "Yaowarat",
      ],
      addresses: ["327 Maha Chai Rd"],
      pins: [
        { match: "Wat Arun", place: "Wat Arun" },
        { match: "Jay Fai", place: "Jay Fai" },
      ],
    },
  },
  {
    id: "berlin-two-hotels",
    traps: ["two hotels, one booked", "luggage left and collected", "time slot in brackets"],
    tripCity: "Berlin, Germany",
    startDate: "2026-10-24",
    text: `Day 1 — Sat 24 Oct — Berlin
15:00 Check in: Hotel Adlon Kempinski, Unter den Linden 77 (booked, conf 88213)
16:00 Brandenburg Gate
17:00 Reichstag dome (booked, 17:15 slot)
20:00 Dinner at Borchardt, Französische Str. 47
Day 2 — Sun 25 Oct — Berlin
10:00 Check out of the Adlon, leave luggage
10:30 Museum Island — Pergamon Panorama
13:00 Lunch at Markthalle Neun
15:00 East Side Gallery
17:30 Collect bags at the Adlon
18:30 Check in: Michelberger Hotel, Warschauer Str. 39`,
    expect: {
      days: 2,
      stops: 10,
      times: [
        "15:00",
        "16:00",
        "17:00",
        "20:00",
        "10:00",
        "10:30",
        "13:00",
        "15:00",
        "17:30",
        "18:30",
      ],
      booked: 2,
      flights: 0,
      toBook: 1,
      mustInclude: [
        "Adlon",
        "Brandenburg",
        "Reichstag",
        "Borchardt",
        "Museum Island",
        "Markthalle Neun",
        "East Side Gallery",
        "Michelberger",
      ],
      addresses: ["Unter den Linden 77", "Französische Str. 47", "Warschauer Str. 39"],
      kinds: [{ match: "Michelberger", kind: ["lodging", "hotel"] }],
    },
  },
  {
    id: "sydney-lowercase",
    traps: ["all lower case", "dotted pm times", "ferry out and back are legs"],
    tripCity: "Sydney, Australia",
    startDate: "2026-11-01",
    text: `sydney sunday!!
9am bondi to coogee coastal walk
11.30am brunch @ bills surry hills
1.30pm art gallery of nsw
3pm ferry circular quay -> manly
4pm manly beach + shelly beach snorkel
7pm dinner at the boathouse, shelly beach
9.45pm ferry back to circular quay`,
    expect: {
      days: 1,
      stops: 5,
      times: ["09:00", "11:30", "13:30", "15:00", "16:00", "19:00", "21:45"],
      booked: 0,
      flights: 0,
      mustInclude: ["bondi", "bills", "art gallery", "manly", "boathouse"],
      kinds: [{ match: "bills", kind: ["meal"] }],
      pins: [
        { match: "bills", place: "bills" },
        { match: "boathouse", place: "boathouse" },
      ],
    },
  },
];
