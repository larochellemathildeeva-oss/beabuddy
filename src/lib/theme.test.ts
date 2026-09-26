import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  applyTheme,
  DARK_KEY,
  DEFAULT_THEME,
  isThemeName,
  readTheme,
  THEME_BOOT_SCRIPT,
  THEME_KEY,
} from "./theme.ts";

function fakeDom(attr: string | null, stored: Record<string, string> = {}) {
  const classes = new Set<string>();
  const attrs = new Map<string, string>();
  if (attr != null) attrs.set("data-theme", attr);
  const store = new Map<string, string>(Object.entries(stored));

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        getAttribute: (name: string) => attrs.get(name) ?? null,
        setAttribute: (name: string, value: string) => {
          attrs.set(name, value);
        },
        classList: {
          contains: (name: string) => classes.has(name),
          add: (name: string) => {
            classes.add(name);
          },
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
  return { classes, attrs, store };
}

test("the three themes are the only valid names", () => {
  assert.equal(isThemeName("calm"), true);
  assert.equal(isThemeName("colorful"), true);
  assert.equal(isThemeName("dark"), true);
  assert.equal(isThemeName("light"), false);
  assert.equal(isThemeName(null), false);
});

test("readTheme follows the live document so remounting You keeps the choice", () => {
  fakeDom("colorful", { [THEME_KEY]: "calm" });
  assert.equal(readTheme(), "colorful");
});

test("readTheme falls back to the saved theme", () => {
  fakeDom(null, { [THEME_KEY]: "dark" });
  assert.equal(readTheme(), "dark");
});

test("someone who had the old dark switch on stays dark", () => {
  fakeDom(null, { [DARK_KEY]: "yes" });
  assert.equal(readTheme(), "dark");
});

test("nothing saved means Calm", () => {
  fakeDom(null);
  assert.equal(readTheme(), DEFAULT_THEME);
  assert.equal(DEFAULT_THEME, "calm");
});

test("applyTheme sets the attribute, the dark class and remembers the choice", () => {
  const { classes, attrs, store } = fakeDom(null, { [DARK_KEY]: "yes" });
  applyTheme("dark");
  assert.equal(attrs.get("data-theme"), "dark");
  assert.equal(classes.has("dark"), true);
  assert.equal(store.get(THEME_KEY), "dark");
  assert.equal(store.has(DARK_KEY), false);

  applyTheme("colorful");
  assert.equal(attrs.get("data-theme"), "colorful");
  assert.equal(classes.has("dark"), false);
  assert.equal(store.get(THEME_KEY), "colorful");
});

test("boot script reads both keys and sets theme before paint", () => {
  assert.match(THEME_BOOT_SCRIPT, new RegExp(THEME_KEY));
  assert.match(THEME_BOOT_SCRIPT, new RegExp(DARK_KEY));
  assert.match(THEME_BOOT_SCRIPT, /setAttribute\("data-theme"/);
  assert.match(THEME_BOOT_SCRIPT, /classList\.add\("dark"\)/);
});

test("boot script picks the right theme for each saved state", () => {
  const cases: [Record<string, string>, string, boolean][] = [
    [{}, "calm", false],
    [{ [THEME_KEY]: "colorful" }, "colorful", false],
    [{ [THEME_KEY]: "dark" }, "dark", true],
    [{ [DARK_KEY]: "yes" }, "dark", true],
    [{ [THEME_KEY]: "nonsense" }, "calm", false],
  ];
  for (const [stored, theme, dark] of cases) {
    const { attrs, classes } = fakeDom(null, stored);
    new Function(THEME_BOOT_SCRIPT)();
    assert.equal(attrs.get("data-theme"), theme);
    assert.equal(classes.has("dark"), dark);
  }
});
