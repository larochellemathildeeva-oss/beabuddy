/**
 * The real import code the pin checks run — geocodePlanStops and the match
 * scoring — bundled for Node with the server-function stand-ins from
 * scripts/places-bench, so it runs outside the app.
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const bench = join(root, "scripts/places-bench");
const out = join(here, "out");

export async function buildPinsBundle() {
  mkdirSync(out, { recursive: true });
  const entry = join(out, "pins-entry.ts");
  writeFileSync(
    entry,
    [
      `export { geocodePlanStops } from ${JSON.stringify(join(root, "src/lib/geocode-plan.functions.ts"))};`,
      `export { readPlainAsList } from ${JSON.stringify(join(root, "src/lib/itinerary.functions.ts"))};`,
      `export { afterJourney, afterRide, parentIndex, pinIsSaved, placeBatches } from ${JSON.stringify(join(root, "src/lib/import-stop.ts"))};`,
      `export { scoreMatch } from ${JSON.stringify(join(root, "src/lib/match-confidence.ts"))};`,
      `export { outsideAddressDistrict } from ${JSON.stringify(join(root, "src/lib/japan-address.ts"))};`,
      `export { airportMatch } from ${JSON.stringify(join(root, "src/lib/geocode-plan.ts"))};`,
      `export { FIXTURES as OLD } from ${JSON.stringify(join(here, "fixtures.ts"))};`,
      `export { FIXTURES as FRESH } from ${JSON.stringify(join(here, "fixtures-fresh.ts"))};`,
      `export { FIXTURES as MORE } from ${JSON.stringify(join(here, "fixtures-more.ts"))};`,
      `export { FIXTURES as WORLD } from ${JSON.stringify(join(here, "fixtures-world.ts"))};`,
    ].join("\n"),
  );
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(out, "pins.bundle.mjs"),
    tsconfig: join(root, "tsconfig.json"),
    logLevel: "error",
    packages: "external",
    alias: {
      "@tanstack/react-start": join(bench, "fake-start.ts"),
      "@/integrations/supabase/auth-middleware": join(bench, "fake-auth.ts"),
    },
  });
  return import(join(out, "pins.bundle.mjs"));
}
