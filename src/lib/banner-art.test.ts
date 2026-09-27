import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { BANNER_SCENES, bannerArtUrl, bannerSceneFor } from "./banner-art.ts";
import { THEMES } from "./theme.ts";

test("a place picks the scene that suits it", () => {
  assert.equal(bannerSceneFor(["Lisbon", "Portugal"], "x"), "coastal");
  assert.equal(bannerSceneFor(["Tokyo, Japan"], "x"), "temple");
  assert.equal(bannerSceneFor(["Santorini", "Greece"], "x"), "island");
  assert.equal(bannerSceneFor(["Marrakech"], "x"), "desert");
  assert.equal(bannerSceneFor(["Zermatt"], "x"), "mountain");
  assert.equal(bannerSceneFor(["New York"], "x"), "skyline");
  assert.equal(bannerSceneFor(["Praha", "Czech Republic"], "x"), "oldtown");
  assert.equal(bannerSceneFor(["Bali"], "x"), "tropical");
});

test("accents and case do not matter, and words match whole", () => {
  assert.equal(bannerSceneFor(["MONTRÉAL"], "x"), "skyline");
  // "nice" inside another word is not Nice.
  assert.notEqual(bannerSceneFor(["Venice"], "x"), "coastal");
});

test("somewhere unknown keeps the same scene every time", () => {
  const a = bannerSceneFor(["Nowhere in particular"], "Weekend away");
  assert.equal(bannerSceneFor(["Nowhere in particular"], "Weekend away"), a);
  assert.ok((BANNER_SCENES as readonly string[]).includes(a));
});

test("every scene is painted in every theme", () => {
  for (const scene of BANNER_SCENES) {
    for (const theme of THEMES) {
      const url = bannerArtUrl(scene, theme);
      assert.ok(existsSync(new URL(`../../public${url}`, import.meta.url)), url);
    }
  }
});
