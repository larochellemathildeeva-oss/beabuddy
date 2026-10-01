import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  ACCESSIBILITY_BOOT_SCRIPT,
  ACCESSIBILITY_KEY,
  applyAccessibility,
  DEFAULT_ACCESSIBILITY,
  FONT_HREF,
  parseAccessibility,
  serializeAccessibility,
  TEXT_SCALE,
  type Accessibility,
} from "./accessibility.ts";

function fakeRoot() {
  const dataset: Record<string, string> = {};
  const style = new Map<string, string>();
  return {
    dataset: dataset as DOMStringMap,
    style: {
      setProperty: (name: string, value: string) => void style.set(name, value),
      removeProperty: (name: string) => style.delete(name),
    },
    props: style,
  };
}

/** A document just big enough for the boot script and `loadFont`. */
function fakeDocument(stored: Record<string, string>) {
  const root = fakeRoot();
  const links: { id: string; rel: string; href: string }[] = [];
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: root,
      head: { appendChild: (l: { id: string; rel: string; href: string }) => links.push(l) },
      createElement: () => ({ id: "", rel: "", href: "", getAttribute: () => null }),
      getElementById: (id: string) => links.find((l) => l.id === id) ?? null,
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => stored[k] ?? null },
  });
  return { root, links };
}

const ALL_ON: Accessibility = {
  textSize: "larger",
  font: "easy",
  reduceMotion: true,
  moreContrast: true,
  boldText: true,
};

test("anything unknown or broken reads as the default", () => {
  assert.deepEqual(parseAccessibility(null), DEFAULT_ACCESSIBILITY);
  assert.deepEqual(parseAccessibility("not json"), DEFAULT_ACCESSIBILITY);
  assert.deepEqual(parseAccessibility("[1]"), DEFAULT_ACCESSIBILITY);
  assert.deepEqual(
    parseAccessibility(JSON.stringify({ textSize: "huge", font: "comic", boldText: "yes" })),
    DEFAULT_ACCESSIBILITY,
  );
});

test("only what differs from the default is stored", () => {
  assert.equal(serializeAccessibility(DEFAULT_ACCESSIBILITY), null);
  assert.equal(
    serializeAccessibility({ ...DEFAULT_ACCESSIBILITY, boldText: true }),
    '{"boldText":true}',
  );
  assert.deepEqual(parseAccessibility(serializeAccessibility(ALL_ON)), ALL_ON);
});

test("apply sets the scale and flags, and the default clears them", () => {
  const { root, links } = fakeDocument({});
  applyAccessibility(ALL_ON, root);
  assert.equal(root.props.get("--text-scale"), String(TEXT_SCALE.larger));
  assert.deepEqual(
    { ...root.dataset },
    { font: "easy", motion: "reduce", contrast: "more", bold: "on" },
  );
  assert.equal(links[0]?.href, FONT_HREF.easy);
  applyAccessibility(DEFAULT_ACCESSIBILITY, root);
  assert.equal(root.props.has("--text-scale"), false);
  assert.deepEqual({ ...root.dataset }, {});
});

test("the boot script applies the same as applyAccessibility", () => {
  for (const a of [ALL_ON, { ...ALL_ON, font: "system" as const, textSize: "small" as const }]) {
    const stored = serializeAccessibility(a) ?? "";
    const boot = fakeDocument({ [ACCESSIBILITY_KEY]: stored });
    new Function(ACCESSIBILITY_BOOT_SCRIPT)();
    const live = fakeDocument({});
    applyAccessibility(a, live.root);
    assert.deepEqual({ ...boot.root.dataset }, { ...live.root.dataset });
    assert.deepEqual([...boot.root.props], [...live.root.props]);
    assert.deepEqual(
      boot.links.map((l) => l.href),
      live.links.map((l) => l.href),
    );
  }
});

test("the boot script ignores a broken or hostile value", () => {
  for (const stored of ["{", '"x"', '{"textSize":"constructor","font":"__proto__"}']) {
    const { root, links } = fakeDocument({ [ACCESSIBILITY_KEY]: stored });
    new Function(ACCESSIBILITY_BOOT_SCRIPT)();
    assert.deepEqual({ ...root.dataset }, {});
    assert.equal(root.props.size, 0);
    assert.equal(links.length, 0);
  }
});
