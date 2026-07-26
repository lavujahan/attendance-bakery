// Minimal service worker. Only exists so Chrome/Android consider this an installable
// PWA (real "Install app" + standalone display, not just a bookmark shortcut) — the
// installability check requires a registered service worker with a fetch handler. It
// deliberately does no caching: this is a live attendance system, so every request
// (check-in/out, GPS, face verification) must always hit the network, never a cache.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
