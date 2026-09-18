import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HELP_CLOSING, HELP_FAQ_GROUPS, HELP_WELCOME } from "./help-faq.ts";
import { BEA_MISSION } from "./bea-voice.ts";
import { IDLE_LOGOUT_MS } from "./idle-logout.ts";
import { INVITE_CODE_LENGTH, INVITE_TTL_MS } from "./trip-invite.ts";
import { FEEDBACK_CATEGORIES } from "./feedback.ts";

const ALL = HELP_FAQ_GROUPS.flatMap((g) => g.items);
const PROSE = ALL.map((i) => `${i.q}\n${i.a}`)
  .join("\n\n")
  .toLowerCase();

const mentions = (...phrases: string[]) => phrases.some((p) => PROSE.includes(p.toLowerCase()));

describe("FAQ shape", () => {
  it("has no empty question or answer", () => {
    for (const item of ALL) {
      assert.ok(item.q.trim().length > 3, `short question: ${item.q}`);
      assert.ok(item.a.trim().length > 20, `short answer: ${item.q}`);
    }
  });

  it("asks each question once", () => {
    const qs = ALL.map((i) => i.q.toLowerCase());
    assert.equal(new Set(qs).size, qs.length);
  });

  it("closes on the mission, word for word", () => {
    assert.ok(HELP_CLOSING.body.includes(BEA_MISSION));
    assert.ok(HELP_WELCOME.lead.length > 0);
  });
});

describe("FAQ facts match the code", () => {
  it("quotes the real idle-logout time", () => {
    const minutes = IDLE_LOGOUT_MS / 60_000;
    assert.ok(mentions(`${minutes} minutes`), `idle logout is ${minutes} minutes`);
  });

  it("quotes the real invite lifetime", () => {
    const days = INVITE_TTL_MS / 86_400_000;
    assert.equal(days, 7);
    assert.ok(mentions("seven days", `${days} days`));
  });

  it("does not promise a code length the generator does not produce", () => {
    assert.equal(INVITE_CODE_LENGTH, 10);
    // No claim about digits is made; if one is ever added it must match.
    const claimed = /\b(\d+)[- ]character code/.exec(PROSE);
    if (claimed) assert.equal(Number(claimed[1]), INVITE_CODE_LENGTH);
  });

  it("names the feedback category exactly as it appears in the app", () => {
    const broke = FEEDBACK_CATEGORIES.find((c) => c.id === "broke");
    assert.ok(broke);
    assert.ok(mentions(broke.label));
  });

  it("names the AI provider it actually uses", () => {
    assert.ok(mentions("gemini"));
  });
});

describe("FAQ covers what the app ships", () => {
  // Every entry here is a feature a person can reach in the UI. A shipped
  // feature with nothing written about it is the failure this guards.
  const FEATURES: [string, string[]][] = [
    ["sharing saved places", ["open a share", "send lets you tick"]],
    ["trip to-dos", ["things to do"]],
    ["comparing two itineraries", ["compare takes two", "compare two plans"]],
    ["help me choose", ["help me choose"]],
    ["the story page", ["how béa works"]],
    ["offline directions", ["offline directions"]],
    ["the document vault", ["document vault"]],
    ["packing lists", ["packing list"]],
    ["future me notes", ["future me"]],
    ["playback", ["playback"]],
    ["travel tags", ["travel tags"]],
    ["the heatmap", ["heatmap"]],
    ["day trips from Near", ["day trip"]],
    ["deleting your account", ["delete"]],
  ];

  for (const [feature, phrases] of FEATURES) {
    it(`says something about ${feature}`, () => {
      assert.ok(mentions(...phrases), `nothing in the FAQ mentions ${feature}`);
    });
  }
});

describe("FAQ does not describe a UI that no longer exists", () => {
  // Both of these were true once. The demo-city buttons were removed from Near,
  // and Near itself became a filter on the vault — and the FAQ went on
  // describing both for a release, which is the exact failure this file exists
  // to catch.
  it("does not offer demo cities", () => {
    assert.equal(/demo cit(y|ies)/i.test(PROSE), false);
  });

  it("sends people where Near actually is", () => {
    assert.equal(/\bthe near tab\b(?!\s+(go|went))/i.test(PROSE), false, "there is no Near tab");
    assert.equal(/in recs,? tap near/i.test(PROSE), false, "Near is not a filter in Recs");
    assert.ok(mentions("on home"), "the FAQ should say where it is");
  });
});

describe("FAQ does not contradict the brand", () => {
  it("never calls Béa an AI travel planner", () => {
    assert.equal(/ai (travel )?(planner|trip generator)/.test(PROSE), false);
  });

  it("never claims Béa books anything", () => {
    // The one mention must be the denial.
    const booking = ALL.filter((i) => /book(s|ing)? (a |your )?(table|hotel|flight)/i.test(i.a));
    for (const item of booking) {
      assert.match(
        item.a,
        /\b(no|not|does not|doesn't)\b/i,
        `sounds like a booking promise: ${item.q}`,
      );
    }
  });
});
