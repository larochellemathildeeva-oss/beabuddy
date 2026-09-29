import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BEA_CHARACTER } from "./bea-character-data.ts";
import {
  BALANCED,
  BEA_TRAITS,
  DEFAULT_SETTINGS,
  PLAIN_WORKING,
  PRESET_INFO,
  cleanSettings,
  emptyLine,
  loadingLine,
  mixPercents,
  modeName,
  normalizeMix,
  presetOf,
  seededRandom,
  successLine,
  stopAside,
  type BeaMix,
} from "./bea-personality.ts";

const mix = (partial: Partial<BeaMix>): BeaMix =>
  ({ ...Object.fromEntries(BEA_TRAITS.map((t) => [t, 0])), ...partial }) as BeaMix;

/** Every line Béa can say, flattened. */
function allLines(): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (typeof x === "string") out.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") Object.values(x).forEach(walk);
  };
  const { traits: _traits, presets: _presets, ...lines } = BEA_CHARACTER;
  walk(lines);
  return out;
}

test("Béa speaks about herself, never as 'I', with no emoji and never as a travel planner", () => {
  for (const line of allLines()) {
    assert.doesNotMatch(line, /\b(I|I'm|I've|I'll|me|my)\b/, line);
    assert.doesNotMatch(line, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, line);
    assert.doesNotMatch(line, /travel planner/i, line);
  }
});

test("the sliders need not add to 100: shares are normalized, all zero means Helpful", () => {
  const shares = normalizeMix(mix({ funny: 80, sassy: 80 }));
  assert.equal(shares.funny, 0.5);
  assert.equal(shares.sassy, 0.5);
  assert.equal(normalizeMix(mix({})).helpful, 1);
});

test("percentages shown on screen always add up to exactly 100", () => {
  const p = mixPercents(mix({ helpful: 33, funny: 33, sassy: 33 }));
  assert.equal(
    BEA_TRAITS.reduce((s, t) => s + p[t], 0),
    100,
  );
});

test("a mix is named after its preset, what it leans towards, or Custom", () => {
  assert.equal(presetOf(BALANCED), "balanced");
  assert.equal(modeName(BALANCED), "Balanced");
  // The same shares at a different scale is still the preset.
  assert.equal(modeName(mix({ helpful: 70, funny: 70, sassy: 40, encouraging: 20 })), "Balanced");
  assert.equal(modeName(mix({ dramatic: 80, chill: 20 })), "Mostly Dramatic");
  assert.equal(
    modeName(mix({ curious: 45, adventurous: 35, helpful: 20 })),
    "Curious & Adventurous",
  );
  assert.equal(
    modeName(mix({ helpful: 20, funny: 20, curious: 20, chill: 20, sassy: 20 })),
    "Custom",
  );
  assert.equal(modeName(PRESET_INFO.minimal.mix), "Minimal");
});

test("stored settings are made safe", () => {
  const s = cleanSettings({ mix: { funny: 250, sassy: -4, bogus: 9 }, says: "yes" });
  assert.equal(s.mix.funny, 100);
  assert.equal(s.mix.sassy, 0);
  assert.equal("bogus" in s.mix, false);
  assert.equal(s.says, true);
  assert.deepEqual(cleanSettings(null), DEFAULT_SETTINGS);
});

test("a serious wait always gets the plain line, whatever the mix", () => {
  const settings = { ...DEFAULT_SETTINGS, mix: mix({ sassy: 100 }) };
  for (let seed = 0; seed < 20; seed++) {
    assert.equal(
      loadingLine({ action: "think", settings, serious: true, rand: seededRandom(seed) }),
      PLAIN_WORKING.think,
    );
  }
});

test("a Helpful-only Béa talks about the task, not in jokes", () => {
  const settings = { ...DEFAULT_SETTINGS, mix: mix({ helpful: 100 }), surprises: false };
  const helpful = new Set<string>([
    ...BEA_CHARACTER.loading.helpful.generic,
    ...BEA_CHARACTER.loading.helpful.run,
  ]);
  for (let seed = 0; seed < 30; seed++) {
    const line = loadingLine({ action: "run", settings, rand: seededRandom(seed) });
    assert.ok(helpful.has(line), line);
  }
});

test("the last five lines are not repeated while there are others", () => {
  const settings = { ...DEFAULT_SETTINGS, surprises: false };
  const rand = seededRandom(7);
  const recent: string[] = [];
  for (let i = 0; i < 40; i++) {
    const line = loadingLine({ action: "dig", settings, recent, rand });
    assert.ok(!recent.slice(-5).includes(line), `${line} repeated`);
    recent.push(line);
  }
});

test("empty screens and success lines follow the mix; a plain Béa skips success jokes", () => {
  const line = emptyLine({ kind: "noTrips", settings: DEFAULT_SETTINGS, rand: seededRandom(3) });
  assert.ok(line.length > 0);
  const plain = { ...DEFAULT_SETTINGS, mix: mix({ helpful: 100 }) };
  for (let seed = 0; seed < 20; seed++) {
    assert.equal(
      successLine({ kind: "itinerary", settings: plain, rand: seededRandom(seed) }),
      null,
    );
  }
  const off = { ...DEFAULT_SETTINGS, reactions: false };
  assert.equal(successLine({ kind: "route", settings: off, rand: () => 0 }), null);
  assert.ok(successLine({ kind: "route", settings: DEFAULT_SETTINGS, rand: () => 0 }));
});

test("a stop aside follows the mix and the 'Béa says' switch", () => {
  const playful = { ...DEFAULT_SETTINGS, mix: mix({ funny: 60, sassy: 40 }) };
  assert.ok(stopAside({ mood: "meal", settings: playful, rand: () => 0 }));
  assert.equal(
    stopAside({ mood: "meal", settings: { ...playful, says: false }, rand: () => 0 }),
    null,
  );
  const plain = { ...DEFAULT_SETTINGS, mix: mix({ helpful: 90, funny: 10 }) };
  assert.equal(stopAside({ mood: "meal", settings: plain, rand: () => 0 }), null);
  const early = stopAside({ mood: "sight", hour: 5, settings: playful, rand: () => 0 });
  assert.match(early ?? "", /early|mornings/);
});
