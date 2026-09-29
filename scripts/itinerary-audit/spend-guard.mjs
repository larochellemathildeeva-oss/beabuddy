/**
 * A hard spending cap for the audit scripts, kept across runs.
 *
 * Béa's own Geoapify guard (geo-provider.server.ts) counts in the server's
 * memory, which is right for a server and wrong for a script: every run
 * started again at 0, and a day of audit runs spent about 4,300 credits of a
 * 3,000-credit free plan. This counts every paid request in a file, per UTC
 * day, and refuses the one that would go over the day's cap:
 *
 *   AUDIT_GEOAPIFY_CREDITS  (default 500)   priced as Geoapify charges (geo-credits.ts)
 *   AUDIT_LOCATIONIQ_CALLS  (default 1500)  of the free plan's 5,000 a day
 *   AUDIT_GEMINI_CALLS      (default 100)   about 1–1.5 US cents each
 *
 * A refused request answers 402, which Béa reads as "rest this provider":
 * the run carries on with the next one, or with none, and says so.
 *
 * Map answers are also cached on disk by URL (keys stripped), so running the
 * same stops again costs nothing. AUDIT_GEO_CACHE=off asks the map afresh.
 *
 * Import it first, before anything that may fetch:
 *   const guard = await installSpendGuard(root);   …   guard.report();
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createJiti } from "jiti";

const CAPS = {
  geoapify: Number(process.env.AUDIT_GEOAPIFY_CREDITS ?? 500),
  locationiq: Number(process.env.AUDIT_LOCATIONIQ_CALLS ?? 1500),
  gemini: Number(process.env.AUDIT_GEMINI_CALLS ?? 100),
};

/** Which paid service a URL goes to, if any. */
function serviceOf(url) {
  const host = url.hostname;
  if (host.endsWith("geoapify.com")) return "geoapify";
  if (host.endsWith("locationiq.com")) return "locationiq";
  if (host === "generativelanguage.googleapis.com") return "gemini";
  return null;
}

/** The URL without its key, so the cache and the ledger never hold one. */
function keyless(url) {
  const u = new URL(url);
  for (const k of ["apiKey", "key", "api_key"]) u.searchParams.delete(k);
  return u.toString();
}

export async function installSpendGuard(root) {
  const dir = join(root, "scripts/itinerary-audit/out");
  mkdirSync(dir, { recursive: true });
  const ledgerFile = join(dir, "spend.json");
  const cacheDir = join(dir, "geo-cache");
  mkdirSync(cacheDir, { recursive: true });
  const useCache = process.env.AUDIT_GEO_CACHE !== "off";

  const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
  const { geoapifyCredits } = await jiti.import(join(root, "src/lib/geo-credits.ts"));

  const day = new Date().toISOString().slice(0, 10);
  const readLedger = () => {
    try {
      const all = JSON.parse(readFileSync(ledgerFile, "utf8"));
      return all.day === day ? all : { day, geoapify: 0, locationiq: 0, gemini: 0 };
    } catch {
      return { day, geoapify: 0, locationiq: 0, gemini: 0 };
    }
  };
  let ledger = readLedger();
  const thisRun = { geoapify: 0, locationiq: 0, gemini: 0, cached: 0, refused: 0 };

  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const href = typeof input === "string" ? input : (input.url ?? String(input));
    let url;
    try {
      url = new URL(href);
    } catch {
      return original(input, init);
    }
    const service = serviceOf(url);
    if (!service) return original(input, init);

    const method = (
      init?.method ??
      (typeof input === "object" && input.method) ??
      "GET"
    ).toUpperCase();
    const cacheable = useCache && service !== "gemini" && method === "GET";
    const cacheFile = cacheable
      ? join(cacheDir, `${createHash("sha256").update(keyless(href)).digest("hex")}.json`)
      : null;
    if (cacheFile && existsSync(cacheFile)) {
      const saved = JSON.parse(readFileSync(cacheFile, "utf8"));
      thisRun.cached++;
      return new Response(saved.body, { status: saved.status, headers: saved.headers });
    }

    const cost = service === "geoapify" ? (geoapifyCredits(href) ?? 1) : 1;
    ledger = readLedger();
    if (ledger[service] + cost > CAPS[service]) {
      thisRun.refused++;
      if (thisRun.refused === 1) {
        console.warn(
          `[spend] ${service}: today's audit cap is ${CAPS[service]} and ${ledger[service]} is spent — refusing further requests.`,
        );
      }
      return new Response(JSON.stringify({ error: "audit spending cap reached" }), {
        status: 402,
        headers: { "content-type": "application/json" },
      });
    }
    ledger[service] += cost;
    thisRun[service] += cost;
    writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2));

    const res = await original(input, init);
    if (cacheFile && res.status === 200) {
      const body = await res.clone().text();
      const headers = { "content-type": res.headers.get("content-type") ?? "application/json" };
      writeFileSync(cacheFile, JSON.stringify({ status: 200, headers, body }));
    }
    return res;
  };

  return {
    report() {
      const today = readLedger();
      console.log(
        `[spend] this run: Geoapify ${thisRun.geoapify} credits, LocationIQ ${thisRun.locationiq}, Gemini ${thisRun.gemini} calls, ${thisRun.cached} answered from cache, ${thisRun.refused} refused. ` +
          `Today (UTC): Geoapify ${today.geoapify}/${CAPS.geoapify}, LocationIQ ${today.locationiq}/${CAPS.locationiq}, Gemini ${today.gemini}/${CAPS.gemini}.`,
      );
    },
  };
}
