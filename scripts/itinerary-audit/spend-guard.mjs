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
 *   AUDIT_OPENPLACES_CALLS  (default 120)   of the free plan's 10,000 a month
 *
 * A refused request answers 402, which Béa reads as "rest this provider":
 * the run carries on with the next one, or with none, and says so.
 *
 * Map answers are also cached on disk by URL (keys stripped), so running the
 * same stops again costs nothing. AUDIT_GEO_CACHE=off asks the map afresh.
 *
 * Frozen answers, for the pin checks CI runs: with AUDIT_FROZEN_DIR set, map
 * answers are read from that folder first. AUDIT_REPLAY=1 answers only from
 * it — a question it has no answer for gets a 404 and is counted as missed,
 * and nothing is sent anywhere. Without AUDIT_REPLAY, every answer used
 * (from the disk cache or the map, "not found" included) is copied into it.
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
  openplaces: Number(process.env.AUDIT_OPENPLACES_CALLS ?? 120),
};

/** Which paid service a URL goes to, if any. */
function serviceOf(url) {
  const host = url.hostname;
  if (host.endsWith("geoapify.com")) return "geoapify";
  if (host.endsWith("locationiq.com")) return "locationiq";
  if (host === "generativelanguage.googleapis.com") return "gemini";
  if (host.endsWith("openplacesapi.com")) return "openplaces";
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
  const frozenDir = process.env.AUDIT_FROZEN_DIR ? join(root, process.env.AUDIT_FROZEN_DIR) : null;
  const replay = Boolean(frozenDir) && process.env.AUDIT_REPLAY === "1";
  if (frozenDir) mkdirSync(frozenDir, { recursive: true });
  const missed = [];

  const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
  const { geoapifyCredits } = await jiti.import(join(root, "src/lib/geo-credits.ts"));

  const day = new Date().toISOString().slice(0, 10);
  const readLedger = () => {
    try {
      const all = JSON.parse(readFileSync(ledgerFile, "utf8"));
      return all.day === day ? all : { day, geoapify: 0, locationiq: 0, gemini: 0, openplaces: 0 };
    } catch {
      return { day, geoapify: 0, locationiq: 0, gemini: 0, openplaces: 0 };
    }
  };
  let ledger = readLedger();
  const thisRun = { geoapify: 0, locationiq: 0, gemini: 0, openplaces: 0, cached: 0, refused: 0 };

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

    const method = String(
      init?.method ?? (typeof input === "object" ? input.method : undefined) ?? "GET",
    ).toUpperCase();
    const cacheable = (useCache || frozenDir) && service !== "gemini" && method === "GET";
    const name = `${createHash("sha256").update(keyless(href)).digest("hex")}.json`;
    const cacheFile = cacheable ? join(cacheDir, name) : null;
    const frozenFile = cacheable && frozenDir ? join(frozenDir, name) : null;
    if (frozenFile && existsSync(frozenFile)) {
      const saved = JSON.parse(readFileSync(frozenFile, "utf8"));
      thisRun.cached++;
      return new Response(saved.body, { status: saved.status, headers: saved.headers });
    }
    if (replay) {
      missed.push(keyless(href));
      return new Response(JSON.stringify({ error: "not in the frozen answers" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    if (useCache && cacheFile && existsSync(cacheFile)) {
      const saved = JSON.parse(readFileSync(cacheFile, "utf8"));
      thisRun.cached++;
      if (frozenFile) writeFileSync(frozenFile, JSON.stringify(saved));
      return new Response(saved.body, { status: saved.status, headers: saved.headers });
    }

    const cost = service === "geoapify" ? (geoapifyCredits(href) ?? 1) : 1;
    ledger = readLedger();
    ledger[service] ??= 0;
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
    if (cacheFile && (res.status === 200 || (frozenFile && res.status === 404))) {
      const body = await res.clone().text();
      const headers = { "content-type": res.headers.get("content-type") ?? "application/json" };
      const saved = JSON.stringify({ status: res.status, headers, body });
      // "Not found" is frozen too, so a replay can tell it from a question
      // never asked; the everyday cache keeps only answers.
      if (useCache && res.status === 200) writeFileSync(cacheFile, saved);
      if (frozenFile) writeFileSync(frozenFile, saved);
    }
    return res;
  };

  return {
    /** Questions a replay had no frozen answer for. */
    missed,
    report() {
      const today = readLedger();
      console.log(
        `[spend] this run: Geoapify ${thisRun.geoapify} credits, LocationIQ ${thisRun.locationiq}, Gemini ${thisRun.gemini} calls, Open Places ${thisRun.openplaces}, ${thisRun.cached} answered from cache, ${thisRun.refused} refused. ` +
          (replay ? `${missed.length} not in the frozen answers. ` : "") +
          `Today (UTC): Geoapify ${today.geoapify}/${CAPS.geoapify}, LocationIQ ${today.locationiq}/${CAPS.locationiq}, Gemini ${today.gemini}/${CAPS.gemini}, Open Places ${today.openplaces ?? 0}/${CAPS.openplaces}.`,
      );
    },
  };
}
