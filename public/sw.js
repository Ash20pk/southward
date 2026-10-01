// Southward service worker: makes the app installable and keeps studied pages working offline.
// - App code and static assets: cache-first (their URLs change whenever they change).
// - Pages: network-first, falling back to the last cached copy (with or without its query string), then the app shell.
// - API calls (AI, sync, sign-in) are never cached.
// Responses are cloned before being returned: a body can only be read once, so cloning later fails silently.
const VERSION = "southward-v4";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/app", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Offline: this exact page; else, for a page load, the same page saved under another query string (screens read their
// query in the browser, so /app/practice serves /app/practice?topic=cardiology); else the app shell. Only a saved HTML
// page will do for a page load: the router's data requests (?_rsc=) are saved under the same paths.
async function offlinePage(req, url) {
  const exact = await caches.match(req, { ignoreVary: true });
  if (exact) return exact;
  if (!url.searchParams.has("_rsc")) {
    const saved = await (await caches.open(PAGES)).matchAll(req, { ignoreVary: true, ignoreSearch: true });
    const page = saved.find((res) => res.headers.get("content-type")?.includes("text/html"));
    if (page) return page;
  }
  return caches.match("/app");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const isStatic =
    url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/splash/") || /\.(woff2?|png|svg|ico)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html") || url.searchParams.has("_rsc")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => offlinePage(req, url)),
    );
  }
});
