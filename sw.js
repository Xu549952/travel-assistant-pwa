// ============================================================
// 旅行助手 - Service Worker
// Security: Only caches map tiles (autonavi.com), never API responses or scripts
// ============================================================

const CACHE = 'travel-assistant-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Only intercept map tile requests for caching; pass through everything else
  if (!e.request.url.includes('autonavi.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
