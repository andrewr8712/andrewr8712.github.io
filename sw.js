// EtherDash Service Worker - Offline Caching

const CACHE_NAME = 'etherdash-v5.0';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install: Cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(err => {
                console.error('[SW] Cache install failed:', err);
            })
    );
    self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network-first for API, cache-first for static
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip WebSocket requests
    if (url.protocol === 'wss:' || url.protocol === 'ws:') {
        return;
    }

    // Network-first for API requests
    if (url.hostname.includes('coingecko.com') ||
        url.hostname.includes('binance.com') ||
        url.hostname.includes('etherscan.io') ||
        url.hostname.includes('alternative.me')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for static assets
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;

                return fetch(event.request)
                    .then(response => {
                        // Cache valid responses
                        if (response.ok && response.type === 'basic') {
                            const clone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(event.request, clone));
                        }
                        return response;
                    });
            })
    );
});

// Background sync for offline actions (future)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-portfolio') {
        console.log('[SW] Syncing portfolio data');
    }
});

// Push notifications support (future)
self.addEventListener('push', event => {
    const data = event.data?.json() || {};

    event.waitUntil(
        self.registration.showNotification(data.title || 'EtherDash Alert', {
            body: data.body || 'Price alert triggered!',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            vibrate: [200, 100, 200]
        })
    );
});
