import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import {
  ACCENTS,
  ACCENT_BOOT_SCRIPT,
  ACCENT_KEY,
  applyAccent,
  DEFAULT_ACCENT,
  isAccentName,
} from "./accent.ts";
import { planSync, settingStorageKey } from "./account-settings.ts";
import { getStored, setStored } from "./settings-storage.ts";

test("accent is Pink by default; only Pink and Periwinkle are accepted", () => {
  assert.equal(DEFAULT_ACCENT, "pink");
  for (const name of ACCENTS) assert.ok(isAccentName(name));
  for (const value of [null, "", "violet", {}, 1]) assert.equal(isAccentName(value), false);
});

test("first paint applies the saved accent, including invalid or blocked storage", () => {
  for (const saved of [null, ...ACCENTS, "unknown", "blocked"]) {
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
    assert.equal(attrs.get("data-accent"), isAccentName(saved) ? saved : DEFAULT_ACCENT);
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

test("a null account accent paints Pink without recreating a setting to upload", (t) => {
  const storage = new Map<string, string>();
  const attrs = new Map<string, string>();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: { setAttribute: (key: string, value: string) => attrs.set(key, value) },
    },
  });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  });
  applyAccent("periwinkle");
  // writeDevice first removes the null setting, then paints the default without persistence.
  setStored(ACCENT_KEY, null);
  applyAccent(DEFAULT_ACCENT, false);
  assert.equal(attrs.get("data-accent"), "pink");
  assert.equal(storage.has(ACCENT_KEY), false);
  assert.equal(getStored(ACCENT_KEY), null);
  assert.deepEqual(planSync({ accent: null }, { accent: getStored(ACCENT_KEY) }).toAccount, {});
});
