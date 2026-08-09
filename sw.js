// ============================================================
// 旅行助手 - Service Worker (v4)
// PWA: Pre-caches app shell for offline installability
// Capacitor: SW disabled in native WebView (see IS_CAPACITOR guard in HTML)
// Security: Never caches API responses or cross-origin scripts
// Strategy:
//   - App shell (HTML/CSS/JS/icons): cache-first (pre-cached on install)
//   - Map tiles (autonavi.com): stale-while-revalidate
//   - API requests & everything else: network-only (passthrough)
// ============================================================

const CACHE = 'travel-assistant-v4';

// App shell resources needed for offline loading
const PRECACHE_URLS = [
  './',
  './index.html',
  './travel-assistant.html',
  './manifest.json',
  './lib/dompurify-3.1.6.min.js',
  './lib/leaflet-1.9.4.min.js',
  './lib/leaflet-1.9.4.css',
  './lib/marked.min.js',
  './lib/notify.js',
  './lib/secure-store.js',
  './lib/file-export.js',
  './lib/icon-192.png',
  './lib/icon-512.png',
  './lib/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  // Pre-cache app shell for offline installability
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

  // Navigation requests: serve cached app shell when offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./travel-assistant.html'))
    );
    return;
  }

  // Cache-first for pre-cached app shell resources
  if (PRECACHE_URLS.some(u => url.endsWith(u.replace('./', '/')))) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // Stale-while-revalidate for map tiles only
  if (url.includes('autonavi.com')) {
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
    return;
  }

  // All other requests: passthrough (API, on-demand libs, etc.)
});
