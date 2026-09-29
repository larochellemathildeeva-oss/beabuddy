/**
 * Where the audit plans' places really are, for pins.mjs. `match` finds the
 * stop by its title or place; `km` is how far off still counts (default 0.7,
 * wider for a park, a beach or an airport, and where the exact door is
 * uncertain). Coordinates are the place itself, not its street.
 */
const OSAKA_DAY10 = `Day 10 — 2026-10-10 — Osaka, Japan → Vancouver, Canada
08:30 Citadines Namba Osaka (シタディーンなんば大阪), 3-5-25 Nipponbashi — check out and leave luggage
09:15–10:15 Umeda Sky Building (梅田スカイビル), 1-1-88 Oyodonaka — Floating Garden Observatory
10:30–11:15 Grand Front Osaka (グランフロント大阪), 4-20 Ofukacho — final shopping
11:15–12:00 Osaka Station City (大阪ステーションシティ), 3-1-1 Umeda — shops and food halls
12:15–13:00 Nakanoshima Park (中之島公園), 1 Nakanoshima — riverside walk
13:30 Citadines Namba Osaka (シタディーンなんば大阪), 3-5-25 Nipponbashi — collect luggage
15:30 Arrive at Kansai International Airport
18:00 Flight from Kansai International Airport to Vancouver International Airport`;

const KOBE_DAY9 = `Day 9 — 2026-10-09 — Kobe → Osaka
17:00–17:45 Nankinmachi (南京町) — Kobe Chinatown stroll
18:00–18:45 Meriken Park (メリケンパーク), 2 Hatobacho — waterfront and Kobe Port Tower views
18:45–19:30 Kobe Harborland (神戸ハーバーランド) — evening waterfront
20:00 Osaka Station (大阪駅), 3-1-1 Umeda — return to Osaka
20:30 Citadines Namba Osaka (シタディーンなんば大阪), 3-5-25 Nipponbashi — hotel`;

export const TRUTH = {
  extraFixtures: [
    {
      id: "japan-day10-real",
      tripCity: "Osaka, Japan",
      startDate: "2026-10-01",
      text: OSAKA_DAY10,
    },
    { id: "japan-day9-real", tripCity: "Osaka, Japan", startDate: "2026-10-01", text: KOBE_DAY9 },
  ],
  places: {
    "tokyo-arrival": [
      { match: "Narita", lat: 35.772, lon: 140.3929, km: 3 },
      { match: "Gracery", lat: 35.6951, lon: 139.702 },
      { match: "Shinjuku Gyoen", lat: 35.6852, lon: 139.7101, km: 1.2 },
      { match: "Fuunji", lat: 35.6866, lon: 139.6977 },
      { match: "Meiji Jingu", lat: 35.6764, lon: 139.6993, km: 1 },
      { match: "Takeshita", lat: 35.6716, lon: 139.7031 },
      { match: "Omoide", lat: 35.6929, lon: 139.6995 },
    ],
    "kyoto-hiroshima": [
      { match: "Fushimi Inari", lat: 34.9671, lon: 135.7727, km: 1 },
      { match: "Granvia", lat: 34.9858, lon: 135.7588 },
      { match: "Sheraton", lat: 34.3985, lon: 132.478 },
      { match: "Okonomimura", lat: 34.3925, lon: 132.4615 },
      { match: "Peace Memorial", lat: 34.3915, lon: 132.4523 },
      { match: "Atomic Bomb Dome", lat: 34.3955, lon: 132.4536 },
    ],
    "rome-two-days": [
      { match: "Fiumicino", lat: 41.8003, lon: 12.2389, km: 3 },
      { match: "Artemide", lat: 41.9008, lon: 12.4927 },
      { match: "Colosseum", lat: 41.8902, lon: 12.4922 },
      { match: "Luzzi", lat: 41.8889, lon: 12.497 },
      { match: "Roman Forum", lat: 41.8925, lon: 12.4853, km: 0.8 },
      { match: "Da Enzo", lat: 41.8886, lon: 12.4776 },
      { match: "Vatican Museums", lat: 41.9065, lon: 12.4536 },
      { match: "St. Peter", lat: 41.9022, lon: 12.4539 },
      { match: "Pizzarium", lat: 41.9075, lon: 12.4466 },
      { match: "Pantheon", lat: 41.8986, lon: 12.4769 },
      { match: "Trevi", lat: 41.9009, lon: 12.4833 },
    ],
    "istanbul-day": [
      { match: "Hagia Sophia", lat: 41.0086, lon: 28.9802 },
      { match: "Blue Mosque", lat: 41.0054, lon: 28.9768 },
      { match: "Basilica Cistern", lat: 41.0084, lon: 28.9779 },
      { match: "Grand Bazaar", lat: 41.0107, lon: 28.9681, km: 0.8 },
      { match: "Galata Tower", lat: 41.0256, lon: 28.9741 },
    ],
    "marrakech-arabic": [
      { match: "Majorelle", lat: 31.6417, lon: -8.0033 },
      { match: "Bahia", lat: 31.6216, lon: -7.9831 },
      { match: "Koutoubia", lat: 31.6237, lon: -7.9936 },
      { match: "Jemaa el-Fnaa", lat: 31.6258, lon: -7.9891 },
    ],
    "hanoi-vietnamese": [
      { match: "Hoan Kiem", lat: 21.0287, lon: 105.8524 },
      { match: "Temple of Literature", lat: 21.0293, lon: 105.8356 },
      { match: "Mausoleum", lat: 21.0368, lon: 105.8346 },
      { match: "Hương Liên", lat: 21.0181, lon: 105.8537 },
    ],
    "barcelona-flight-out": [
      { match: "Casa Fuster", lat: 41.3995, lon: 2.1579 },
      { match: "Sagrada", lat: 41.4036, lon: 2.1744 },
      { match: "Sant Pau", lat: 41.4114, lon: 2.1747 },
      { match: "El Nacional", lat: 41.389, lon: 2.1668 },
      { match: "Flight AC 835", lat: 41.2974, lon: 2.0833, km: 3 },
    ],
    "vancouver-whistler": [
      { match: "Gondola", lat: 50.115, lon: -122.9486, km: 1 },
      { match: "Garibaldi", lat: 50.1144, lon: -122.9487 },
      { match: "Miku", lat: 49.287, lon: -123.113 },
    ],
    "lisbon-sintra": [
      { match: "Rossio", lat: 38.7142, lon: -9.1411 },
      { match: "Pena", lat: 38.7876, lon: -9.3906 },
      { match: "Regaleira", lat: 38.7963, lon: -9.396 },
      { match: "LX Factory", lat: 38.7033, lon: -9.1784 },
      { match: "Ramiro", lat: 38.7209, lon: -9.1356 },
    ],
    "japan-day10-real": [
      { match: "Citadines", lat: 34.6618, lon: 135.5063, km: 1.2 },
      { match: "Umeda Sky", lat: 34.7053, lon: 135.4905 },
      { match: "Grand Front", lat: 34.7045, lon: 135.4947 },
      { match: "Osaka Station City", lat: 34.7025, lon: 135.4959 },
      { match: "Nakanoshima Park", lat: 34.6927, lon: 135.507, km: 1 },
      { match: "Kansai International Airport", lat: 34.4347, lon: 135.244, km: 3 },
    ],
    "japan-day9-real": [
      { match: "Nankinmachi", lat: 34.6881, lon: 135.1878 },
      { match: "Meriken Park", lat: 34.6829, lon: 135.1886 },
      { match: "Harborland", lat: 34.6791, lon: 135.1826, km: 1 },
      { match: "Osaka Station", lat: 34.7025, lon: 135.4959 },
    ],
    "osaka-departure": [
      { match: "Granvia", lat: 34.7025, lon: 135.4959 },
      { match: "Kuromon", lat: 34.6655, lon: 135.5066 },
      { match: "Osaka Castle", lat: 34.6873, lon: 135.5262, km: 1 },
      { match: "Kiji", lat: 34.7053, lon: 135.4905 },
      { match: "Flight AC 16", lat: 34.4347, lon: 135.244, km: 3 },
    ],
    "lisbon-porto-train": [
      { match: "Pastéis de Belém", lat: 38.6975, lon: -9.2032 },
      { match: "Jerónimos", lat: 38.6979, lon: -9.2068 },
      { match: "Time Out", lat: 38.707, lon: -9.1459 },
      { match: "Santa Luzia", lat: 38.7118, lon: -9.1302 },
      { match: "Taberna", lat: 38.7098, lon: -9.1437 },
      { match: "Santa Apolónia", lat: 38.7137, lon: -9.1225 },
      { match: "Lello", lat: 41.1469, lon: -8.6149 },
      { match: "Graham", lat: 41.1333, lon: -8.6143, km: 1 },
    ],
    "nyc-landing": [
      { match: "JFK", lat: 40.6413, lon: -73.7781, km: 3 },
      { match: "Hoxton", lat: 40.7218, lon: -73.958 },
      { match: "Domino Park", lat: 40.7145, lon: -73.968 },
      { match: "9/11 Memorial", lat: 40.7115, lon: -74.0134 },
      { match: "Katz", lat: 40.7223, lon: -73.9874 },
    ],
    "cdmx-prose-es": [
      { match: "Contramar", lat: 19.4193, lon: -99.1661 },
      { match: "Antropolog", lat: 19.426, lon: -99.1863 },
      { match: "Coyoac", lat: 19.3514, lon: -99.1616 },
      { match: "Casa Azul", lat: 19.3551, lon: -99.1625 },
    ],
    "amsterdam-markdown": [
      { match: "Anne Frank", lat: 52.3752, lon: 4.884 },
      { match: "Winkel 43", lat: 52.3784, lon: 4.8864 },
      { match: "Rijksmuseum", lat: 52.36, lon: 4.8852 },
      { match: "Vondelpark", lat: 52.358, lon: 4.8686, km: 1.2 },
      { match: "De Kas", lat: 52.353, lon: 4.934, km: 1 },
    ],
    "seoul-hangul": [
      { match: "Gyeongbokgung", lat: 37.5796, lon: 126.977 },
      { match: "Bukchon", lat: 37.5826, lon: 126.9836 },
      { match: "Tosokchon", lat: 37.5779, lon: 126.9713 },
      { match: "N Seoul Tower", lat: 37.5512, lon: 126.9882 },
      { match: "Gwangjang", lat: 37.5701, lon: 126.9996 },
    ],
    "edinburgh-stirling": [
      { match: "Waverley", lat: 55.9521, lon: -3.1893 },
      { match: "Stirling Castle", lat: 56.1238, lon: -3.9469 },
      { match: "Wallace", lat: 56.1386, lon: -3.9187 },
      { match: "Witchery", lat: 55.9489, lon: -3.1956 },
    ],
    "bangkok-table": [
      { match: "Grand Palace", lat: 13.75, lon: 100.4913 },
      { match: "Wat Pho", lat: 13.7465, lon: 100.4927 },
      { match: "Wat Arun", lat: 13.7437, lon: 100.4888 },
      { match: "Jay Fai", lat: 13.7527, lon: 100.5047 },
      { match: "Jim Thompson", lat: 13.7493, lon: 100.5283 },
      { match: "Sky Bar", lat: 13.7216, lon: 100.5171 },
    ],
    "berlin-two-hotels": [
      { match: "Adlon Kempinski", lat: 52.5159, lon: 13.3801 },
      { match: "Brandenburg", lat: 52.5163, lon: 13.3777 },
      { match: "Reichstag", lat: 52.5186, lon: 13.3762 },
      { match: "Borchardt", lat: 52.5136, lon: 13.3902 },
      { match: "Markthalle Neun", lat: 52.5021, lon: 13.4316 },
      { match: "Michelberger", lat: 52.5063, lon: 13.4491 },
    ],
    "sydney-lowercase": [
      { match: "art gallery", lat: -33.8688, lon: 151.2173 },
      { match: "manly", lat: -33.797, lon: 151.288, km: 1.2 },
    ],
  },
};
