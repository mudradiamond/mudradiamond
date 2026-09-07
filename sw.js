/* Mudra Diamond — service worker
   Caches the app shell so the app opens even with no internet.
   Supabase API calls are never cached (always live). */

const CACHE = 'mudra-v5.0.0';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css?v=5.0.0',
  './js/seed-users.js?v=5.0.0',
  './js/auth.js?v=5.0.0',
  './js/sync.js?v=5.0.0',
  './js/app.js?v=5.0.0',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                               .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // never cache the database API — it must always be live
  if (url.pathname.indexOf('/rest/v1/') !== -1 || url.pathname.indexOf('/auth/v1/') !== -1) return;
  if (url.origin !== self.location.origin) return;

  // app shell: serve from cache first, refresh in background
  e.respondWith(
    caches.match(req).then(function (hit) {
      const net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
