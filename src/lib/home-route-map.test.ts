import { test } from "node:test";
import assert from "node:assert/strict";
import {
  flightParts,
  heroWhen,
  mapBounds,
  pillStops,
  placePills,
  routeStops,
  smoothPath,
  stayDays,
  stayLabel,
} from "./home-route-map.ts";

test("stayDays counts nights, a same-day stop as one day", () => {
  assert.equal(stayDays("2026-04-12", "2026-04-15"), 3);
  assert.equal(stayDays("2026-04-12", "2026-04-12"), 1);
  assert.equal(stayDays("2026-04-12", null), null);
  assert.equal(stayDays("2026-04-15", "2026-04-12"), null);
  assert.equal(stayDays("soon", "2026-04-12"), null);
});

test("stayLabel", () => {
  assert.equal(stayLabel(1), "1 day");
  assert.equal(stayLabel(3), "3 days");
  assert.equal(stayLabel(null), "");
});

test("routeStops keeps placed stops in order and merges a city twice in a row", () => {
  const stops = routeStops([
    { city: "Paris", lat: 48.86, lon: 2.35, arrive_on: "2026-04-12", depart_on: "2026-04-14" },
    { city: "paris ", lat: 48.8, lon: 2.3, arrive_on: "2026-04-14", depart_on: "2026-04-15" },
    { city: "Nowhere", lat: null, lon: null },
    { city: "Prague", lat: 50.08, lon: 14.43, arrive_on: "2026-04-15", depart_on: "2026-04-16" },
    { city: "Berlin", lat: 52.52, lon: 13.4 },
  ]);
  assert.deepEqual(
    stops.map((s) => [s.city, s.days]),
    [
      ["Paris", 3],
      ["Prague", 1],
      ["Berlin", null],
    ],
  );
});

test("mapBounds pads the stops and gives one city a region around it", () => {
  const [[w, s], [e, n]] = mapBounds([{ lat: 35.68, lon: 139.69 }]);
  assert.ok(e - w >= 9 - 1e-9);
  assert.ok(n - s >= 6 - 1e-9);
  assert.ok(w < 139.69 && e > 139.69 && s < 35.68 && n > 35.68);

  const wide = mapBounds([
    { lat: 48.86, lon: 2.35 },
    { lat: 52.52, lon: 13.4 },
  ]);
  assert.ok(wide[0][0] < 2.35 && wide[1][0] > 13.4);
});

test("smoothPath passes through every point", () => {
  const d = smoothPath([
    { x: 0, y: 100 },
    { x: 50, y: 60 },
    { x: 100, y: 0 },
  ]);
  assert.match(d, /^M0 100 C/);
  assert.match(d, / 50 60 C/);
  assert.match(d, / 100 0$/);
  assert.equal(smoothPath([{ x: 3, y: 4 }]), "M3 4");
  assert.equal(smoothPath([]), "");
});

test("pillStops keeps first, last and the longest stays on a long trip", () => {
  assert.deepEqual(pillStops([{ days: 1 }, { days: 2 }, { days: 3 }].map(stop)), [0, 1, 2]);
  const long = [1, 5, 1, 4, 2, 1].map((days) => stop({ days }));
  assert.deepEqual(pillStops(long), [0, 1, 3, 5]);
});

test("placePills keeps pills inside the frame and off each other and the dots", () => {
  const frame = { width: 390, height: 330, pillWidth: 140, pillHeight: 54 };
  const dots = [
    { x: 100, y: 260 },
    { x: 210, y: 200 },
    { x: 300, y: 140 },
  ];
  const pills = placePills(dots, [0, 1, 2], frame);
  assert.equal(pills.length, 3);
  for (const p of pills) {
    assert.ok(p.x >= 8 && p.x + 140 <= 382, `x ${p.x}`);
    assert.ok(p.y >= 8 && p.y + 54 <= 322, `y ${p.y}`);
  }
  // The last stop's pill sits above its dot.
  assert.ok(pills[2]!.y + 54 <= 140);
  for (let i = 0; i < pills.length; i++)
    for (let j = i + 1; j < pills.length; j++) {
      const a = pills[i]!;
      const b = pills[j]!;
      const apart = a.x + 140 <= b.x || b.x + 140 <= a.x || a.y + 54 <= b.y || b.y + 54 <= a.y;
      assert.ok(apart, `pills ${i} and ${j} overlap`);
    }
  for (const p of pills)
    for (const d of dots) {
      const covers = d.x > p.x && d.x < p.x + 140 && d.y > p.y && d.y < p.y + 54;
      assert.ok(!covers, "a pill covers a dot");
    }
});

test("flightParts reads the code and airports however they are written", () => {
  assert.deepEqual(flightParts("BA932 LHR → BER"), { code: "BA932", route: "LHR → BER" });
  assert.deepEqual(flightParts("Flight BA 932 London LHR -> Berlin BER"), {
    code: "BA932",
    route: "LHR → BER",
  });
  assert.deepEqual(flightParts("Flight to Tokyo"), { code: null, route: null });
  assert.deepEqual(flightParts("U2 8412 CDG to PRG"), { code: "U28412", route: "CDG → PRG" });
});

test("heroWhen", () => {
  assert.equal(heroWhen("In 2 days"), "in 2 days.");
  assert.equal(heroWhen("Tomorrow"), "tomorrow.");
  assert.equal(heroWhen(""), "");
});

test("placePills keeps pills under the title line", () => {
  const frame = { width: 390, height: 330, pillWidth: 140, pillHeight: 54, top: 120 };
  const pills = placePills([{ x: 300, y: 140 }], [0], frame);
  assert.ok(pills[0]!.y >= 120);
  assert.ok(pills[0]!.y >= 140, "goes below its dot rather than over it");
});

test("placePills finds a free side when above and below are taken", () => {
  // Paris, Prague, Berlin as the map projects them: Berlin has no room above
  // (the title) and Prague's pill is below it.
  const frame = { width: 390, height: 300, pillWidth: 130, pillHeight: 54, top: 112 };
  for (const dots of [
    [
      { x: 60, y: 230 },
      { x: 330, y: 190 },
      { x: 312, y: 135 },
    ],
    // As geoMercator puts them on the 390 × 300 map.
    [
      { x: 97, y: 235 },
      { x: 293, y: 204 },
      { x: 276, y: 141 },
    ],
  ])
    clearOf(dots, placePills(dots, [0, 1, 2], frame));
});

function clearOf(dots: { x: number; y: number }[], pills: { x: number; y: number }[]) {
  for (let i = 0; i < pills.length; i++)
    for (let j = i + 1; j < pills.length; j++) {
      const a = pills[i]!;
      const b = pills[j]!;
      const apart = a.x + 130 <= b.x || b.x + 130 <= a.x || a.y + 54 <= b.y || b.y + 54 <= a.y;
      assert.ok(apart, `pills ${i} and ${j} overlap`);
    }
  for (const p of pills) {
    assert.ok(p.y >= 112 && p.y + 54 <= 292);
    for (const d of dots)
      assert.ok(!(d.x > p.x && d.x < p.x + 130 && d.y > p.y && d.y < p.y + 54), "covers a dot");
  }
}

function stop(over: { days: number | null }) {
  return { city: "X", country: null, lat: 0, lon: 0, ...over };
}
