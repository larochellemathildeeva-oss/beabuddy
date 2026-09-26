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
