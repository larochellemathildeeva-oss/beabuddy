import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geoOrthographic, geoRotation } from "d3-geo";
import { mercatorPixel, paintGlobe, tileNames, viewAxes, type ReliefMap } from "./relief-globe.ts";

describe("relief on the globe", () => {
  it("reads the tile list for one zoom", () => {
    assert.deepEqual([...tileNames({ "3": ["0/1", "2/2"], "2": ["0/0"] }, 3)], ["0/1", "2/2"]);
    assert.equal(tileNames({}, 3).size, 0);
  });

  it("finds the Mercator pixel of a place", () => {
    // Null Island is the middle of the map; the date line is its left edge.
    assert.deepEqual(mercatorPixel(1, 0, 0, 2048), [1024, 1024]);
    const [col] = mercatorPixel(-1, -1e-9, 0, 2048);
    assert.equal(col, 0);
    // The poles stay on the map.
    assert.equal(mercatorPixel(0, 0, 1, 2048)[1], 0);
    assert.equal(mercatorPixel(0, 0, -1, 2048)[1], 2047);
  });

  it("agrees with d3's orthographic projection pixel by pixel", () => {
    const rotate: [number, number] = [-37, -23];
    const proj = geoOrthographic().scale(100).translate([100, 100]).rotate(rotate);
    const rotation = geoRotation(rotate);
    const axes = viewAxes((p) => rotation.invert(p) as [number, number]);
    for (const [x, y] of [
      [100, 100],
      [60, 70],
      [150, 120],
      [90, 40],
    ] as const) {
      const [lon, lat] = proj.invert!([x, y])!;
      const dx = (x - 100) / 100;
      const dy = (100 - y) / 100;
      const dz = Math.sqrt(1 - dx * dx - dy * dy);
      const v = [0, 1, 2].map((k) => dx * axes.x[k]! + dy * axes.y[k]! + dz * axes.z[k]!);
      const want = [
        Math.cos((lat * Math.PI) / 180) * Math.cos((lon * Math.PI) / 180),
        Math.cos((lat * Math.PI) / 180) * Math.sin((lon * Math.PI) / 180),
        Math.sin((lat * Math.PI) / 180),
      ];
      for (let k = 0; k < 3; k++)
        assert.ok(Math.abs(v[k]! - want[k]!) < 1e-6, `pixel ${x},${y} axis ${k}`);
    }
  });

  it("puts the rotation's centre in the middle of the disc", () => {
    // d3 rotation [λ, φ] centres the globe on (−λ, −φ): here Paris-ish.
    const rotation = geoRotation([-2, -48]);
    const axes = viewAxes((p) => rotation.invert(p) as [number, number]);
    const size = 16;
    // A map whose pixel colour encodes its column and row.
    const data = new Uint8ClampedArray(size * size * 4);
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) data.set([c * 16, r * 16, 0, 255], (r * size + c) * 4);
    const relief: ReliefMap = { data, size };
    const px = 21;
    const out = new Uint8ClampedArray(px * px * 4);
    paintGlobe(out, px, px / 2, axes, relief);
    const mid = (Math.floor(px / 2) * px + Math.floor(px / 2)) * 4;
    const expect = mercatorPixel(...(axes.z as [number, number, number]), size);
    assert.equal(out[mid], expect[0] * 16);
    assert.equal(out[mid + 1], expect[1] * 16);
    // The corner is outside the disc.
    assert.equal(out[3], 0);
    assert.equal(out[mid + 3], 255);
  });
});
