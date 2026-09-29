import { strict as assert } from "node:assert";
import { test } from "node:test";
import { headingCities, readPlainPlan } from "./plan-lines.ts";

const read = (text: string, startDate: string | null = "2026-10-10") =>
  readPlainPlan(text, { startDate, tripCity: "Paris, France", today: new Date("2026-01-15") });

test("a tidy 24-hour list is read without a model", () => {
  const plan = read(`Paris — Saturday
08:30 Breakfast at Café de Flore
10:00 Musée d'Orsay (tickets booked, conf #ORS-55821)
13:00 Lunch at Bouillon Chartier, 7 Rue du Faubourg Montmartre
19:30 Dinner at Le Comptoir du Relais`);
  assert.ok(plan);
  assert.equal(plan.trip_title, "Paris");
  assert.deepEqual(
    plan.items.map((i) => [i.day_date, i.time_label, i.place, i.booked]),
    [
      ["2026-10-10", "08:30", "Café de Flore", false],
      ["2026-10-10", "10:00", "Musée d'Orsay", true],
      ["2026-10-10", "13:00", "Bouillon Chartier", false],
      ["2026-10-10", "19:30", "Le Comptoir du Relais", false],
    ],
  );
  assert.equal(plan.items[1]!.detail, "tickets booked, conf #ORS-55821");
  assert.equal(plan.items[2]!.address, "7 Rue du Faubourg Montmartre", "kept verbatim");
  assert.equal(plan.items[2]!.title, "Lunch at Bouillon Chartier");
  assert.equal(plan.items[0]!.kind, "meal");
});

test("Day 1 / Day 2 with am/pm, no dates, and a travel line folded into the next stop", () => {
  const plan = read(
    `Day 1
9am - Tsukiji Outer Market breakfast
11am - Take the Hibiya line to Ginza
11:30am - Ginza Six rooftop
2pm - teamLab Planets ✅

Day 2
8am - Meiji Jingu
4pm - Shibuya Sky ✅ (sunset slot)`,
    null,
  );
  assert.ok(plan);
  assert.deepEqual(
    plan.items.map((i) => [i.day_number, i.day_date, i.time_label, i.booked]),
    [
      [1, null, "09:00", false],
      [1, null, "11:30", false],
      [1, null, "14:00", true],
      [2, null, "08:00", false],
      [2, null, "16:00", true],
    ],
  );
  assert.equal(plan.items[1]!.detail, "Getting there: Take the Hibiya line to Ginza, 11:00");
  assert.equal(plan.items[0]!.place, "Tsukiji Outer Market");
});

test("dated headings, ranges, lengths and a named venue", () => {
  const plan = read(
    `Sat Nov 14
- 9:00–10:30 Breakfast at Russ & Daughters, 179 E Houston St
- 14:00 Brooklyn Bridge walk (about 1h)
- 19:00 Dinner, Lilia — reservation confirmed #8843

Sun Nov 15
- 10:00 The Met (3h)
- 20:00 Broadway: Hamilton, Richard Rodgers Theatre (tickets booked)`,
    "2026-11-14",
  );
  assert.ok(plan);
  assert.deepEqual(
    plan.items.map((i) => [i.day_date, i.end_time ?? null, i.duration_minutes ?? null]),
    [
      ["2026-11-14", "10:30", null],
      ["2026-11-14", null, 60],
      ["2026-11-14", null, null],
      ["2026-11-15", null, 180],
      ["2026-11-15", null, null],
    ],
  );
  assert.equal(plan.items[2]!.place, "Lilia");
  assert.equal(plan.items[2]!.detail, "reservation confirmed #8843");
  assert.equal(plan.items[2]!.booked, true);
  assert.equal(plan.items[4]!.place, "Richard Rodgers Theatre");
});

test("a line naming several places keeps them all in the title and pins the first", () => {
  const plan = read(`Kyoto day
~9:30 Tofuku-ji / Komyo-in
14:00 Kiyomizu-dera + Sannenzaka + Ninenzaka
14:30 Trevi Fountain → Spanish Steps
20:00 Dinner at Pontocho (booked, Kyoto Gion Yuki)`);
  assert.ok(plan);
  assert.deepEqual(
    plan.items.map((i) => [i.title, i.place]),
    [
      ["Tofuku-ji / Komyo-in", "Tofuku-ji"],
      ["Kiyomizu-dera + Sannenzaka + Ninenzaka", "Kiyomizu-dera"],
      ["Trevi Fountain → Spanish Steps", "Trevi Fountain"],
      ["Dinner at Pontocho", "Kyoto Gion Yuki"],
    ],
  );
});

test("Spanish and French time styles, and the meal's own place on a two-place line", () => {
  const plan = read(`Día 1
9h30 Sagrada Família (entradas compradas ✅)
12h Paseo por el Eixample
13h30 Comida en Cervecería Catalana
16h Playa de la Barceloneta, comida en La Cova Fumada`);
  assert.ok(plan);
  assert.deepEqual(
    plan.items.map((i) => [i.time_label, i.place, i.booked]),
    [
      ["09:30", "Sagrada Família", true],
      ["12:00", "Eixample", false],
      ["13:30", "Cervecería Catalana", false],
      ["16:00", "La Cova Fumada", false],
    ],
  );
});

test("a flight, a hotel and a booked train keep their kinds", () => {
  const plan = read(
    `Sat 12 Sep
07:45 Land LHR T5 — BA 94 from Toronto (booking ref QX7KLM)
10:30 Drop bags at The Hoxton, Holborn, 199-206 High Holborn (check-in from 15:00, conf 44781093)
12:31 Eurostar 9O 9031 London St Pancras → Paris Gare du Nord (booked, seat 64, coach 11)`,
    "2026-09-12",
  );
  assert.ok(plan);
  assert.deepEqual(
    plan.items.map((i) => [i.kind, i.booked, i.place]),
    [
      ["flight", true, "LHR T5"],
      ["hotel", true, "The Hoxton"],
      ["transport", true, "London St Pancras"],
    ],
  );
  assert.equal(plan.items[1]!.address, "199-206 High Holborn");
  assert.equal(plan.items[0]!.detail, "BA 94 from Toronto · booking ref QX7KLM");
});

test("anything that is not plainly a list goes to the model", () => {
  // A chat: its timestamps are when people wrote, not when things happen.
  assert.equal(
    read(`[07/03, 21:14] Ana: breakfast at Rosetta 9ish?
[07/03, 21:15] Me: yes!! then Frida Kahlo museum at 11:00
[07/03, 21:16] Me: dinner Contramar 20:00`),
    null,
  );
  // Prose.
  assert.equal(
    read(
      "One perfect day in Lisbon. Start your morning with a pastel de nata at Manteigaria in Chiado — they come out warm every half hour. From there, hop on Tram 28.",
    ),
    null,
  );
  // A line with no time in the middle of the list.
  assert.equal(
    read(`Day 1
09:00 Louvre
Then wander wherever
13:00 Lunch at Chartier
15:00 Orsay`),
    null,
  );
  // A plan that changed on the way.
  assert.equal(
    read(`09:00 Louvre
11:00 Orsay — actually skip it
13:00 Lunch at Chartier
15:00 Rodin`),
    null,
  );
  // Times that run backwards: am/pm left off.
  assert.equal(
    read(`9:00 Louvre
11:00 Orsay
1:00 Lunch at Chartier
3:00 Rodin`),
    null,
  );
  // Tickets or seats with no plain booked mark: a judgement, left to the model.
  assert.equal(
    read(`16:00 N Seoul Tower — got our cable car passes already
19:00 NANTA at Myeongdong Theatre, we have seats in row F
21:30 Gwangjang Market`),
    null,
  );
  // Too short to trust.
  assert.equal(read("09:00 Louvre\n13:00 Lunch"), null);
});

test("skip-the-line tickets are not a changed plan", () => {
  const plan = read(`09:00 Louvre (skip-the-line tickets, booked)
11:00 Orsay
13:00 Lunch at Chartier`);
  assert.ok(plan);
  assert.equal(plan.items[0]!.booked, true);
});

test("a date with no year takes the trip's, or the next one across new year", () => {
  const plan = read(
    `Dec 31
20:00 Dinner at Septime
Jan 1
10:00 Louvre
12:00 Lunch at Chartier`,
    "2026-12-30",
  );
  assert.ok(plan);
  assert.deepEqual(
    plan.items.map((i) => i.day_date),
    ["2026-12-31", "2027-01-01", "2027-01-01"],
  );
});

test("no booking needed is not booked", () => {
  const plan = read(`09:00 Sainte-Chapelle (no booking needed)
11:00 Orsay
13:00 Lunch at Chartier`);
  assert.ok(plan);
  assert.equal(plan.items[0]!.booked, false);
});

test("a day heading names its town, or both ends of a travel day", () => {
  assert.deepEqual(headingCities("Lyon, France"), ["Lyon, France"]);
  assert.deepEqual(headingCities("Paris → Aix-en-Provence"), ["Paris", "Aix-en-Provence"]);
  assert.deepEqual(headingCities("Frankfurt am Main"), ["Frankfurt am Main"]);
});

test("a day heading's theme is not a town", () => {
  assert.deepEqual(headingCities("Arrival"), []);
  assert.deepEqual(headingCities("Museums and markets"), []);
  assert.deepEqual(headingCities("Free day & shopping"), []);
  assert.deepEqual(headingCities(null), []);
});

test("a German plan: street-then-number addresses, spaced-hyphen notes, a night is a stay", () => {
  const plan = read(`Day 1 - 2026-10-01
08:00 Breakfast at Motel One Berlin-Hauptbahnhof, Invalidenstraße 54
09:00-09:40 Brandenburg Gate, Pariser Platz 1 - morning landmark stop
10:45-12:30 Neues Museum, Bodestraße 1-3 - Egyptian and prehistoric collections
13:00 Lunch at Curry 36, Mehringdamm 36
21:00 Motel One Berlin-Hauptbahnhof, Invalidenstraße 54 - overnight`);
  assert.ok(plan);
  const [breakfast, gate, museum, lunch, night] = plan.items;
  assert.equal(breakfast!.kind, "meal");
  assert.equal(breakfast!.address, "Invalidenstraße 54");
  assert.equal(gate!.title, "Brandenburg Gate");
  assert.equal(gate!.address, "Pariser Platz 1");
  assert.equal(gate!.detail, "morning landmark stop");
  assert.equal(gate!.end_time, "09:40");
  assert.equal(museum!.address, "Bodestraße 1-3");
  // "Curry 36" is the name; only the street after it is an address.
  assert.equal(lunch!.place, "Curry 36");
  assert.equal(lunch!.address, "Mehringdamm 36");
  assert.equal(night!.kind, "lodging");
  assert.equal(night!.detail, "overnight");
});

test("a plan copied as a table is read like a list", () => {
  const text = `Day 1 - 2026-10-01
| Time | Place / note |
|---|---|
| 09:00-09:40 | Brandenburg Gate, Pariser Platz 1 | morning landmark stop |
| 12:00 | Lunch at Curry 61, Oranienburger Straße 6 |
| 14:30-16:00 | East Side Gallery, Mühlenstraße 70-71 |`;
  const plan = read(text);
  assert.ok(plan);
  assert.equal(plan.items.length, 3);
  assert.equal(plan.items[0]!.detail, "morning landmark stop");
  const tabs = read(
    text
      .replace(/^\|\s*|\s*\|$/gm, "")
      .replace(/\s*\|\s*/g, "\t")
      .replace(/^[-\t]+$/m, ""),
  );
  assert.ok(tabs);
  assert.equal(tabs.items[2]!.address, "Mühlenstraße 70-71");
});

test("a hyphen between towns on a journey is not a note", () => {
  const plan = read(`Day 1
08:00 Breakfast at Café de Flore
10:00 Train Paris - Lyon
13:00 Lunch at Bouchon Daniel et Denise`);
  assert.ok(plan);
  assert.ok(plan.items.some((i) => /Paris - Lyon/.test(`${i.title} ${i.detail ?? ""}`)));
});

test("a day trip's towns come from its arrivals, departures and returns", () => {
  const plan = read(`Day 7 — 2026-10-07
07:11 Shin-Osaka Station, 5-16-1 Nishinakajima — Shinkansen departure — booked
08:36 Hiroshima Station, 2-37 Matsubaracho — arrival
09:00 Atomic Bomb Dome, 1-10 Otemachi — Peace Memorial Park
12:35 Miyajima — island arrival
13:30 Itsukushima Shrine, 1-1 Miyajimacho — waterfront shrine
17:00 Miyajima Pier — return boat to Peace Park — booked
18:10 Hiroshima Yume Plaza, 8-28 Hondori — regional foods
20:36 Hiroshima Station, 2-37 Matsubaracho — Shinkansen departure — booked
23:00 Citadines Namba Osaka, 3-5-25 Nipponbashi — hotel
Day 9 — 2026-10-09
07:30 Osaka Station, 3-1-1 Umeda — morning departure toward Himeji
09:00 Himeji Castle, 68 Honmachi — castle interior and grounds
12:15 Izakaya Toyo, 3-2-26 Higashinodamachi — arrive before service
20:00 Osaka Station, 3-1-1 Umeda — return to Osaka
20:30 Citadines Namba Osaka, 3-5-25 Nipponbashi — hotel`);
  assert.ok(plan);
  const towns = plan.items.map((i) => `${i.title.split(",")[0]}: ${i.city ?? "-"}`);
  assert.deepEqual(towns, [
    "Shin-Osaka Station: -",
    "Hiroshima Station: Hiroshima",
    "Atomic Bomb Dome: Hiroshima",
    "Miyajima: Miyajima",
    "Itsukushima Shrine: Miyajima",
    "Miyajima Pier: Miyajima",
    "Hiroshima Yume Plaza: Hiroshima",
    "Hiroshima Station: Hiroshima",
    "Citadines Namba Osaka: -",
    "Osaka Station: -",
    "Himeji Castle: Himeji",
    // "Arrive before service" is not arriving in a town.
    "Izakaya Toyo: Himeji",
    "Osaka Station: Himeji",
    "Citadines Namba Osaka: Osaka",
  ]);
});

test("a long plan is still read line by line", () => {
  const lines = ["Day 1 — 2026-10-01"];
  for (let i = 0; i < 100; i++) {
    const h = 6 + Math.floor(i / 6);
    lines.push(
      `${String(h).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")} Stop ${i} Museum`,
    );
  }
  const plan = read(lines.join("\n"));
  assert.ok(plan);
  assert.equal(plan.items.length, 100);
});
