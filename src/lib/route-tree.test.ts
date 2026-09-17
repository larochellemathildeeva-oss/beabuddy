import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A nested route whose parent never renders an <Outlet /> is invisible.
 *
 * This is not hypothetical. `trips.$tripId.tsx` was generated as a *child* of
 * `trips.tsx` — that is what a shared filename prefix means in flat routing —
 * and `trips.tsx` is a full page with no Outlet in it. So tapping a trip
 * changed the URL and left the list on screen: trips stopped opening, and
 * nothing anywhere threw. The fix was `trips_.$tripId.tsx`, where the trailing
 * underscore opts the route out of nesting.
 *
 * The failure is silent, the route tree is generated rather than written, and
 * the trap is re-armed by anything named `<existing-route>.<something>.tsx`.
 * So the invariant is checked here rather than remembered.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..");
const tree = readFileSync(join(src, "routeTree.gen.ts"), "utf8");

/** `import { Route as FooRouteImport } from './routes/foo'` → Foo → ./routes/foo */
function importedRouteFiles(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /import \{ Route as (\w+?)RouteImport \} from '\.\/(.+?)'/g;
  for (const m of tree.matchAll(re)) out.set(m[1]!, m[2]!);
  return out;
}

/** `const FooRoute = ….update({ … getParentRoute: () => BarRoute })` → Foo → Bar */
function parentByRoute(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /const (\w+?)Route = \w+RouteImport\.update\(\{[\s\S]*?getParentRoute: \(\) => (\w+)/g;
  for (const m of tree.matchAll(re)) out.set(m[1]!, m[2]!);
  return out;
}

function sourceOf(routeName: string, files: Map<string, string>): string | null {
  const rel = files.get(routeName);
  if (!rel) return null;
  for (const ext of [".tsx", ".ts"]) {
    const path = join(src, rel + ext);
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  return null;
}

describe("generated route tree", () => {
  const files = importedRouteFiles();
  const parents = parentByRoute();

  it("parses — otherwise every assertion below is vacuously true", () => {
    assert.ok(files.size > 5, "no route imports found; the generator's format changed");
    assert.ok(parents.size > 5, "no parent links found; the generator's format changed");
  });

  it("gives every nested route a parent that renders an Outlet", () => {
    for (const [route, parent] of parents) {
      // rootRouteImport is __root, which does render an Outlet.
      if (parent === "rootRouteImport") continue;

      // `getParentRoute: () => AuthenticatedRouteRoute` refers to the route
      // whose own name is `AuthenticatedRoute`.
      const parentName = parent.replace(/Route$/, "");
      const parentSource = sourceOf(parentName, files);
      assert.ok(parentSource, `${route} has parent ${parent}, whose source was not found`);
      assert.match(
        parentSource,
        /<Outlet\b/,
        `${route} is nested under ${parentName}, which renders no <Outlet /> — ` +
          `the child can never appear. Rename the child with a trailing underscore ` +
          `(e.g. trips_.$tripId.tsx) to un-nest it, or give the parent an Outlet.`,
      );
    }
  });

  it("keeps the trip page reachable at /trips/$tripId", () => {
    // The URL is the contract: links, the page guide's pattern and any shared
    // link all use this path, whatever the file is called.
    assert.match(tree, /path: '\/trips\/\$tripId'/);
  });
});
