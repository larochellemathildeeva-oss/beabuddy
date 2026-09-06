// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync } from "node:fs";

/**
 * The version shown in the app header lives in package.json and is bumped
 * on purpose before a Canner deploy:
 *
 *   npm run version:fix      — bug fixes only          1.0.0 → 1.0.1
 *   npm run version:enhance  — better existing features 1.0.0 → 1.1.0
 *   npm run version:feature  — new / large features     1.0.0 → 2.0.0
 */

const appVersion =
  (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    version?: string;
  }).version ?? "1.0.0";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Canner is a Node host, not Cloudflare. node-server emits .output/server/index.mjs
  // and listens on $PORT.
  nitro: { preset: "node-server" },
  vite: {
    preview: {
      host: "0.0.0.0",
      port: Number(process.env["PORT"]) || 4173,
      strictPort: true,
    },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
  },
});
