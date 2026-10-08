import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

// DM Sans is the only family the app ships; a screen that names a retired one
// shows the traveller a label or sample in a fallback font.
test("no component names a font the app no longer loads", () => {
  const stale = /Manrope|Bodoni|Instrument Serif/;
  const hits = tsxFiles(new URL("../", import.meta.url).pathname).filter((file) =>
    stale.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(hits, []);
});
