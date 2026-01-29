// EtherDash Service Worker - Offline Caching v5.1

const CACHE_NAME = 'etherdash-v5.1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
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

// Fetch: Optimized caching strategy
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip WebSocket and Chrome extension requests
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return;
    }

    // Network-first for API requests spanning multiple domains
    const isApiRequest = [
        'coingecko.com',
        'binance.com',
        'etherscan.io',
        'alternative.me',
        'exchangerate-api.com',
        'rss2json.com'
    ].some(domain => url.hostname.includes(domain));

    if (isApiRequest) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Update cache for successful API calls
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first (with revalidate) for static assets
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse.ok) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return networkResponse;
                });
                return cached || fetchPromise;
            })
    );
});
