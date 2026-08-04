// PhantomPad Controller - Service Worker (Network-First with offline fallback)
const CACHE_NAME = 'phantompad-controller-v1';
const ASSETS_TO_CACHE = [
  '/controller/',
  '/controller/index.html',
  '/controller/css/controller.css',
  '/controller/js/utils.js',
  '/controller/js/controller.js',
  '/controller/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Skip non-GET and socket.io requests
  if (e.request.method !== 'GET' || e.request.url.includes('/socket.io/')) {
    return;
  }

  // Network-first strategy: try network, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Cache successful responses for offline use
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
