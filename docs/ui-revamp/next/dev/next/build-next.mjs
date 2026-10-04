// Preview-only build for the new Home (/next) and Trips (/trips/next) screens.
//   BEA_APP=/path/to/beabuddy node dev/next/build-next.mjs
// Bundles the package's REAL route files against the app checkout: `@/x`
// resolves to dev/next/shims/x (sample data stand-ins), then ../../src/x
// (this package), then $BEA_APP/src/x (the app). Bare packages come from
// $BEA_APP/node_modules, so run `npm ci` in the app first. Output: next-preview/
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "../..");
const app = resolve(process.env.BEA_APP ?? "/tmp/bea-check");
const appSrc = join(app, "src");
const shims = join(here, "shims");
const out = join(pkg, "next-preview");
mkdirSync(out, { recursive: true });

const EXTS = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];
const file = (p) => {
  for (const e of EXTS) {
    const f = p + e;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
};
// A file of the app that has a preview stand-in is swapped, however it is imported.
const shimFor = (abs) => {
  if (!abs.startsWith(appSrc + "/")) return null;
  const rel = relative(appSrc, abs).replace(/\.(tsx?|jsx?)$/, "");
  return file(join(shims, rel));
};

const resolver = {
  name: "bea-preview-resolve",
  setup(b) {
    b.onResolve({ filter: /^@\// }, (a) => {
      const rel = a.path.slice(2);
      for (const base of [shims, join(pkg, "src"), appSrc]) {
        const f = file(join(base, rel));
        if (f) return { path: f };
      }
      return { errors: [{ text: `not found: ${a.path}` }] };
    });
    b.onResolve({ filter: /^\.\.?\// }, (a) => {
      const want = resolve(a.resolveDir, a.path.replace(/\?.*$/, ""));
      // A package file importing its app neighbour ("./module-layout.ts") finds it in the app.
      const pkgSrc = join(pkg, "src");
      const f =
        file(want) ??
        (want.startsWith(pkgSrc + "/")
          ? file(join(appSrc, relative(pkgSrc, want)))
          : null);
      if (!f) return undefined;
      return { path: shimFor(f) ?? f };
    });
    b.onResolve({ filter: /^@tanstack\/react-start(\/.*)?$/ }, () => ({
      path: join(shims, "_pkg/react-start.ts"),
    }));
    // Server functions and server-only files never reach the browser: each export becomes `async () => null`.
    b.onLoad({ filter: /\.(functions|server)\.tsx?$/ }, async (a) => {
      if (!a.path.startsWith(appSrc + "/")) return undefined;
      const src = await readFile(a.path, "utf8");
      const names = [
        ...src.matchAll(
          /^export\s+(?:async\s+)?(?:const|function|let)\s+(\w+)/gm,
        ),
      ].map((m) => m[1]);
      return {
        contents: names
          .map((n) => `export const ${n} = async () => null;`)
          .join("\n"),
        loader: "ts",
      };
    });
    // One copy of every package (react above all): the app's.
    b.onResolve({ filter: /^[^./]/ }, async (a) => {
      if (a.pluginData?.again || a.path.startsWith("@/")) return undefined;
      return b.resolve(a.path, {
        kind: a.kind,
        resolveDir: app,
        pluginData: { again: true },
      });
    });
  },
};

await build({
  entryPoints: { app: join(here, "entry.tsx") },
  bundle: true,
  format: "esm",
  splitting: false,
  minify: true,
  sourcemap: false,
  outdir: out,
  jsx: "automatic",
  platform: "browser",
  plugins: [resolver],
  loader: {
    ".png": "file",
    ".webp": "file",
    ".jpg": "file",
    ".svg": "file",
    ".woff2": "file",
  },
  assetNames: "assets/[name]-[hash]",
  publicPath: "./",
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env.DEV": "false",
    "import.meta.env.PROD": "false",
    "import.meta.env.SSR": "false",
    __APP_VERSION__: JSON.stringify(
      JSON.parse(readFileSync(join(app, "package.json"), "utf8")).version,
    ),
  },
  logLevel: "warning",
});

// Tailwind: the app's own stylesheet, with this package's classes and next.css.
const tw = join(here, ".tailwind-next.css");
writeFileSync(
  tw,
  `@import "${join(appSrc, "styles.css")}";\n@source "${join(pkg, "src")}";\n@source "${here}";\n@import "${join(pkg, "src/styles/next.css")}";\n`,
);
const cli = [
  join(app, "node_modules/.bin/tailwindcss"),
  join(pkg, "dev/node_modules/.bin/tailwindcss"),
].find(existsSync);
execFileSync(cli, ["-i", tw, "-o", join(out, "app.css"), "--minify"], {
  stdio: "inherit",
  cwd: app,
});
rmSync(tw);

// The app's public pictures (relief tiles, banners, place art, logo) are linked, not copied.
for (const d of ["relief", "banners", "places", "bea", "earth", "geo"]) {
  const to = join(out, d);
  if (existsSync(join(app, "public", d)) && !existsSync(to))
    symlinkSync(join(app, "public", d), to);
}
cpSync(join(here, "index.html"), join(out, "index.html"));
console.log(
  `built ${relative(process.cwd(), out)}/  (serve it: python3 -m http.server -d next-preview 8765)`,
);
