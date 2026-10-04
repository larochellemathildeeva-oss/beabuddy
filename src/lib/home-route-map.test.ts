import { test } from "node:test";
import assert from "node:assert/strict";
import {
  centerLon,
  distanceKm,
  flightParts,
  heroWhen,
  mapBounds,
  pillLabel,
  pillStops,
  placeLabels,
  placePills,
  reliefTiles,
  routeStops,
  routeStopsIndexed,
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
    { city: "Typo", lat: 152.5, lon: 13.4 },
    { city: "Swapped", lat: 13.4, lon: 252.5 },
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
  const one = mapBounds([{ lat: 35.68, lon: 139.69 }]);
  const [[w, s], [e, n]] = one.corners;
  assert.ok(Math.abs(one.center - 139.69) < 1e-9);
  assert.ok(e - w >= 9 - 1e-9);
  assert.ok(n - s >= 6 - 1e-9);
  assert.ok(w < 0 && e > 0 && s < 35.68 && n > 35.68);

  const wide = mapBounds([
    { lat: 48.86, lon: 2.35 },
    { lat: 52.52, lon: 13.4 },
  ]);
  assert.ok(wide.corners[0][0] + wide.center < 2.35 && wide.corners[1][0] + wide.center > 13.4);
});

test("a trip across the 180° line is a short span, not a lap of the world", () => {
  assert.ok(Math.abs(Math.abs(centerLon([179, -179])) - 180) < 1e-9);
  assert.ok(Math.abs(centerLon([2, 14]) - 8) < 1e-9);
  const { corners } = mapBounds([
    { lat: -17.7, lon: 178.4 }, // Fiji
    { lat: -13.8, lon: -171.8 }, // Samoa
  ]);
  const span = corners[1][0] - corners[0][0];
  assert.ok(span < 40, `span ${span}`);
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

test("placePills leaves a pill off rather than let two overlap", () => {
  const frame = { width: 390, height: 300, pillWidth: 150, pillHeight: 54, top: 112 };
  // Four cities a few kilometres apart.
  const dots = [
    { x: 190, y: 200 },
    { x: 200, y: 196 },
    { x: 205, y: 205 },
    { x: 196, y: 210 },
  ];
  const pills = placePills(dots, [0, 1, 2, 3], frame);
  assert.ok(pills.length >= 1);
  assert.ok(
    pills.some((p) => p.index === 3),
    "the last stop keeps its pill",
  );
  const boxes = pills.map((p) => ({ x0: p.x, y0: p.y, x1: p.x + 150, y1: p.y + 54 }));
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, "overlap");
    }
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

test("pillLabel shows the town alone, cut at a word when too long", () => {
  assert.equal(pillLabel("City of London, England, United Kingdom"), "City of London");
  assert.equal(pillLabel("Rio de Janeiro"), "Rio de Janeiro");
  assert.equal(pillLabel("Llanfairpwllgwyngyll"), "Llanfairpwllgwy…");
  assert.equal(pillLabel("Saint-Martin-de-Belleville Les Menuires"), "Saint-Martin-de…");
  assert.equal(pillLabel("Santa Cruz de la Sierra"), "Santa Cruz de…");
  assert.equal(pillLabel(", Paris"), "Paris");
  // A comma inside the town's own name is kept.
  assert.equal(pillLabel("Washington, D.C."), "Washington, D.C.");
  assert.equal(pillLabel("Washington, D.C., United States"), "Washington, D.C.");
  assert.equal(pillLabel("Paris, Île-de-France, France"), "Paris");
  assert.equal(pillLabel("Portland, OR"), "Portland");
});

test("routeStops counts a spot inside the last town as that town", () => {
  const stops = routeStops([
    { city: "London", lat: 51.507, lon: -0.128, arrive_on: "2026-10-01", depart_on: "2026-10-03" },
    {
      city: "City of London, England, United Kingdom",
      lat: 51.512,
      lon: -0.091,
      arrive_on: "2026-10-03",
      depart_on: "2026-10-04",
    },
    { city: "Oxford", lat: 51.752, lon: -1.258, arrive_on: "2026-10-04", depart_on: "2026-10-05" },
  ]);
  assert.deepEqual(
    stops.map((s) => [s.city, s.days]),
    [
      ["London", 3],
      ["Oxford", 1],
    ],
  );
});

test("distanceKm measures along the globe", () => {
  assert.ok(
    Math.abs(distanceKm({ lat: 51.507, lon: -0.128 }, { lat: 48.857, lon: 2.352 }) - 344) < 3,
  );
  assert.equal(distanceKm({ lat: 10, lon: 10 }, { lat: 10, lon: 10 }), 0);
});

test("reliefTiles covers the frame with the tile under each point", async () => {
  const { geoMercator } = await import("d3-geo");
  const center = 5;
  const projection = geoMercator()
    .rotate([-center, 0])
    .fitExtent(
      [
        [60, 135],
        [330, 240],
      ],
      {
        type: "MultiPoint",
        coordinates: [
          [-5.13, 48.86],
          [8.4, 52.52],
        ],
      },
    );
  const tiles = reliefTiles({
    scale: projection.scale(),
    translate: projection.translate(),
    center,
    width: 390,
    height: 300,
    dpr: 2,
  });
  assert.ok(tiles.length > 0);
  const z = tiles[0]!.z;
  assert.ok(z >= 2 && z <= 6);
  // London's own tile, by the usual slippy-map sums, is drawn where London is.
  const [lx, ly] = projection([-0.128, 51.507])!;
  const n = 2 ** z;
  const tileX = Math.floor(((-0.128 + 180) / 360) * n);
  const lat = (51.507 * Math.PI) / 180;
  const tileY = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n);
  const hit = tiles.find((t) => t.x === tileX && t.y === tileY);
  assert.ok(hit, "London's tile is in the cover");
  assert.ok(lx >= hit.left && lx <= hit.left + hit.size);
  assert.ok(ly >= hit.top && ly <= hit.top + hit.size);
  // Every corner of the frame is under some tile.
  for (const [x, y] of [
    [0, 0],
    [389, 0],
    [0, 299],
    [389, 299],
  ] as const) {
    assert.ok(
      tiles.some((t) => x >= t.left && x <= t.left + t.size && y >= t.top && y <= t.top + t.size),
    );
  }
});

test("reliefTiles wraps columns across the 180° line", () => {
  const tiles = reliefTiles({
    scale: 300,
    translate: [195, 150],
    center: 179,
    width: 390,
    height: 300,
  });
  assert.ok(tiles.every((t) => t.x >= 0 && t.x < 2 ** t.z));
  assert.ok(new Set(tiles.map((t) => t.x)).has(0));
});

test("placeLabels names a city on its right, near the right edge on its left", () => {
  const dots = [
    { x: 60, y: 200 },
    { x: 340, y: 150 },
  ];
  const labels = placeLabels(dots, ["Paris", "Berlin"], { width: 390 });
  assert.deepEqual(
    labels.map((l) => [l.index, l.anchor]),
    [
      [0, "start"],
      [1, "end"],
    ],
  );
  assert.ok(labels[0]!.x > 60 && labels[1]!.x < 340);
});

test("placeLabels drops a middle name that would cover another, never the ends", () => {
  const dots = [
    { x: 20, y: 200 },
    { x: 20, y: 214 },
    { x: 20, y: 228 },
  ];
  const labels = placeLabels(dots, ["Kyoto", "Nara", "Osaka"], { width: 390 });
  const placed = labels.map((l) => l.index);
  assert.deepEqual(placed, [0, 2]);
  // The stop you are in is placed first, so it is the one kept.
  const kept = placeLabels(dots, ["Kyoto", "Nara", "Osaka"], { width: 390, keep: 1 });
  assert.ok(kept.some((l) => l.index === 1));
});

test("routeStopsIndexed tells a return visit from the first", () => {
  const { route, indexOf } = routeStopsIndexed([
    { city: "Paris", lat: 48.86, lon: 2.35 },
    { city: "Lyon", lat: 45.76, lon: 4.84 },
    { city: "Paris", lat: 48.86, lon: 2.35 },
    { city: "Nowhere", lat: null, lon: null },
    { city: "Paris 2e", lat: 48.87, lon: 2.34 },
  ]);
  assert.deepEqual(
    route.map((s) => s.city),
    ["Paris", "Lyon", "Paris"],
  );
  assert.deepEqual(indexOf, [0, 1, 2, -1, 2]);
});
