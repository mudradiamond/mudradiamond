/* Mudra Diamond — service worker
   Caches the app shell so the app opens even with no internet.
   Supabase API calls are never cached (always live). */

const CACHE = 'mudra-v5.1.1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css?v=5.1.1',
  './js/cloud-config.js?v=5.1.1',
  './js/seed-users.js?v=5.1.1',
  './js/auth.js?v=5.1.1',
  './js/sync.js?v=5.1.1',
  './js/app.js?v=5.1.1',
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

  // The page itself is network-first: it carries the ?v= links to everything
  // else, so a fresh copy is what makes an update actually reach the user.
  // Falls back to cache the moment the network fails.
  if (req.mode === 'navigate' || url.pathname.endsWith('/') ||
      url.pathname.endsWith('/index.html')) {
    e.respondWith(
      // cache:'reload' skips the browser's HTTP cache. GitHub Pages serves the
      // page with max-age=600, and a plain fetch() here is answered from that
      // cache — so a pushed fix could sit invisible for ten minutes even though
      // this handler is network-first. The ?v= links inside the page cover the
      // rest, so only the page itself needs this.
      fetch(req.url, { cache: 'reload', credentials: 'same-origin' }).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // everything else: cache first, refresh in background
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
