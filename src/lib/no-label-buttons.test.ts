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

// `.mono-caps` is the small quiet label style. A button that borrows it reads
// as a 12px grey caption, not an action.
test("no sheet action button takes the label style", () => {
  const hits = tsxFiles(new URL("../", import.meta.url).pathname).filter((file) =>
    /className="[^"]*\bmenu-done\b[^"]*\bmono-caps\b|className="[^"]*\bmono-caps\b[^"]*\bmenu-done\b/.test(
      readFileSync(file, "utf8"),
    ),
  );
  assert.deepEqual(hits, []);
});
