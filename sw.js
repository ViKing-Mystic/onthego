const CACHE_NAME = 'onthego-v16-maps';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/security.js',
  './js/data.js',
  './js/migrations.js',
  './js/storage.js',
  './js/reliability.js',
  './js/sync_engine.js',
  './js/offline_vault.js',
  './js/collaboration.js',
  './js/reminders.js',
  './js/engine.js',
  './js/weather.js',
  './js/ai_adjustments.js',
  './js/journal.js',
  './js/reports.js',
  './js/budget.js',
  './js/assistant.js',
  './js/destination_catalogue.js',
  './js/itinerary.js',
  './js/map.js',
  './js/expenses.js',
  './js/backups.js',
  './js/restaurants.js',
  './js/checklist.js',
  './js/wallet.js',
  './js/timehelper.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Network-First with Cache Fallback for app assets to ensure deployed updates apply immediately
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
