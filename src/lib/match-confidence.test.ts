import { strict as assert } from "node:assert";
import { test } from "node:test";
import { autoPinTrusted, nameEchoes, scoreMatch, tallyConfidence } from "./match-confidence.ts";

test("a venue that came back under its own name is trusted", () => {
  const { confidence } = scoreMatch({
    title: "Olive et Gourmando",
    label: "Olive et Gourmando, 351, Rue Saint-Paul Ouest, Montréal, Canada",
    category: "amenity",
    kind: "cafe",
  });
  assert.equal(confidence, "high");
});

test("the Old Montréal failure is caught: a café that came back as a district", () => {
  // The exact shape of the bug — a plausible pin, in the right city, wrong place.
  const { confidence, reason } = scoreMatch({
    title: "Olive et Gourmando",
    label: "Old Montréal, Ville-Marie, Montréal, Canada",
    category: "place",
    kind: "suburb",
  });
  assert.equal(confidence, "low");
  assert.match(reason, /area/i);
});

test("a name that is simply something else is flagged", () => {
  const { confidence } = scoreMatch({
    title: "Mandy's",
    label: "Pharmaprix, Rue Sainte-Catherine, Montréal, Canada",
    category: "shop",
    kind: "chemist",
  });
  assert.equal(confidence, "low");
});

test("a neighbourhood asked for by name is a fair match, not a failure", () => {
  const { confidence } = scoreMatch({
    title: "Mile End",
    label: "Mile End, Le Plateau-Mont-Royal, Montréal, Canada",
    category: "place",
    kind: "suburb",
  });
  assert.equal(confidence, "medium");
});

test("no name back at all is a maybe, not a yes", () => {
  assert.equal(scoreMatch({ title: "Somewhere", label: null }).confidence, "medium");
});

test("nameEchoes ignores the words that carry no identity", () => {
  // "cafe" matching "cafe" is not evidence of anything.
  assert.equal(nameEchoes("Café de Flore", "Café des Anges, Paris"), false);
  assert.equal(nameEchoes("Café de Flore", "Café de Flore, Paris"), true);
});

test("nameEchoes copes with accents and with scripts that have no spaces", () => {
  assert.equal(nameEchoes("Marché Jean-Talon", "Marche Jean-Talon, Montreal"), true);
  assert.equal(nameEchoes("清水寺", "清水寺, 京都市, 日本"), true);
  assert.equal(nameEchoes("清水寺", "金閣寺, 京都市, 日本"), false);
});

test("tallyConfidence counts what needs a look", () => {
  const t = tallyConfidence(["high", "high", "medium", "low", "high"]);
  assert.deepEqual(t, { high: 3, medium: 1, low: 1, needsLook: 2 });
});

test("a background pin is saved only when it plausibly is the stop", async () => {
  const { autoPinTrusted } = await import("./match-confidence.ts");
  // The right place, by name.
  assert.equal(
    autoPinTrusted(
      { title: "Lunch: Kakiya" },
      { label: "Kakiya, Miyajimacho, Hatsukaichi", category: "amenity", kind: "restaurant" },
    ),
    true,
  );
  // A namesake park for a restaurant: not saved.
  assert.equal(
    autoPinTrusted(
      { title: "Oyster lunch" },
      { label: "Momijidani Park, Miyajima", category: "leisure", kind: "park" },
    ),
    false,
  );
  // Found by its street address: the title does not echo, the address does.
  assert.equal(
    autoPinTrusted(
      { title: "Morning treat by the water", address: "310 Rue de la Commune E" },
      {
        label: "310, Rue de la Commune Est, Vieux-Montréal, Montréal",
        category: "place",
        kind: "house",
      },
    ),
    true,
  );
  // A whole neighbourhood for a café: not saved.
  assert.equal(
    autoPinTrusted(
      { title: "Mandy's" },
      { label: "Old Montreal, Montréal", category: "place", kind: "neighbourhood" },
    ),
    false,
  );
});

test("a place labelled in its own script matches through its other names", () => {
  const station = {
    label: "広島駅, 広島駅南北自由通路",
    category: "railway",
    kind: "station",
  };
  assert.equal(scoreMatch({ title: "Arrive Hiroshima Station", ...station }).confidence, "low");
  assert.equal(
    scoreMatch({
      title: "Arrive Hiroshima Station",
      ...station,
      alsoNamed: ["広島駅", "Hiroshima Station", "ひろしまえき"],
    }).confidence,
    "high",
  );
  // Other names that do not echo change nothing.
  assert.equal(
    scoreMatch({ title: "Oyster lunch", ...station, alsoNamed: ["広島駅", "Hiroshima Station"] })
      .confidence,
    "low",
  );
});

test("a town in a shop's name does not match every place in that town", async () => {
  const { autoPinTrusted } = await import("./match-confidence.ts");
  const stop = { title: "Fujiiya Miyajima Main Store", address: "Hatsukaichi, Japan" };
  // The island's town answering for the shop: not saved.
  assert.equal(
    autoPinTrusted(stop, {
      label: "Miyajimacho, Hatsukaichi, Hiroshima Prefecture, Japan",
      category: "place",
      kind: "suburb",
    }),
    false,
  );
  // Another shop on the island, which shares only the island's name.
  assert.equal(
    autoPinTrusted(stop, {
      label: "Miyajima Omotesando Shop, Miyajimacho, Hatsukaichi, Japan",
      category: "shop",
      kind: "gift",
    }),
    false,
  );
  // The right shop.
  assert.equal(
    autoPinTrusted(stop, {
      label: "Fujiiya, 1129 Miyajimacho, Hatsukaichi, Japan",
      category: "shop",
      kind: "confectionery",
    }),
    true,
  );
});

test("a town given as the address does not vouch for whatever is in it", async () => {
  const { autoPinTrusted } = await import("./match-confidence.ts");
  assert.equal(
    autoPinTrusted(
      { title: "Fujiiya", address: "Hatsukaichi, Japan" },
      { label: "Hatsukaichi Station, Hatsukaichi, Japan", category: "railway", kind: "station" },
    ),
    false,
  );
});

test("a station named after its city still matches in English labels", () => {
  assert.equal(
    scoreMatch({
      title: "Arrive Hiroshima Station",
      label: "Hiroshima Station, Matsubaracho, Minami Ward, Hiroshima, Japan",
      category: "railway",
      kind: "station",
    }).confidence,
    "high",
  );
});

test("a well-named find far outside the town is not pinned unasked", () => {
  const hit = {
    label: "Mercado Municipal, Liberdade, Barreiras",
    category: "amenity",
    kind: "marketplace",
  };
  assert.equal(autoPinTrusted({ title: "Mercado Municipal" }, hit), true);
  assert.equal(autoPinTrusted({ title: "Mercado Municipal" }, { ...hit, farKm: 21 }), false);
});

test("a street named after a place is not the place", () => {
  // Barreiras: "Rio de Ondas", the bathing spot, was pinned on Rua Rio de Ondas.
  const street = {
    label: "Rua Rio de Ondas, Vila Dulce, Barreiras",
    category: "highway",
    kind: "residential",
  };
  assert.equal(scoreMatch({ title: "Rio de Ondas", ...street }).confidence, "low");
  assert.equal(autoPinTrusted({ title: "Rio de Ondas" }, street), false);
  // A stop that is a street may still land on one.
  assert.equal(scoreMatch({ title: "Rua Rio de Ondas", ...street }).confidence, "high");
  assert.equal(
    scoreMatch({
      title: "Granville Street",
      label: "Granville Street, Vancouver",
      category: "highway",
      kind: "primary",
    }).confidence,
    "high",
  );
  // German runs the street word into the name.
  assert.equal(
    scoreMatch({
      title: "Friedrichstraße",
      label: "Friedrichstraße, Berlin",
      category: "highway",
      kind: "secondary",
    }).confidence,
    "high",
  );
  // Written short, as Portuguese streets often are.
  assert.equal(
    scoreMatch({
      title: "R. Augusta",
      label: "Rua Augusta, Lisboa",
      category: "highway",
      kind: "pedestrian",
    }).confidence,
    "high",
  );
});

test("a venue named after its street is not the street", () => {
  for (const [title, label] of [
    ["Park Avenue Hotel", "Park Avenue, New York"],
    ["Abbey Road Studios", "Abbey Road, London"],
    ["Café da Rua Augusta", "Rua Augusta, Lisboa"],
  ] as const) {
    assert.equal(
      scoreMatch({ title, label, category: "highway", kind: "residential" }).confidence,
      "low",
      title,
    );
  }
});

test("another branch of a chain, or a namesake with another number, is not the stop", () => {
  const wrongBranch = scoreMatch({
    title: "Motel One Frankfurt-Hauptbahnhof",
    label: "Motel One Berlin-Alexanderplatz, Dircksenstraße 36, Mitte, Berlin, 10179, Germany",
    category: "tourism",
    kind: "hotel",
  });
  assert.equal(wrongBranch.confidence, "low");
  const rightBranch = scoreMatch({
    title: "Motel One Frankfurt-Hauptbahnhof",
    label: "Motel One Frankfurt-Hauptbahnhof, Poststraße 8, Gallus, Frankfurt am Main, Germany",
    category: "tourism",
    kind: "hotel",
  });
  assert.equal(rightBranch.confidence, "high");
  const otherNumber = scoreMatch({
    title: "Curry 36",
    label: "Curry 61, Oranienburger Straße 6, Mitte, Berlin, Germany",
    category: "amenity",
    kind: "fast_food",
  });
  assert.equal(otherNumber.confidence, "low");
  const namesake = scoreMatch({
    title: "Apfelwein Dax",
    label: "Apfelwein Klaus, Pankower Straße 1, Pankow, Berlin, Germany",
    category: "amenity",
    kind: "restaurant",
  });
  assert.equal(namesake.confidence, "low");
  // A found name longer than the stop's, with nothing of the stop's missing, is it.
  const longer = scoreMatch({
    title: "Starbucks Reserve Roastery",
    label: "Starbucks Reserve Roastery Tokyo, 2-19-23 Aobadai, Meguro, Tokyo, Japan",
    category: "amenity",
    kind: "cafe",
  });
  assert.equal(longer.confidence, "high");
});

test("an address found without its number is a district, not the address", () => {
  // "68 Honmachi" is Himeji Castle; Osaka has a Honmachi too.
  const district = scoreMatch({
    title: "68 Honmachi",
    label: "Honmachi, Chuo Ward, Osaka, 541-0053, Japan",
    category: "place",
    kind: "quarter",
  });
  assert.equal(district.confidence, "low");
  const right = scoreMatch({
    title: "68 Honmachi",
    label: "68 Honmachi, Himeji, Hyogo 670-0012, Japan",
    category: "building",
    kind: "yes",
  });
  assert.notEqual(right.confidence, "low");
  const german = scoreMatch({
    title: "Poststraße 8",
    label: "8, Poststraße, Gallus, Frankfurt am Main, Hessen, 60329, Germany",
    category: "building",
    kind: "hotel",
  });
  assert.notEqual(german.confidence, "low");
});

test("a station named for its town is not another station in that town", () => {
  const tennoji = scoreMatch({
    title: "Osaka Station",
    label: "Tennoji Station, Abeno Ward, Osaka, 545-0052, Japan",
    category: "railway",
    kind: "station",
  });
  assert.equal(tennoji.confidence, "low");
  const umeda = scoreMatch({
    title: "Osaka Station",
    label: "Osaka Station, Umeda, Kita Ward, Osaka, Japan",
    category: "railway",
    kind: "station",
  });
  assert.equal(umeda.confidence, "high");
});

test("scoreMatch: a local name in brackets, a hyphen or a building part is the same place", () => {
  const score = (title: string, label: string) =>
    scoreMatch({ title, label, category: "tourism", kind: "museum", alsoNamed: null }).confidence;
  assert.equal(
    score(
      "Hiroshima Peace Memorial Museum (広島平和記念資料館)",
      "Hiroshima Peace Memorial Museum Main Building, Peace Boulevard, Nakajimacho, Naka Ward, Hiroshima, Japan",
    ),
    "high",
  );
  assert.equal(
    score(
      "Okonomimura (お好み村)",
      "Okonomi-mura, Namiki-dori, Mikawacho, Naka Ward, Hiroshima, Japan",
    ),
    "high",
  );
  // Still another place: a chain's other branch, or a namesake church.
  assert.equal(
    score(
      "Motel One Frankfurt-Hauptbahnhof",
      "Motel One Berlin-Alexanderplatz, Dircksenstraße, Berlin, Germany",
    ),
    "low",
  );
  assert.equal(
    score(
      "St. Peter's Basilica",
      "Saint Peter in Chains, 4/a, Piazza di San Pietro in Vincoli, Rome",
    ),
    "low",
  );
});

test("the stop's words strewn through a longer name are a namesake", () => {
  const seaPoint = scoreMatch({
    title: "Cape Point",
    label: "Protea Hotel Cape Town Sea Point, Arthurs Road, Cape Town, 8005, South Africa",
    category: "tourism",
    kind: "hotel",
  });
  assert.equal(seaPoint.confidence, "low");
  const university = scoreMatch({
    title: "Sydney Central Station",
    label: "Central Queensland University Sydney, 400 Kent Street, Sydney NSW 2000, Australia",
    category: "place",
    kind: "amenity",
  });
  assert.equal(university.confidence, "low");
  // Held together, with a part after it, it is the place.
  const deck = scoreMatch({
    title: "Kyoto Tower",
    label: "Kyoto Tower Main Deck, Karasuma-dori, Shimogyo Ward, Kyoto, Japan",
    category: "tourism",
    kind: "attraction",
  });
  assert.equal(deck.confidence, "high");
});

test("a business named after a landmark is not the landmark", () => {
  const vineyards = scoreMatch({
    title: "Cape Point",
    label: "Cape Point Vineyards, Silvermine Road, Cape Town, 7985, South Africa",
    category: "amenity",
    kind: "restaurant",
  });
  assert.equal(vineyards.confidence, "low");
  const building = scoreMatch({
    title: "Cape Point",
    label: "Cape Point Vineyards Restaurant, Silvermine Road, Cape Town, South Africa",
    category: "building",
    kind: "building",
  });
  assert.equal(building.confidence, "low");
  const hotel = scoreMatch({
    title: "Sydney Central Station",
    label: "Sydney Central Hotel, 169-179 Thomas Street, Haymarket NSW 2000, Australia",
    category: "tourism",
    kind: "hotel",
  });
  assert.equal(hotel.confidence, "low");
  // A meal is answered by a restaurant, whatever else it is called.
  const lunch = scoreMatch({
    title: "Lunch at Geysir Glíma",
    label: "Geysir Glíma Restaurant, Biskupstungnabraut, Bláskógabyggð, Iceland",
    category: "amenity",
    kind: "restaurant",
  });
  assert.equal(lunch.confidence, "high");
});

test("an address matched by its number alone is another address", () => {
  const otherBlock = scoreMatch({
    title: "160 Kasuganocho",
    label: "160-6 雑司町, Nara, NR 630-8201, Japan",
    category: "place",
    kind: "building",
  });
  assert.equal(otherBlock.confidence, "low");
  const right = scoreMatch({
    title: "160 Kasuganocho",
    label: "160 Kasuganochō, Nara, 630-8212, Japan",
    category: "place",
    kind: "building",
  });
  assert.equal(right.confidence, "high");
});
