self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      } catch (err) {
        // Ignore cache deletion errors so activation completes.
      }

      try {
        await self.registration.unregister();
      } catch (err) {
        // Ignore unregister errors; browser will eventually clean up.
      }
    })()
  );
});
