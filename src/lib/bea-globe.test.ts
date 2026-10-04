import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geoOrthographic } from "d3-geo";
import {
  HOME_ROTATION,
  degDelta,
  latLonToVec3,
  limbFade,
  placeLabels,
  project,
  rotate,
  rotationFacing,
  stepSpin,
  type Rotation,
} from "./bea-globe.ts";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

describe("bea-globe", () => {
  it("matches d3's geoOrthographic, so SVG overlays line up with the WebGL Earth", () => {
    const rotations: Rotation[] = [
      HOME_ROTATION,
      [73.6, -45.5],
      [-139.7, -35.7],
      [12, 30],
      [200, 60],
    ];
    const places = [
      [48.86, 2.35],
      [45.5, -73.57],
      [35.68, 139.69],
      [-33.87, 151.21],
      [-8.34, 115.09],
      [64.15, -21.94],
    ];
    for (const r of rotations) {
      const d3 = geoOrthographic().scale(150).translate([160, 160]).rotate(r).clipAngle(90);
      for (const [lat, lon] of places) {
        const ours = project(lat!, lon!, r, 320, 150);
        const theirs = d3([lon!, lat!])!;
        close(ours.x, theirs[0], 1e-6);
        close(ours.y, theirs[1], 1e-6);
        // Visible side agrees with d3's own hemisphere test (geoRotation → cos of the distance to centre).
        const c = [-r[0], -r[1]];
        const cosd =
          Math.sin((c[1]! * Math.PI) / 180) * Math.sin((lat! * Math.PI) / 180) +
          Math.cos((c[1]! * Math.PI) / 180) *
            Math.cos((lat! * Math.PI) / 180) *
            Math.cos(((lon! - c[0]!) * Math.PI) / 180);
        close(ours.facing, cosd, 1e-9);
      }
    }
  });

  it("rotationFacing brings a place to the centre", () => {
    const p = rotate(latLonToVec3(48.86, 2.35), rotationFacing(48.86, 2.35));
    close(p.z, 1, 1e-9);
  });

  it("hides the far side", () => {
    const back = project(-35, -170, HOME_ROTATION, 320, 150);
    assert.ok(back.facing < 0);
    assert.equal(limbFade(back.facing), 0);
  });

  it("degDelta takes the short way round", () => {
    close(degDelta(170, -170), 20, 1e-12);
    close(degDelta(-170, 170), -20, 1e-12);
  });

  it("a flick decays and the globe eases back into auto-rotation", () => {
    let s = { rotation: [0, 0] as Rotation, vLam: 300, vPhi: 40 };
    for (let i = 0; i < 600; i++) s = stepSpin(s, 1 / 60, { autoSpeed: 5, idle: true });
    close(s.vLam, 5, 0.05);
    close(s.vPhi, 0, 1e-3);
    let held = { rotation: [0, 0] as Rotation, vLam: 300, vPhi: 0 };
    for (let i = 0; i < 600; i++) held = stepSpin(held, 1 / 60, { autoSpeed: 5, idle: false });
    assert.ok(Math.abs(held.vLam) < 0.01);
  });

  it("never tilts past the poles", () => {
    let s = { rotation: [0, 80] as Rotation, vLam: 0, vPhi: 500 };
    for (let i = 0; i < 60; i++) s = stepSpin(s, 1 / 60, { autoSpeed: 0, idle: false });
    assert.ok(s.rotation[1] <= 85);
  });

  it("places labels greedily without overlaps", () => {
    const kept = placeLabels(
      [
        { id: "a", name: "Paris", x: 100, y: 100 },
        { id: "b", name: "Florence", x: 105, y: 108 },
        { id: "c", name: "Tokyo", x: 250, y: 200 },
        { id: "d", name: "Rome", x: 100, y: 145 },
        { id: "e", name: "Kyoto", x: 262, y: 186 },
      ],
      6,
    );
    // Florence's tag would overlap Paris's; Tokyo's tag would cover Kyoto's dot, so Kyoto is named instead.
    assert.deepEqual([...kept].sort(), ["a", "d", "e"]);
    assert.equal(placeLabels([{ id: "a", name: "Paris", x: 0, y: 0 }], 0).size, 0);
  });
});
