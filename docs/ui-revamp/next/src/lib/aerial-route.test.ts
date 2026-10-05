import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calloutBoxes,
  coverFrame,
  mercY,
  onArt,
  stopsOnArt,
  trailPath,
  tripProgress,
} from "./aerial-route.ts";

const near = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);

describe("onArt", () => {
  it("puts the box's corners on the picture's corners and the equator on Mercator's middle", () => {
    const size = { width: 1000, height: 800 };
    const b = [0, -30, 40, 30] as const;
    near(onArt({ lat: 30, lon: 0 }, b, size).x, 0);
    near(onArt({ lat: 30, lon: 0 }, b, size).y, 0);
    near(onArt({ lat: -30, lon: 40 }, b, size).x, 1000);
    near(onArt({ lat: -30, lon: 40 }, b, size).y, 800);
    near(onArt({ lat: 0, lon: 20 }, b, size).y, 400);
  });
  it("stretches latitude as Web Mercator does", () => {
    const p = onArt({ lat: 45, lon: 0 }, [0, 0, 10, 60], { width: 100, height: 100 });
    near(p.y, ((mercY(60) - mercY(45)) / (mercY(60) - mercY(0))) * 100);
  });
  it("reads a box across the 180° line", () => {
    near(onArt({ lat: 0, lon: -175 }, [170, -10, -170, 10], { width: 200, height: 100 }).x, 150);
  });
});

describe("coverFrame", () => {
  it("covers the banner and never leaves a gap when sliding to the focus", () => {
    const f = coverFrame(
      { width: 1000, height: 1000 },
      { width: 390, height: 420 },
      { x: 0, y: 0 },
    );
    near(f.scale, 0.42);
    assert.equal(f.dx, 0);
    assert.equal(f.dy, 0);
    const g = coverFrame(
      { width: 1000, height: 1000 },
      { width: 390, height: 420 },
      { x: 1000, y: 1000 },
    );
    near(g.dx, 390 - 420);
    near(g.dy, 0);
  });
  it("centres the picture without a focus", () => {
    const f = coverFrame({ width: 2000, height: 1000 }, { width: 400, height: 400 });
    near(f.dx, -200);
    near(f.dy, 0);
  });
});

describe("stopsOnArt", () => {
  it("slides the route toward the middle of its band", () => {
    const { points } = stopsOnArt(
      [
        { lat: 45, lon: 9 },
        { lat: 48, lon: 11 },
      ],
      [5, 42, 15, 52],
      { width: 2000, height: 2400 },
      { width: 390, height: 420 },
      { top: 160, bottom: 360 },
    );
    const midY = (points[0]!.y + points[1]!.y) / 2;
    near(midY, 260, 1);
    assert.ok(points[1]!.y < points[0]!.y, "north is up");
  });
});

describe("tripProgress", () => {
  it("counts the stop you are in, else the ones behind you", () => {
    assert.deepEqual(tripProgress(2, 2, 5), { at: 3, total: 5 });
    assert.deepEqual(tripProgress(-1, 1, 4), { at: 1, total: 4 });
    assert.deepEqual(tripProgress(-1, 0, 4), { at: 0, total: 4 });
    assert.deepEqual(tripProgress(-1, 9, 4), { at: 4, total: 4 });
    assert.deepEqual(tripProgress(0, 0, 0), { at: 0, total: 0 });
  });
});

describe("trailPath", () => {
  it("draws nothing for one place", () => {
    assert.deepEqual(trailPath([{ x: 1, y: 1 }]), { d: "", plane: null });
  });
  it("joins the places with arcs and sets the plane on the longest leg, heading along it", () => {
    const { d, plane } = trailPath([
      { x: 0, y: 100 },
      { x: 50, y: 100 },
      { x: 250, y: 100 },
    ]);
    assert.match(d, /^M0 100 Q.+ Q.+$/);
    assert.ok(plane);
    assert.ok(plane.x > 100 && plane.x < 200);
    assert.ok(plane.y < 100, "the arc bows upward");
    assert.ok(Math.abs(plane.angle) < 10, "heading right");
  });
});

it("calloutBoxes: beside the pin, never over another pin, a callout or a kept-clear box", () => {
  const pins = [
    { x: 100, y: 100 },
    { x: 220, y: 100 },
  ];
  const boxes = calloutBoxes(pins, [80, 80], { width: 390, top: 0, bottom: 300 }, { height: 40 });
  assert.deepEqual(boxes[0], { x: 114, y: 80, width: 80, height: 40 });
  // Right of the second pin is free too.
  assert.equal(boxes[1]!.x, 234);
  // A title in the way sends the callout elsewhere.
  const kept = calloutBoxes(
    [{ x: 100, y: 140 }],
    [80],
    { width: 390, top: 0, bottom: 300 },
    {
      height: 40,
      keepClear: [{ x: 0, y: 0, width: 390, height: 135 }],
    },
  );
  // Beside and above would touch the title: it goes below the pin.
  assert.deepEqual(kept[0], { x: 60, y: 154, width: 80, height: 40 });
});

it("calloutBoxes: left off when there is no room", () => {
  const boxes = calloutBoxes(
    [{ x: 50, y: 20 }],
    [300],
    { width: 120, top: 0, bottom: 40 },
    { height: 40 },
  );
  assert.deepEqual(boxes, [null]);
});

it("stopsOnArt: a picture of a wider area is enlarged until the route fills the band", () => {
  const bounds = [0, 40, 20, 52] as const;
  const art = { width: 2000, height: 1600 };
  const frame = { width: 400, height: 400 };
  const stops = [
    { lat: 45, lon: 9 },
    { lat: 47, lon: 12 },
  ];
  const { points, frame: f } = stopsOnArt(stops, [...bounds], art, frame, {
    top: 150,
    bottom: 330,
  });
  // Cover alone would be 0.25; the route now spans most of the band.
  assert.ok(f.scale > 0.25);
  assert.ok(Math.abs(points[0]!.y - points[1]!.y) > 120);
  assert.ok(points.every((p) => p.x > 0 && p.x < 400 && p.y > 140 && p.y < 340));
});
