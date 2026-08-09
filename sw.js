// ============================================================
// 旅行助手 - Service Worker
// Security: Caches map tiles (autonavi.com) + PWA manifest/icons only
// Never caches API responses or cross-origin scripts
// ============================================================

const CACHE = 'travel-assistant-v2';
const PRECACHE_URLS = [
  './manifest.json',
  './lib/icon-192.png',
  './lib/icon-512.png',
  './lib/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  // Pre-cache PWA manifest and icons for offline installability
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  // Clean up old cache versions
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // Cache-first for PWA manifest and icons (pre-cached on install)
  if (PRECACHE_URLS.some(u => url.endsWith(u.replace('./', '/')))) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // Only intercept map tile requests for caching; pass through everything else
  if (!url.includes('autonavi.com')) {
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
