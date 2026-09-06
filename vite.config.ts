// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Every build today stamped the same "1.9.0 · 2026-09-06", so there was no way to
 * tell a deployed fix from the build before it. A short commit sha answers
 * "am I actually running the new one?" without bumping the version by hand.
 */
function buildId(): string {
  const fromHost =
    process.env["CANNER_COMMIT_SHA"] ||
    process.env["GIT_COMMIT"] ||
    process.env["GITHUB_SHA"] ||
    process.env["VERCEL_GIT_COMMIT_SHA"];
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "local";
  }
}

/**
 * Versioning restarted at 1.0.1. major.minor come from package.json so they can
 * be bumped deliberately; the patch is derived from the commit count so it
 * climbs on its own and never needs remembering.
 *
 * Note this counts commits, not build runs — rebuilding the same commit gives
 * the same number, which is the useful behaviour: the version names the code.
 * The sha beside it distinguishes rebuilds.
 */
const COMMIT_OFFSET = 27; // commit 28 is 1.0.1

function patchNumber(): number {
  // A host-provided build number wins if there is one — it survives shallow clones.
  const fromHost = Number(
    process.env["CANNER_BUILD_NUMBER"] ?? process.env["GITHUB_RUN_NUMBER"] ?? Number.NaN,
  );
  if (Number.isFinite(fromHost) && fromHost > 0) return fromHost;
  try {
    const count = Number(
      execSync("git rev-list --count HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim(),
    );
    const patch = count - COMMIT_OFFSET;
    // A shallow clone reports 1, which would go negative. Fall through instead.
    if (Number.isFinite(patch) && patch > 0) return patch;
  } catch {
    /* no git in the build image */
  }
  return 0;
}

const pkgVersion =
  (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    version?: string;
  }).version ?? "1.0.0";
const [major = "1", minor = "0"] = pkgVersion.split(".");
const appVersion = `${major}.${minor}.${patchNumber()}`;

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
      // Stamp every build so the displayed app version updates on each release.
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_BUILD__: JSON.stringify(`${new Date().toISOString().slice(0, 10)} ${buildId()}`),
    },
  },
});
