// Rebuilds the standalone pages' bundles: node dev/build.mjs  (after `npm i` in dev/)
// Outputs demo/preview.js, demo/globe-demo.js, demo/preview.css, demo/textures.js
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dev = dirname(fileURLToPath(import.meta.url));
const root = resolve(dev, "..");
const out = join(root, "demo");
mkdirSync(out, { recursive: true });

// `@/x` → dev/shims/x (verbatim copies of the app files the package imports: cn, icons, Pin, useThemeName, countryKey) or src/x.
const alias = {
  name: "at-alias",
  setup(b) {
    b.onResolve({ filter: /^@\// }, (args) => {
      const rel = args.path.slice(2);
      for (const base of [join(dev, "shims"), join(root, "src")]) {
        for (const ext of [".ts", ".tsx", "/index.ts", ""]) {
          const p = join(base, rel + ext);
          if (existsSync(p) && !p.endsWith("/")) return { path: p };
        }
      }
      return undefined;
    });
  },
};

await build({
  entryPoints: { "globe-demo": join(dev, "globe-demo-entry.tsx"), preview: join(dev, "preview-entry.tsx") },
  bundle: true,
  format: "iife",
  minify: true,
  outdir: out,
  jsx: "automatic",
  nodePaths: [join(dev, "node_modules")],
  plugins: [alias],
  loader: { ".png": "dataurl", ".webp": "dataurl" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

execFileSync(join(dev, "node_modules/.bin/tailwindcss"), ["-i", join(dev, "tailwind.css"), "-o", join(out, "preview.css"), "--minify"], {
  stdio: "inherit",
});

// Textures as data: URIs so the demo works from file:// (WebGL refuses file:// images).
// day/night are the app's own public/earth files (copied here for the demo only); relief is new.
const b64 = (f) => readFileSync(f === "relief.webp" ? join(root, "public/earth", f) : join(dev, "earth", f)).toString("base64");
writeFileSync(
  join(out, "textures.js"),
  `window.BEA_EARTH_TEXTURES={day:"data:image/webp;base64,${b64("day.webp")}",night:"data:image/webp;base64,${b64("night.webp")}",relief:"data:image/webp;base64,${b64("relief.webp")}"};\n`,
);
console.log("built demo/");
