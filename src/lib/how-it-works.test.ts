import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HOW_CLOSING, HOW_SCENES } from "./how-it-works.ts";
import { BEA_MISSION, BEA_SIGNATURE } from "./bea-voice.ts";

describe("HOW_SCENES", () => {
  it("tells the whole arc", () => {
    assert.deepEqual(
      HOW_SCENES.map((s) => s.id),
      ["scatter", "capture", "vault", "assemble", "nearby", "compare", "map"],
    );
  });

  it("gives every scene something to say and something to draw", () => {
    for (const scene of HOW_SCENES) {
      assert.ok(scene.eyebrow.trim(), `${scene.id} has no eyebrow`);
      assert.ok(scene.heading.trim(), `${scene.id} has no heading`);
      assert.ok(scene.body.trim().length > 40, `${scene.id} body is too thin`);
      assert.ok(scene.signature.trim(), `${scene.id} has no signature line`);
      assert.ok(scene.figure.trim(), `${scene.id} has no figure`);
    }
  });

  it("uses one figure per scene, so none is drawn twice", () => {
    const figures = HOW_SCENES.map((s) => s.figure);
    assert.equal(new Set(figures).size, figures.length);
  });

  it("quotes the app's own signature lines rather than inventing new ones", () => {
    const used = new Set(HOW_SCENES.map((s) => s.signature));
    for (const line of [
      BEA_SIGNATURE.recs,
      BEA_SIGNATURE.near,
      BEA_SIGNATURE.planning,
      BEA_SIGNATURE.choose,
      BEA_SIGNATURE.memories,
    ]) {
      assert.ok(used.has(line), `signature missing from the page: ${line}`);
    }
  });

  it("never calls Béa an AI travel planner", () => {
    // BRANDING.md: "Never lead with 'AI travel planner.'"
    const prose = HOW_SCENES.map((s) => `${s.heading} ${s.body} ${s.signature}`)
      .join(" ")
      .toLowerCase();
    assert.equal(/ai (travel )?(planner|trip generator|itinerary builder)/.test(prose), false);
  });

  it("closes on the mission and the strongest tagline", () => {
    assert.equal(HOW_CLOSING.mission, BEA_MISSION);
    assert.equal(HOW_CLOSING.tagline, "Remember everywhere. Go anywhere.");
  });

  it("promises nothing the app cannot do", () => {
    const prose = HOW_SCENES.map((s) => s.body)
      .join(" ")
      .toLowerCase();
    // Collaborative filtering was cut from the film for being invented; it must
    // not creep back in here.
    assert.equal(prose.includes("similar taste"), false);
    assert.equal(prose.includes("people like you"), false);
  });
});
