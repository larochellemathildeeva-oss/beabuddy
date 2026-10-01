/*
 * Béa's service worker: enough to open Béa with no signal.
 *
 * - Pages: from the network, and the last copy of each is kept, so a page
 *   opened before opens again offline.
 * - Built files (/assets/…, named by their contents): kept the first time
 *   they are fetched; a new build brings new names, so nothing goes stale.
 * - Everything else — server functions, Supabase, map tiles, other hosts —
 *   is left alone: live data is never answered from here. The trip itself
 *   comes from what "Keep offline" saved on the phone, and the map tiles
 *   from their own cache.
 *
 * Bump VERSION to drop every copy kept by an older worker. The maps a
 * traveller kept offline (bea-map-…) are theirs, not the worker's: they stay
 * until the traveller, sign-out or erasure removes them.
 */
const VERSION = "v2";
const PAGES = `bea-pages-${VERSION}`;
const ASSETS = `bea-assets-${VERSION}`;
const SHELL = [
  "/",
  "/trips",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];
/**
 * How long a page may wait on the network before the copy kept here is
 * shown. On a weak signal the request neither answers nor fails; without
 * this, the traveller watched a blank screen until it did.
 */
const NAVIGATE_TIMEOUT_MS = 3500;
/**
 * Built files kept at most. Each build adds new names and nothing removed
 * the old ones, so the cache only grew; the oldest go first.
 */
const MAX_ASSETS = 250;

async function trimAssets() {
  const cache = await caches.open(ASSETS);
  const keys = await cache.keys();
  const extra = keys.length - MAX_ASSETS;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

async function keptPage(pathname) {
  const cache = await caches.open(PAGES);
  return (await cache.match(pathname)) || (await cache.match("/trips")) || (await cache.match("/"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("bea-pages-") || key.startsWith("bea-assets-")) &&
                key !== PAGES &&
                key !== ASSETS,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Live data and account pages are never served from a copy.
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/shared/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const network = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(PAGES).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        });
        // The network keeps going after a timeout, so the kept copy is
        // refreshed for next time even when this visit used the old one.
        event.waitUntil(network.catch(() => {}));
        const timedOut = new Promise((resolve) =>
          setTimeout(() => resolve("timeout"), NAVIGATE_TIMEOUT_MS),
        );
        try {
          const first = await Promise.race([network, timedOut]);
          if (first !== "timeout") return first;
          // Slow, not dead: a kept copy now if there is one, else keep waiting.
          return (await keptPage(url.pathname)) || (await network);
        } catch {
          return (
            (await keptPage(url.pathname)) ||
            new Response("Béa needs a connection to open this page for the first time.", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) {
          event.waitUntil(cache.put(request, response.clone()).then(trimAssets));
        }
        return response;
      }),
    );
  }
});
