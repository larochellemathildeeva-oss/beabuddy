import { strict as assert } from "node:assert";
import { test } from "node:test";
import { HELP_CLOSING, HELP_FAQ_GROUPS, HELP_WELCOME } from "./help-faq.ts";

test("Help welcome and closing carry the mission", () => {
  assert.match(HELP_WELCOME.lead, /remember travel things/i);
  assert.match(HELP_CLOSING.body, /Future You doesn't miss what matters/i);
});

test("Help reads as companion conversation, not a feature dump", () => {
  const blob = [
    HELP_WELCOME.title,
    HELP_WELCOME.lead,
    HELP_WELCOME.body,
    ...HELP_FAQ_GROUPS.flatMap((g) => g.items.map((item) => `${item.q} ${item.a}`)),
    HELP_CLOSING.body,
  ]
    .join(" ")
    .toLowerCase();

  for (const needle of [
    "breadcrumb",
    "future you",
    "help me choose",
    "does not make bookings",
    "flying solo",
    "offline directions",
    "it broke and i laughed",
    "companion",
    "locations only",
    "deep dive",
    "quick walk around the block",
    "travel preferences",
    "day trip",
    "copyright",
    "do you sell my data",
    "retain control",
    "encrypted on your device",
    "incomplete, inaccurate",
  ]) {
    assert.ok(blob.includes(needle), `Help should mention ${needle}`);
  }

  assert.ok(!blob.includes("software manual"));
});
