import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyDark, DARK_KEY, readDark, THEME_BOOT_SCRIPT } from "./theme.ts";

function fakeDom(darkClass: boolean, stored: string | null) {
  const classes = new Set(darkClass ? ["dark"] : []);
  const store = new Map<string, string>();
  if (stored != null) store.set(DARK_KEY, stored);

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        classList: {
          contains: (name: string) => classes.has(name),
          toggle: (name: string, on: boolean) => {
            if (on) classes.add(name);
            else classes.delete(name);
          },
        },
      },
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  return { classes, store };
}

test("readDark follows the live document class so remounting You keeps dark", () => {
  fakeDom(true, null);
  assert.equal(readDark(), true);
});

test("readDark falls back to the saved preference", () => {
  fakeDom(false, "yes");
  assert.equal(readDark(), true);
});

test("applyDark writes the class and remembers the choice", () => {
  const { classes, store } = fakeDom(false, null);
  applyDark(true);
  assert.equal(classes.has("dark"), true);
  assert.equal(store.get(DARK_KEY), "yes");
  applyDark(false);
  assert.equal(classes.has("dark"), false);
  assert.equal(store.has(DARK_KEY), false);
});

test("boot script turns dark on from the saved key", () => {
  assert.match(THEME_BOOT_SCRIPT, new RegExp(DARK_KEY));
  assert.match(THEME_BOOT_SCRIPT, /classList\.add\("dark"\)/);
});
