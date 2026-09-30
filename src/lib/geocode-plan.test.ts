import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  airportMatch,
  airportNameWords,
  areaHitFor,
  boxAround,
  distanceKm,
  estimatedSeconds,
  labelAddress,
  nameVariants,
  namesAirport,
  outingReachKm,
  pickHit,
  planStopQueries,
  QUERIES_PER_STOP,
  stopsNeedingLocation,
} from "./geocode-plan.ts";

test("no area means no lookup at all — never a bare name", () => {
  // This is the Slovakia rule: a bare "Harvey's" is how a Montreal burger
  // ended up in eastern Europe.
  assert.deepEqual(planStopQueries({ title: "Harvey's" }, null), []);
  assert.deepEqual(planStopQueries({ title: "Harvey's" }, "   "), []);
  assert.deepEqual(planStopQueries({ title: "Harvey's" }, undefined), []);
});

test("every query carries the area", () => {
  const queries = planStopQueries({ title: "Harvey's" }, "Montreal, Canada");
  assert.ok(queries.length > 0);
  for (const q of queries) assert.ok(q.endsWith("Montreal, Canada"), q);
});

test("an untitled stop is not looked up", () => {
  assert.deepEqual(planStopQueries({ title: "   " }, "Lisbon, Portugal"), []);
});

test("the detail line is used as a hint when it names a place", () => {
  // Planner items stash the venue or street in detail and leave coords empty.
  const queries = planStopQueries(
    { title: "Lunch", detail: "1038 Canada Place, Vancouver; suggest booking" },
    "Vancouver, Canada",
  );
  assert.ok(
    queries.some((q) => /canada place/i.test(q)),
    queries.join(" | "),
  );
});

test("queries are capped so a long plan stays bounded", () => {
  const queries = planStopQueries(
    { title: "Museum of Art and History", detail: "12 Rue Example, Paris" },
    "Paris, France",
  );
  assert.ok(queries.length <= QUERIES_PER_STOP, `${queries.length} queries`);
});

test("duplicate candidates collapse to one query", () => {
  const queries = planStopQueries({ title: "Louvre", detail: "Louvre" }, "Paris, France");
  assert.equal(new Set(queries.map((q) => q.toLowerCase())).size, queries.length);
});

test("stopsNeedingLocation skips what is already placed", () => {
  const stops = [
    { title: "Placed", lat: 45.5, lon: -73.5 },
    { title: "Unplaced" },
    { title: "Half placed", lat: 45.5 },
    { title: "  " },
  ];
  assert.deepEqual(
    stopsNeedingLocation(stops).map((s) => s.title),
    ["Unplaced", "Half placed"],
  );
});

test("estimatedSeconds rounds up, because a part second is still a wait", () => {
  assert.equal(estimatedSeconds(10, 1100), 11);
  assert.equal(estimatedSeconds(1, 1100), 2);
  assert.equal(estimatedSeconds(0, 1100), 0);
});

test("the area's box, widened, keeps Old Montreal and rejects Valcartier", async () => {
  const { areaBoxFrom, widenBox, inBox, boxViewbox } = await import("./geocode-plan.ts");
  // Montreal's box as Nominatim gives it: [south, north, west, east].
  const montreal = areaBoxFrom(["45.4100", "45.7048", "-73.9740", "-73.4742"]);
  assert.ok(montreal);
  const box = widenBox(montreal);
  assert.ok(inBox(box, 45.5075, -73.5519), "Old Port");
  assert.ok(inBox(box, 45.4576, -73.7497), "the airport, just past the line");
  assert.ok(!inBox(box, 46.985723, -71.407334), "Valcartier");
  assert.equal(boxViewbox(montreal), "-73.97400,45.70480,-73.47420,45.41000");
});

test("a malformed box is no box", async () => {
  const { areaBoxFrom } = await import("./geocode-plan.ts");
  assert.equal(areaBoxFrom(undefined), null);
  assert.equal(areaBoxFrom(["1", "2", "3"]), null);
  assert.equal(areaBoxFrom(["50", "40", "0", "1"]), null);
  assert.equal(areaBoxFrom(["a", "b", "c", "d"]), null);
});

test("a city with no size still gets a margin of about ten kilometres", async () => {
  const { areaBoxFrom, widenBox, inBox } = await import("./geocode-plan.ts");
  const point = widenBox(areaBoxFrom(["45.5", "45.5", "-73.5", "-73.5"])!);
  assert.ok(inBox(point, 45.55, -73.45));
  assert.ok(!inBox(point, 45.8, -73.5));
});

test("a stop far from the rest of the trip is flagged; a road trip is not", async () => {
  const { strayStopIds } = await import("./geocode-plan.ts");
  const city = [
    { id: "a", lat: 45.5075, lon: -73.5519 },
    { id: "b", lat: 45.5017, lon: -73.5673 },
    { id: "c", lat: 45.5231, lon: -73.6017 },
    { id: "d", lat: 45.4972, lon: -73.5794 },
    { id: "castor", lat: 46.985723, lon: -71.407334 },
    { id: "unplaced", lat: null, lon: null },
  ];
  assert.deepEqual([...strayStopIds(city)], ["castor"]);
  const roadTrip = [
    { id: "mtl", lat: 45.5, lon: -73.57 },
    { id: "qc", lat: 46.81, lon: -71.21 },
    { id: "ott", lat: 45.42, lon: -75.69 },
    { id: "tor", lat: 43.65, lon: -79.38 },
  ];
  assert.equal(strayStopIds(roadTrip).size, 0);
});

test("a day trip far from the rest of the trip is not flagged; a lone pin is", async () => {
  const { strayStopIds } = await import("./geocode-plan.ts");
  const at = (id: string, day: string, lat: number, lon: number) => ({
    id,
    day_date: day,
    lat,
    lon,
  });
  const kyoto = [
    at("fushimi", "2026-10-02", 34.9671, 135.7727),
    at("nishiki", "2026-10-02", 35.005, 135.7649),
    at("kinkaku", "2026-10-03", 35.0394, 135.7292),
    at("ginkaku", "2026-10-03", 35.027, 135.7982),
    at("kiyomizu", "2026-10-04", 34.9949, 135.785),
    at("arashiyama", "2026-10-04", 35.0094, 135.6668),
    // Day 7: a day trip to Hiroshima and Miyajima, ~300 km away.
    at("dome", "2026-10-07", 34.3955, 132.4536),
    at("peace-park", "2026-10-07", 34.3916, 132.4527),
    at("itsukushima", "2026-10-07", 34.2959, 132.3199),
    // A namesake pinned in Tokyo on a Kyoto day.
    at("wrong", "2026-10-04", 35.6764, 139.65),
  ];
  assert.deepEqual([...strayStopIds(kyoto)], ["wrong"]);
});

test("the source's address and venue are asked for before the title", async () => {
  const { planStopQueries } = await import("./geocode-plan.ts");
  const q = planStopQueries(
    {
      title: "Morning treat by the water",
      place: "Queue de Castor",
      address: "310 Rue de la Commune E",
    },
    "Montreal, Canada",
  );
  assert.equal(q[0], "310 Rue de la Commune E, Montreal, Canada");
  assert.ok(q.includes("Queue de Castor, Montreal, Canada"), q.join(" | "));
});

test("a venue with its local name in brackets tries both", async () => {
  const { planStopQueries } = await import("./geocode-plan.ts");
  const q = planStopQueries(
    { title: "Shrine visit", place: "Itsukushima Shrine (厳島神社)" },
    "Miyajima, Japan",
  );
  assert.deepEqual(q.slice(0, 2), [
    "Itsukushima Shrine, Miyajima, Japan",
    "厳島神社, Miyajima, Japan",
  ]);
});

test("boxAround is about 45 km each way", async () => {
  const { boxAround } = await import("./geocode-plan.ts");
  const box = boxAround({ lat: 34.39, lon: 132.45 });
  assert.ok(Math.abs(box.north - box.south - 0.81) < 0.01);
  assert.ok(box.west < 132.45 && box.east > 132.45);
  assert.ok(
    box.east - box.west > box.north - box.south,
    "wider in longitude away from the equator",
  );
});

const MA_BOX = { south: -3.2, north: -2.3, west: -43.4, east: -42.5 };
const PARK_STOP = {
  title: "Lençóis Maranhenses National Park 4x4 Tour",
  place: "Lençóis Maranhenses National Park",
};
const TOWN = {
  lat: -2.75,
  lon: -42.83,
  label: "Barreirinhas, MA, Brazil",
  category: "place",
  kind: "city",
};
const PARK = {
  lat: -2.53,
  lon: -43.12,
  label: "Lençóis Maranhenses National Park, Barreirinhas, MA, Brazil",
  category: "leisure",
  kind: "nature_reserve",
};

test("pickHit prefers the place itself over the town the geocoder fell back to", () => {
  const picked = pickHit([TOWN, PARK], MA_BOX, PARK_STOP);
  assert.equal(picked?.trusted, true);
  assert.equal(picked?.hit, PARK);
});

test("pickHit returns a town-only answer as untrusted, so the search goes on", () => {
  const picked = pickHit([TOWN], MA_BOX, PARK_STOP);
  assert.equal(picked?.trusted, false);
  assert.equal(picked?.hit, TOWN);
});

test("pickHit ignores answers outside the box", () => {
  assert.equal(pickHit([{ ...PARK, lat: 10 }], MA_BOX, PARK_STOP), null);
});

test("a found place's label is shortened to where it is", () => {
  assert.equal(
    labelAddress(
      "Mercado Municipal, Rua Barão do Rio Branco, Centro, Barreiras, Microrregião de Barreiras, Mesorregião do Extremo Oeste Baiano, Bahia, Região Nordeste, 47800-000, Brasil",
    ),
    "Mercado Municipal, Rua Barão do Rio Branco, Centro, Barreiras",
  );
  assert.equal(labelAddress(""), null);
  assert.equal(labelAddress(undefined), null);
});

test("distanceKm measures the Liberdade namesake as out of town", () => {
  // Barreiras' centre, and the village market Google showed for the stop.
  const km = distanceKm({ lat: -12.1439, lon: -44.9968 }, { lat: -11.961, lon: -45.0143 });
  assert.ok(km > 15 && km < 25, String(km));
});

test("planStopQueries asks a Japanese block address the way the map reads it", () => {
  const queries = planStopQueries(
    { title: "Excelsior Caffé Shinsaibashi", address: "2-3-23 Shinsaibashisuji" },
    "Osaka, Japan",
  );
  assert.equal(queries[0], "Shinsaibashisuji 2-chome 3-23, Osaka, Japan");
  assert.ok(!queries.includes("2-3-23 Shinsaibashisuji, Osaka, Japan"));
  assert.ok(queries.some((q) => q.startsWith("Excelsior Caffé Shinsaibashi")));
});

test("planStopQueries keeps the chōme alone as the last address try", async () => {
  const { QUERIES_PER_STOP } = await import("./geocode-plan.ts");
  const queries = planStopQueries(
    { title: "Lunch", address: "2-3-23 Shinsaibashisuji" },
    "Osaka, Japan",
  );
  assert.equal(queries[0], "Shinsaibashisuji 2-chome 3-23, Osaka, Japan");
  assert.ok(queries.includes("Shinsaibashisuji 2-chome, Osaka, Japan"));
  assert.ok(queries.length <= QUERIES_PER_STOP);
});

test("pickHit: an airport stop takes only an airport", () => {
  const osaka = { south: 34.48, north: 34.85, west: 135.3, east: 135.65 };
  const hotel = {
    lat: 34.70055,
    lon: 135.50341,
    label: "Hotel Kansai, Ōsaka, Osaka, Japan",
    category: "tourism",
    kind: "hotel",
  };
  const stop = {
    title: "Arrive at Kansai International Airport",
    place: "Kansai International Airport",
  };
  assert.equal(pickHit([hotel], osaka, stop), null);
  const kix = {
    lat: 34.4347,
    lon: 135.244,
    label: "Kansai International Airport, Izumisano, Osaka, Japan",
    category: "aeroway",
    kind: "aerodrome",
  };
  const around = boxAround({ lat: 34.6937, lon: 135.5023 }, 70);
  assert.equal(pickHit([hotel, kix], around, stop)?.hit, kix);
  // A museum about flying is not an airport stop, and keeps its own matches.
  assert.equal(namesAirport({ title: "Airport Museum" }), false);
  assert.equal(
    namesAirport({ title: "Flight AC 16", place: "Kansai International Airport (関西国際空港)" }),
    true,
  );
  assert.equal(namesAirport({ title: "Arrive", place: "Aeropuerto de Barajas T4" }), true);
});

test("an airport written as its code is searched as an airport and trusted as one", () => {
  const stop = { title: "Land at JFK on AC 764", place: "JFK" };
  assert.equal(planStopQueries(stop, "New York, USA")[0], "JFK Airport, New York, USA");
  const jfk = {
    lat: 40.6429,
    lon: -73.7794,
    label: "John F. Kennedy International Airport, JFK Access Road, Queens, New York, USA",
    category: "aeroway",
    kind: "aerodrome",
  };
  const nyc = { south: 40.4, north: 41, west: -74.3, east: -73.6 };
  assert.deepEqual(pickHit([jfk], nyc, stop), { hit: jfk, trusted: true });
  assert.equal(airportMatch(stop, jfk), true);
  assert.equal(airportMatch({ title: "Katz's Delicatessen" }, jfk), false);
});

test("areaHitFor: the town the trip names, not the country answered first", () => {
  const country = { display_name: "Mexico" };
  const city = { display_name: "Mexico City, Mexico" };
  assert.equal(areaHitFor([country, city], "Mexico City, Mexico"), city);
  assert.equal(
    areaHitFor([{ display_name: "Kyōto, Kyoto Prefecture, Japan" }], "Kyoto, Japan")?.display_name,
    "Kyōto, Kyoto Prefecture, Japan",
  );
  assert.equal(areaHitFor([country], "Mexico City, Mexico"), null);
});

test("areaHitFor: the city, not the region of the same name", () => {
  // LocationIQ calls the city "Cuzco" and answers the region "Cusco" second.
  const city = {
    display_name: "Cuzco, Distrito de Cusco, Province of Cusco, Cusco, 08001, Peru",
    class: "place",
    type: "city",
    namedetails: { name: "Cuzco", "name:qu": "Qusqu", alt_name: "Cusco" },
  };
  const region = {
    display_name: "Cusco, Peru",
    class: "boundary",
    type: "administrative",
    namedetails: { name: "Cusco" },
  };
  assert.equal(areaHitFor([city, region], "Cusco, Peru"), city);
  assert.equal(areaHitFor([region, city], "Cusco, Peru"), city);
  // A region alone is still better than nothing named for it.
  assert.equal(areaHitFor([region], "Cusco, Peru"), region);
});

test("outingReachKm: a drive out widens how far from town a stop may be", () => {
  assert.equal(outingReachKm("walk the Almannagjá gorge · getting there: drive, 45 min"), 59);
  assert.equal(outingReachKm("getting there: train, 1h 30 min"), 117);
  assert.equal(outingReachKm("getting there: metro line 4, 15 min"), null);
  assert.equal(outingReachKm("getting there: walk, 40 min"), null);
  assert.equal(outingReachKm("getting there: bus, 10 min"), null);
  assert.equal(outingReachKm("penguins"), null);
  assert.equal(outingReachKm(null), null);
});

test("pickHit: the answer named for the whole stop over one sharing a word", () => {
  const box = boxAround({ lat: 64.9, lon: -19 }, 400);
  const shop = {
    lat: 65.68,
    lon: -18.09,
    label: "Geysir, 600 Akureyri, Iceland",
    category: "place",
    kind: "amenity",
  };
  const restaurant = {
    lat: 64.3101,
    lon: -20.2999,
    label: "Geysir Glíma Restaurant, Biskupstungnabraut, Bláskógabyggð, Iceland",
    category: "amenity",
    kind: "restaurant",
  };
  const picked = pickHit([shop, restaurant], box, {
    title: "Lunch at Geysir Glíma",
    place: "Geysir Glíma",
  });
  assert.equal(picked?.hit, restaurant);
  assert.equal(picked?.trusted, true);
});

test("pickHit: a street address with its town is the one in that town", () => {
  const box = boxAround({ lat: -33.71, lon: 150.32 }, 20);
  const katoomba = {
    lat: -33.7122,
    lon: 150.3326,
    label: "84 Railway Parade, Sydney NSW 2780, Australia",
    category: "place",
    kind: "building",
  };
  const leura = {
    lat: -33.7126,
    lon: 150.3317,
    label: "84 Railway Parade, Leura NSW 2780, Australia",
    category: "place",
    kind: "building",
  };
  const picked = pickHit([katoomba, leura], box, {
    title: "Lunch at Leura Garage",
    place: "Leura Garage",
    address: "84 Railway Parade, Leura",
  });
  assert.equal(picked?.hit, leura);
});

test("pickHit: an airport named by more than its town must be that one", () => {
  assert.deepEqual(airportNameWords({ title: "Arrive at Narita International Airport" }), [
    "narita",
  ]);
  assert.deepEqual(airportNameWords({ title: "Land at JFK", place: "JFK" }), []);
  const box = boxAround({ lat: 35.68, lon: 139.76 }, 80);
  const haneda = {
    lat: 35.549,
    lon: 139.78,
    label: "Tokyo International Airport, Tokyo, Japan",
    category: "aeroway",
    kind: "aerodrome",
  };
  const narita = {
    lat: 35.772,
    lon: 140.393,
    label: "Narita International Airport, Narita-shi, Japan",
    category: "aeroway",
    kind: "aerodrome",
  };
  const stop = {
    title: "Arrive at Narita International Airport",
    place: "Narita International Airport",
  };
  assert.equal(pickHit([haneda, narita], box, stop)?.hit, narita);
  assert.equal(pickHit([haneda], box, stop)?.trusted, false);
  // A bus stop named for the airport is not the airport.
  const bus = {
    lat: 41.9,
    lon: 12.5,
    label: "[Terra-vision] Buses for Rome Airport, Via Marsala, Rome",
    category: "highway",
    kind: "bus_stop",
  };
  const rome = boxAround({ lat: 41.9, lon: 12.5 }, 80);
  assert.equal(
    pickHit([bus], rome, {
      title: "Arrive at Rome Fiumicino Airport",
      place: "Rome Fiumicino Airport",
    }),
    null,
  );
});

test("nameVariants: the ways the map may name a place the plan romanises", () => {
  assert.deepEqual(nameVariants("Togetsukyō Bridge"), ["Togetsukyo", "Togetsukyo Bridge"]);
  assert.deepEqual(nameVariants("Ikuta Jinja"), ["Ikuta Shrine"]);
  assert.deepEqual(nameVariants("Kōdai-ji"), ["Kodaiji Temple", "Kodai-ji"]);
  assert.deepEqual(nameVariants("Ninenzaka"), ["Ninen-zaka"]);
  assert.deepEqual(nameVariants("Daishō-in"), ["Daishoin Temple", "Daisho-in"]);
  // Nothing to try for a plain English name.
  assert.deepEqual(nameVariants("Grand Front Osaka"), []);
});
