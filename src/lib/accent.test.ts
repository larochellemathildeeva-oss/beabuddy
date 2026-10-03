import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ACCENT_BOOT_SCRIPT, ACCENT_KEY, DEFAULT_ACCENT, isAccentName } from "./accent.ts";
import { planSync, settingStorageKey } from "./account-settings.ts";

test("accent is Pink by default; only Pink and Periwinkle are accepted", () => {
  assert.equal(DEFAULT_ACCENT, "pink");
  for (const name of ["pink", "periwinkle"]) assert.ok(isAccentName(name));
  for (const value of [null, "", "violet", {}, 1]) assert.equal(isAccentName(value), false);
});

test("first paint applies the saved accent, including invalid or blocked storage", () => {
  for (const saved of [null, "pink", "periwinkle", "unknown", "blocked"]) {
    const attrs = new Map<string, string>();
    runInNewContext(ACCENT_BOOT_SCRIPT, {
      localStorage: {
        getItem: () => {
          if (saved === "blocked") throw new Error("blocked");
          return saved;
        },
      },
      document: {
        documentElement: { setAttribute: (key: string, value: string) => attrs.set(key, value) },
      },
    });
    assert.equal(attrs.get("data-accent"), saved === "periwinkle" ? "periwinkle" : "pink");
  }
});

test("accent follows the account to a second device independently of theme", () => {
  assert.equal(settingStorageKey("accent", "traveller"), ACCENT_KEY);
  assert.deepEqual(
    planSync({ theme: "dark", accent: "periwinkle" }, { theme: "dark", accent: "pink" }),
    {
      toDevice: { accent: "periwinkle" },
      toAccount: {},
    },
  );
  assert.deepEqual(planSync({}, { accent: "periwinkle" }), {
    toDevice: {},
    toAccount: { accent: "periwinkle" },
  });
});

test("another account's accent resets rather than leaking to the next traveller", () => {
  assert.deepEqual(planSync({}, { accent: "periwinkle" }, new Set(), false), {
    toDevice: { accent: null },
    toAccount: {},
  });
  assert.deepEqual(planSync({ accent: "pink" }, { accent: "periwinkle" }, new Set(["accent"])), {
    toDevice: {},
    toAccount: {},
  });
});
