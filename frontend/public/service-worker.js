const STATIC_CACHE = 'circuits-static-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {
        // Ignore install errors so the service worker can still activate.
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)))
      )
      .catch(() => {
        // Ignore cache cleanup errors.
      })
  );
  self.clients.claim();
});

const ASSET_DESTINATIONS = new Set(['script', 'style', 'font', 'image']);
const FALLBACK_PAGES = ['/index.html', '/'];
const OFFLINE_RESPONSE = new Response('Service unavailable while offline.', {
  status: 503,
  statusText: 'Offline',
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
  },
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Allow local backend requests or other origins to pass through untouched.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Always go to the network for API traffic so the local backend is used.
  if (url.pathname.startsWith('/api')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(STATIC_CACHE)
            .then((cache) => {
              cache.put('/index.html', copy);
              cache.put('/', response.clone());
            })
            .catch(() => {
              // Ignore cache write errors.
            });
          return response;
        })
        .catch(async () => {
          for (const fallback of FALLBACK_PAGES) {
            const cached = await caches.match(fallback);
            if (cached) {
              return cached;
            }
          }
          return OFFLINE_RESPONSE;
        })
    );
    return;
  }

  if (!ASSET_DESTINATIONS.has(request.destination)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {
                // Ignore cache write errors.
              });
          }
          return response;
        })
        .catch(async () => {
          const cachedAsset = await caches.match(request);
          if (cachedAsset) {
            return cachedAsset;
          }
          for (const fallback of FALLBACK_PAGES) {
            const cached = await caches.match(fallback);
            if (cached) {
              return cached;
            }
          }
          return OFFLINE_RESPONSE;
        });
    })
  );
});
