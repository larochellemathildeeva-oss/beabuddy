/**
 * Ten plans written the way Béa's own prompt for other assistants asks
 * (ai-plan-prompt.ts): "Day N — date — Town", one place per line, a street
 * address after a comma, the local script in brackets, and its fixed lines
 * for flights, arrivals, trains and check-ins. That is what most pasted plans
 * will look like, so it is what most needs to come out right.
 *
 *   node scripts/itinerary-audit/audit.mjs --fixtures more
 */
import type { Fixture } from "./fixtures.ts";

export const FIXTURES: Fixture[] = [
  {
    id: "tokyo-arrival",
    traps: ["landing is the flight in", "hotel before check-in time", "getting-there brackets"],
    tripCity: "Tokyo, Japan",
    startDate: "2026-04-02",
    text: `Day 1 — 2026-04-02 — Tokyo, Japan
07:30 Arrive at Narita International Airport
10:00 Check in at Hotel Gracery Shinjuku (ホテルグレイスリー新宿), 1-19-1 Kabukicho — drop bags until 15:00
11:00 Shinjuku Gyoen National Garden (新宿御苑) — cherry blossoms
13:00 Lunch at Fuunji (風雲児), 2-14-3 Yoyogi — tsukemen; expect a queue
15:00–16:30 Meiji Jingu (明治神宮), 1-1 Yoyogikamizonocho (getting there: JR Yamanote line to Harajuku, 5 min)
17:00 Takeshita Street (竹下通り)
19:00 Dinner at Omoide Yokocho (思い出横丁), 1-2 Nishishinjuku — yakitori alleys`,
    expect: {
      days: 1,
      stops: 7,
      times: ["07:30", "10:00", "11:00", "13:00", "15:00", "17:00", "19:00"],
      booked: 0,
      flights: 1,
      mustInclude: [
        "Narita",
        "Gracery",
        "Shinjuku Gyoen",
        "Fuunji",
        "Meiji Jingu",
        "Takeshita",
        "Omoide",
      ],
      addresses: ["1-19-1 Kabukicho", "2-14-3 Yoyogi", "1-2 Nishishinjuku"],
      kinds: [{ match: "Gracery", kind: ["lodging", "hotel"] }],
    },
  },
  {
    id: "kyoto-hiroshima",
    traps: ["travel day by train", "check out then check in", "Japanese block addresses"],
    tripCity: "Kyoto, Japan",
    startDate: "2026-04-04",
    text: `Day 3 — 2026-04-04 — Kyoto, Japan → Hiroshima, Japan
07:00 Fushimi Inari Taisha (伏見稲荷大社), 68 Fukakusa Yabunouchicho — go early before the crowds
09:30 Check out at Hotel Granvia Kyoto (ホテルグランヴィア京都), 901 Higashishiokojicho
10:12 Train from Kyoto Station to Hiroshima Station — Nozomi, book ahead
12:30 Check in at Sheraton Grand Hiroshima (シェラトングランドホテル広島), 12-1 Wakakusacho
13:30 Lunch at Okonomimura (お好み村), 5-13 Shintenchi — Hiroshima-style okonomiyaki
15:00–17:00 Hiroshima Peace Memorial Museum (広島平和記念資料館), 1-2 Nakajimacho
17:15 Atomic Bomb Dome (原爆ドーム)`,
    expect: {
      days: 1,
      stops: 7,
      times: ["07:00", "09:30", "10:12", "12:30", "13:30", "15:00", "17:15"],
      booked: 0,
      flights: 0,
      toBook: 2,
      mustInclude: [
        "Fushimi Inari",
        "Granvia",
        "Kyoto Station",
        "Sheraton",
        "Okonomimura",
        "Peace Memorial",
        "Atomic Bomb Dome",
      ],
      kinds: [{ match: "Kyoto Station", kind: ["transport"] }],
      cities: [
        { match: "Fushimi", city: "Kyoto" },
        { match: "Granvia", city: "Kyoto" },
        { match: "Kyoto Station", city: "Kyoto" },
        { match: "Sheraton", city: "Hiroshima" },
        { match: "Okonomimura", city: "Hiroshima" },
        { match: "Atomic Bomb Dome", city: "Hiroshima" },
      ],
    },
  },
  {
    id: "rome-two-days",
    traps: ["Italian number-last addresses", "landing on day one", "booked museum"],
    tripCity: "Rome, Italy",
    startDate: "2026-06-15",
    text: `Day 1 — 2026-06-15 — Rome, Italy
08:00 Arrive at Rome Fiumicino Airport
11:00 Check in at Hotel Artemide, Via Nazionale 22
12:00–14:00 Colosseum, Piazza del Colosseo 1 — book ahead
14:30 Lunch at Trattoria Luzzi, Via di San Giovanni in Laterano 88 — cacio e pepe
16:00 Roman Forum
19:30 Dinner at Da Enzo al 29, Via dei Vascellari 29 — carbonara; book ahead
Day 2 — 2026-06-16 — Rome, Italy
08:30–11:30 Vatican Museums, Viale Vaticano — booked
12:00 St. Peter's Basilica
13:30 Lunch at Pizzarium Bonci, Via della Meloria 43 — pizza al taglio
16:00 Pantheon, Piazza della Rotonda
17:00 Trevi Fountain`,
    expect: {
      days: 2,
      stops: 11,
      times: [
        "08:00",
        "11:00",
        "12:00",
        "14:30",
        "16:00",
        "19:30",
        "08:30",
        "12:00",
        "13:30",
        "16:00",
        "17:00",
      ],
      booked: 1,
      flights: 1,
      mustInclude: [
        "Fiumicino",
        "Artemide",
        "Colosseum",
        "Luzzi",
        "Roman Forum",
        "Da Enzo",
        "Vatican Museums",
        "St. Peter",
        "Pizzarium",
        "Pantheon",
        "Trevi",
      ],
      addresses: [
        "Via Nazionale 22",
        "Via di San Giovanni in Laterano 88",
        "Via dei Vascellari 29",
        "Via della Meloria 43",
      ],
    },
  },
  {
    id: "istanbul-day",
    traps: ["Turkish addresses with No: and Cd.", "names in brackets that are not local script"],
    tripCity: "Istanbul, Türkiye",
    startDate: "2026-05-09",
    text: `Day 1 — 2026-05-09 — Istanbul, Türkiye
09:00–10:30 Hagia Sophia (Ayasofya), Ayasofya Meydanı No:1
10:45 Blue Mosque (Sultanahmet Camii) — closed at prayer times
12:00 Basilica Cistern (Yerebatan Sarnıcı), Yerebatan Cd. 1/3
13:00 Lunch at Tarihi Sultanahmet Köftecisi Selim Usta, Divan Yolu Cd. No:12 — köfte
14:30 Grand Bazaar (Kapalıçarşı)
17:00 Galata Tower (Galata Kulesi) (getting there: tram T1 and funicular, 25 min)
19:30 Dinner at Karaköy Lokantası, Kemankeş Cd. No:37`,
    expect: {
      days: 1,
      stops: 7,
      times: ["09:00", "10:45", "12:00", "13:00", "14:30", "17:00", "19:30"],
      booked: 0,
      flights: 0,
      mustInclude: [
        "Hagia Sophia",
        "Blue Mosque",
        "Basilica Cistern",
        "Selim Usta",
        "Grand Bazaar",
        "Galata Tower",
        "Karaköy Lokantası",
      ],
      kinds: [{ match: "Selim Usta", kind: ["meal"] }],
      pins: [{ match: "Selim Usta", place: "Selim Usta" }],
    },
  },
  {
    id: "marrakech-arabic",
    traps: ["Arabic script in brackets", "addresses with no number"],
    tripCity: "Marrakech, Morocco",
    startDate: "2026-03-20",
    text: `Day 1 — 2026-03-20 — Marrakech, Morocco
09:00 Jardin Majorelle (حديقة ماجوريل), Rue Yves Saint Laurent — go at opening
11:00 Musée Yves Saint Laurent, Rue Yves Saint Laurent
13:00 Lunch at Nomad, 1 Derb Aarjan — rooftop over the spice square
15:00 Bahia Palace (قصر الباهية), Riad Zitoun el Jdid
17:00 Koutoubia Mosque (جامع الكتبية)
18:30 Jemaa el-Fnaa (ساحة جامع الفنا) — food stalls at dusk`,
    expect: {
      days: 1,
      stops: 6,
      times: ["09:00", "11:00", "13:00", "15:00", "17:00", "18:30"],
      booked: 0,
      flights: 0,
      mustInclude: [
        "Majorelle",
        "Yves Saint Laurent",
        "Nomad",
        "Bahia",
        "Koutoubia",
        "Jemaa el-Fnaa",
      ],
      addresses: ["1 Derb Aarjan"],
      kinds: [{ match: "Nomad", kind: ["meal"] }],
    },
  },
  {
    id: "hanoi-vietnamese",
    traps: [
      "Vietnamese diacritics",
      "'Train Street' is a street, not a train",
      "meal names are dishes",
    ],
    tripCity: "Hanoi, Vietnam",
    startDate: "2026-11-21",
    text: `Day 1 — 2026-11-21 — Hanoi, Vietnam
07:00 Hoan Kiem Lake (Hồ Hoàn Kiếm) — morning tai chi
08:00 Breakfast at Phở Gia Truyền Bát Đàn, 49 Bát Đàn — beef pho; expect a queue
09:30 Temple of Literature (Văn Miếu), 58 Quốc Tử Giám
11:30 Ho Chi Minh Mausoleum (Lăng Chủ tịch Hồ Chí Minh), 2 Hùng Vương — closed Mondays and Fridays
13:00 Lunch at Bún Chả Hương Liên, 24 Lê Văn Hưu — the Obama combo
15:00 Hanoi Train Street, Trần Phú
19:00 Dinner at Cha Ca Thang Long, 21 Đường Thành`,
    expect: {
      days: 1,
      stops: 7,
      times: ["07:00", "08:00", "09:30", "11:30", "13:00", "15:00", "19:00"],
      booked: 0,
      flights: 0,
      mustInclude: [
        "Hoan Kiem",
        "Bát Đàn",
        "Temple of Literature",
        "Mausoleum",
        "Hương Liên",
        "Train Street",
        "Cha Ca Thang Long",
      ],
      addresses: [
        "49 Bát Đàn",
        "58 Quốc Tử Giám",
        "2 Hùng Vương",
        "24 Lê Văn Hưu",
        "21 Đường Thành",
      ],
      kinds: [{ match: "Train Street", kind: ["activity", "sight", "walk"] }],
    },
  },
  {
    id: "barcelona-flight-out",
    traps: [
      "the prompt's own 'Arrive at … Airport' before a flight",
      "bags collected at the hotel",
      "flight home",
    ],
    tripCity: "Barcelona, Spain",
    startDate: "2026-07-12",
    text: `Day 4 — 2026-07-12 — Barcelona, Spain → Montréal, Canada
08:00 Check out at Hotel Casa Fuster, Passeig de Gràcia 132
09:00–10:30 Sagrada Família, Carrer de Mallorca 401 — booked
11:00 Hospital de Sant Pau, Carrer de Sant Antoni Maria Claret 167
13:00 Lunch at El Nacional, Passeig de Gràcia 24 bis
14:30 Hotel Casa Fuster — collect bags
15:30 Arrive at Barcelona El Prat Airport
18:05 Flight AC 835 from Barcelona El Prat Airport to Montréal-Trudeau Airport`,
    expect: {
      days: 1,
      stops: 6,
      times: ["08:00", "09:00", "11:00", "13:00", "14:30", "15:30", "18:05"],
      booked: 1,
      flights: 1,
      toBook: 1,
      mustInclude: ["Casa Fuster", "Sagrada", "Sant Pau", "El Nacional", "El Prat"],
      addresses: ["Passeig de Gràcia 132", "Carrer de Mallorca 401"],
      cities: [
        { match: "Flight AC 835", city: "Barcelona" },
        { match: "Sant Pau", city: "Barcelona" },
      ],
    },
  },
  {
    id: "vancouver-whistler",
    traps: ["day trip by bus and back", "heading names one town"],
    tripCity: "Vancouver, Canada",
    startDate: "2026-02-13",
    text: `Day 2 — 2026-02-14 — Vancouver, Canada
07:00 Bus from Vancouver Downtown to Whistler Village — Epic Rides, book ahead
09:30 Whistler Blackcomb Gondola — skiing all day
16:30 Après at Garibaldi Lift Company, 4165 Springs Lane
18:00 Bus from Whistler Village back to Vancouver Downtown
20:30 Dinner at Miku, 200 Granville St — aburi sushi`,
    expect: {
      days: 1,
      stops: 5,
      times: ["07:00", "09:30", "16:30", "18:00", "20:30"],
      booked: 0,
      flights: 0,
      mustInclude: ["Whistler", "Gondola", "Garibaldi", "Miku"],
      addresses: ["4165 Springs Lane", "200 Granville St"],
      cities: [
        { match: "Gondola", city: "Whistler" },
        { match: "Garibaldi", city: "Whistler" },
        { match: "Miku", city: "Vancouver" },
      ],
    },
  },
  {
    id: "lisbon-sintra",
    traps: ["day trip by train to a station, back to a station", "Portuguese addresses"],
    tripCity: "Lisbon, Portugal",
    startDate: "2026-05-04",
    text: `Day 3 — 2026-05-06 — Lisbon, Portugal
08:40 Train from Rossio Station to Sintra — every 20 min
10:00–12:00 Pena Palace (Palácio da Pena), Estrada da Pena — book ahead
12:30 Quinta da Regaleira, Rua Barbosa du Bocage 5
14:00 Lunch at Tascantiga, Escadinhas de São Martinho 16
16:10 Train from Sintra to Rossio Station
18:30 LX Factory, Rua Rodrigues de Faria 103
20:00 Dinner at Cervejaria Ramiro, Avenida Almirante Reis 1 — seafood; expect a queue`,
    expect: {
      days: 1,
      stops: 7,
      times: ["08:40", "10:00", "12:30", "14:00", "16:10", "18:30", "20:00"],
      booked: 0,
      flights: 0,
      mustInclude: ["Rossio", "Pena", "Regaleira", "Tascantiga", "LX Factory", "Ramiro"],
      addresses: [
        "Rua Barbosa du Bocage 5",
        "Rua Rodrigues de Faria 103",
        "Avenida Almirante Reis 1",
      ],
      cities: [
        { match: "Pena", city: "Sintra" },
        { match: "Regaleira", city: "Sintra" },
        { match: "Tascantiga", city: "Sintra" },
        { match: "LX Factory", city: "Lisbon" },
        { match: "Ramiro", city: "Lisbon" },
      ],
    },
  },
  {
    id: "paris-prompt-example",
    traps: ["Béa's own example plan, pasted as is"],
    tripCity: "Paris, France",
    startDate: "2026-10-12",
    text: `Day 1 — 2026-10-12 — Paris, France
09:00 Breakfast at Café de Flore, 172 Boulevard Saint-Germain — try the hot chocolate
10:00–12:00 Musée d'Orsay, 1 Rue de la Légion d'Honneur — book ahead
12:30 Lunch at Bouillon Chartier, 7 Rue du Faubourg Montmartre — cheap classic bistro; order the steak frites
15:00 Check in at Hôtel des Grands Boulevards, 17 Boulevard Poissonnière
Day 2 — 2026-10-13 — Paris, France → Lyon, France
08:30 Walk in Jardin du Luxembourg (getting there: metro line 4, 15 min)
11:00 Train from Paris Gare de Lyon to Lyon Part-Dieu — book ahead
13:30 Check in at Hôtel Carlton Lyon, 4 Rue Jussieu
19:30 Dinner at Daniel et Denise Saint-Jean, 36 Rue Tramassac — Lyon bouchon; try the quenelles`,
    expect: {
      days: 2,
      stops: 8,
      times: ["09:00", "10:00", "12:30", "15:00", "08:30", "11:00", "13:30", "19:30"],
      booked: 0,
      flights: 0,
      toBook: 3,
      mustInclude: [
        "Café de Flore",
        "Orsay",
        "Chartier",
        "Grands Boulevards",
        "Luxembourg",
        "Gare de Lyon",
        "Carlton",
        "Daniel et Denise",
      ],
      cities: [
        { match: "Luxembourg", city: "Paris" },
        { match: "Gare de Lyon", city: "Paris" },
        { match: "Carlton", city: "Lyon" },
        { match: "Daniel et Denise", city: "Lyon" },
      ],
    },
  },
];
