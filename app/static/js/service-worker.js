const CACHE_NAME = "circuits-cache-v3";
const OFFLINE_URLS = [
  "/",
  "/static/css/style.css",
  "/static/js/pwa.js",
  "/static/js/app.js",
  "/static/js/components/task-editor.js",
  "/static/js/pages/home.js",
  "/static/js/pages/detail.js",
  "/static/js/pages/editor.js",
  "/static/js/pages/run.js",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => cachedResponse || fetch("/"));
    })
  );
});
