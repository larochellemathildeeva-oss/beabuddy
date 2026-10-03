/**
 * Did a server secret follow the code into the browser?
 *
 * `src/lib/*.functions.ts` ship to the client bundle, so a key read there, or
 * a server module imported eagerly, compiles into JavaScript anyone can
 * download (AGENTS.md). This scans the built client, `.output/public`, for
 * the names of the server-only environment variables and for anything shaped
 * like a Supabase secret key. It looks for names, never values: CI holds no
 * secrets, and must not be given them just to search for them.
 *
 *   npm run build && npm run check:public-secrets
 */
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Read only by `*.server.ts`; none of these belongs in the browser. */
export const SERVER_SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
  "GEOAPIFY_API_KEY",
  "LOCATIONIQ_TOKEN",
  "OPEN_PLACES_API_KEY",
  "OVERTURE_API_KEY",
  "PEXELS_API_KEY",
];

/**
 * A Supabase secret key itself. supabase-js carries the bare `sb_secret_`
 * prefix to recognise keys, so only the prefix with a key's worth after it
 * counts.
 */
const SECRET_SHAPES = [
  { name: "a Supabase secret key (sb_secret_…)", re: /sb_secret_[A-Za-z0-9_-]{16,}/ },
];

const TEXT = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".css",
  ".map",
  ".txt",
  ".webmanifest",
]);

/** What in `text` should not be there. */
export function findForbiddenSecrets(text, names = SERVER_SECRET_NAMES) {
  return [
    ...names.filter((name) => text.includes(name)),
    ...SECRET_SHAPES.filter((s) => s.re.test(text)).map((s) => s.name),
  ];
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (TEXT.has(extname(entry.name))) out.push(path);
  }
  return out;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // node-server (Canner) builds into .output/public; the vercel preset into .vercel/output/static.
  const repo = resolve(fileURLToPath(import.meta.url), "../..");
  const roots = [".output/public", ".vercel/output/static"].map((dir) => resolve(repo, dir));
  const files = [];
  for (const root of roots) {
    try {
      files.push(...(await walk(root)));
    } catch {
      // Not built for that host.
    }
  }
  if (!files.length) {
    console.error(`No build at ${roots.join(" or ")}: run npm run build first.`);
    process.exit(1);
  }
  const hits = [];
  for (const file of files) {
    for (const name of findForbiddenSecrets(await readFile(file, "utf8")))
      hits.push({ file, name });
  }
  if (hits.length) {
    console.error("Server secrets found in the public build:");
    for (const h of hits) console.error(`  - ${h.name}: ${h.file}`);
    process.exit(1);
  }
  console.log(`${files.length} public files, no server secret names or keys.`);
}
