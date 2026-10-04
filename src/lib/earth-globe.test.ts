import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geoOrthographic, geoRotation } from "d3-geo";
import { earthPixel, paintGlobe, shadeAt, viewAxes, type EarthMap } from "./earth-globe.ts";

describe("the Earth on the globe", () => {
  it("finds the picture pixel of a place", () => {
    // Null Island is the middle of the picture; the date line its left edge.
    assert.deepEqual(earthPixel(1, 0, 0, 4096, 2048), [2048, 1024]);
    assert.equal(earthPixel(-1, -1e-9, 0, 4096, 2048)[0], 0);
    // The poles are the top and bottom rows.
    assert.equal(earthPixel(0, 0, 1, 4096, 2048)[1], 0);
    assert.equal(earthPixel(0, 0, -1, 4096, 2048)[1], 2047);
    // Tokyo, 139.7°E 35.7°N.
    const lon = (139.7 * Math.PI) / 180;
    const lat = (35.7 * Math.PI) / 180;
    const [col, row] = earthPixel(
      Math.cos(lat) * Math.cos(lon),
      Math.cos(lat) * Math.sin(lon),
      Math.sin(lat),
      360,
      180,
    );
    assert.deepEqual([col, row], [319, 54]);
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

  it("lights the upper left and keeps the far side visible", () => {
    assert.ok(shadeAt(-0.4, 0.4, 0.82, "day") > shadeAt(0.4, -0.4, 0.82, "day"));
    assert.ok(shadeAt(0.7, -0.7, 0.1, "day") >= 0.4);
    assert.ok(shadeAt(0, 0, 1, "night") > shadeAt(0.99, 0, 0.1, "night"));
  });

  it("puts the rotation's centre in the middle of the disc", () => {
    const rotation = geoRotation([-2, -48]);
    const axes = viewAxes((p) => rotation.invert(p) as [number, number]);
    const width = 32;
    const height = 16;
    // A picture whose pixel colour encodes its column and row.
    const data = new Uint8ClampedArray(width * height * 4);
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++) data.set([c * 8, r * 16, 0, 255], (r * width + c) * 4);
    const earth: EarthMap = { data, width, height };
    const px = 21;
    const out = new Uint8ClampedArray(px * px * 4);
    paintGlobe(out, px, px / 2, axes, earth);
    const mid = (Math.floor(px / 2) * px + Math.floor(px / 2)) * 4;
    const [col, row] = earthPixel(...(axes.z as [number, number, number]), width, height);
    const k = shadeAt(0, 0, 1, "day");
    assert.ok(Math.abs(out[mid]! - col * 8 * k) <= 1);
    assert.ok(Math.abs(out[mid + 1]! - row * 16 * k) <= 1);
    // The corner is outside the disc; the middle is solid.
    assert.equal(out[3], 0);
    assert.equal(out[mid + 3], 255);
  });
});
