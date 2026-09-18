import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every tour and page-guide step must point at something that exists.
 *
 * A step whose target is gone fails silently: the spotlight finds nothing and
 * the step narrates a control that is not on screen. Worse, a step with
 * `awaitClick` leaves Next disabled with nothing to tap — a soft-locked tour.
 *
 * This has now happened four times in a fortnight, each time because a feature
 * moved or went and its guide stayed behind: the demo-city buttons on Near,
 * Near itself becoming a filter and then moving to Home, the heatmap, and the
 * Story/Memories shortcuts on Home. Every one was found by eye. This finds
 * them instead.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return walk(path);
    return e.name.endsWith(".tsx") && !e.name.endsWith(".test.tsx") ? [path] : [];
  });
}

/** Everything the app actually marks as a guide target. */
const markup = walk(join(src, "routes"))
  .concat(walk(join(src, "components")))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const declared = new Set<string>();
for (const m of markup.matchAll(/data-guide="([a-z0-9-]+)"/g)) declared.add(m[1]!);
// `<Section guide="…">` and the like pass it through as a prop.
for (const m of markup.matchAll(/\bguide="([a-z0-9-]+)"/g)) declared.add(m[1]!);

/** Everything the tour and the page guides ask for. */
function selectorsIn(file: string): string[] {
  const text = readFileSync(join(src, file), "utf8");
  return [...text.matchAll(/data-guide='([a-z0-9-]+)'/g)].map((m) => m[1]!);
}

describe("guide and tour targets", () => {
  it("found the app's guide markup at all", () => {
    assert.ok(declared.size > 20, `only found ${declared.size} data-guide targets; walk broke`);
  });

  for (const file of ["lib/tour.ts", "components/PageGuide.tsx"]) {
    it(`${file} only points at targets that exist`, () => {
      const missing = [...new Set(selectorsIn(file))].filter((s) => !declared.has(s));
      assert.deepEqual(
        missing,
        [],
        `these steps spotlight nothing — the feature moved or went, the guide stayed: ${missing.join(", ")}`,
      );
    });
  }
});
