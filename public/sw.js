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
 * Bump VERSION to drop every copy kept by an older worker.
 */
const VERSION = "v1";
const PAGES = `bea-pages-${VERSION}`;
const ASSETS = `bea-assets-${VERSION}`;
const SHELL = ["/", "/trips", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

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
            .filter((key) => key.startsWith("bea-") && key !== PAGES && key !== ASSETS)
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
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(PAGES).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES);
          return (
            (await cache.match(url.pathname)) ||
            (await cache.match("/trips")) ||
            (await cache.match("/")) ||
            new Response("Béa needs a connection to open this page for the first time.", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) void cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
