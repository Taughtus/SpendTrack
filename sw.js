/*
  ===================================================================
  SERVICE WORKER  -  the bit that makes the app work offline
  ===================================================================
  A service worker is a small JS file that the browser runs in the
  background, separately from the page. Its job here is simple:

    1. On install, fetch the app's files and stash them in a cache.
    2. Every time the page asks for something, check the cache first;
       only go to the network if the cache doesn't have it.

  Bump CACHE_VERSION when you change any of the app files - this
  retires the old cache so the user gets the new version.
  ===================================================================
*/

const CACHE_VERSION = 'sst-v2';

/* The files the app needs to run. External CDN scripts (Chart.js,
   SheetJS) are fetched fresh from the network when online, then
   cached by the browser; if offline they'll come from the runtime
   cache populated below. */
const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './icon-180.png'
];

/* When the worker installs, grab everything in APP_FILES */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(APP_FILES);
    })
  );
  self.skipWaiting();   // activate immediately on first install
});

/* When a new version activates, delete any old caches */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (name !== CACHE_VERSION) return caches.delete(name);
      }));
    })
  );
  self.clients.claim();
});

/* For every network request the page makes, try the cache first.
   Fall back to the network. Cache any new successful responses. */
self.addEventListener('fetch', function (event) {
  // We only handle GETs; everything else (POST, etc) is unusual
  // here but should pass straight through.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        // Don't cache failures or opaque cross-origin responses
        if (!response || response.status !== 200) return response;

        const copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) {
          cache.put(event.request, copy);
        });
        return response;
      }).catch(function () {
        // Truly offline and nothing cached - show the page shell so
        // the app still loads. localStorage data is unaffected.
        return caches.match('./index.html');
      });
    })
  );
});
