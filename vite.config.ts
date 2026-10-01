import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { textScaleVisitor } from "./src/lib/text-scale-css.ts";

/**
 * The version shown in the app header lives in package.json and is bumped
 * on purpose before a Canner deploy:
 *
 *   npm run version:fix      — bug fixes only          1.0.0 → 1.0.1
 *   npm run version:enhance  — better existing features 1.0.0 → 1.1.0
 *   npm run version:feature  — new / large features     1.0.0 → 2.0.0
 */

const appVersion =
  (
    JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
      version?: string;
    }
  ).version ?? "1.0.0";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      // Anything under a server/ folder, or importing "server-only", never reaches the browser.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Canner is a Node host. node-server emits .output/server/index.mjs and listens on $PORT.
    ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
    viteReact(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  // Every pixel font size follows the reading text size (accessibility.ts).
  css: { transformer: "lightningcss", lightningcss: { visitor: textScaleVisitor } },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: { port: 8080 },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env["PORT"]) || 4173,
    strictPort: true,
  },
}));
