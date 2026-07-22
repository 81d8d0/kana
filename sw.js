const CACHE_VERSION = '26.7.23';
const CACHE_NAME = `kana-${CACHE_VERSION}`;
const FONT_CACHE_NAME = `kana-fonts-${CACHE_VERSION}`;
const CORE_ASSETS = [
    './',
    './index.html',
    './line.html',
    './manifest.json',
    './icon.png',
    './icon-192.png',
    './mode.svg',
    './mic.jpg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(`[SW] Caching core resources (${CACHE_VERSION})`);
            return cache.addAll(CORE_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName.startsWith('kana-') && cacheName !== CACHE_NAME && cacheName !== FONT_CACHE_NAME) {
                        console.log('[SW] Removing expired caches:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.open(FONT_CACHE_NAME).then((cache) =>
                cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    return fetch(event.request).then((response) => {
                        cache.put(event.request, response.clone());
                        return response;
                    }).catch(() => cachedResponse);
                })
            )
        );
        return;
    }

    if (event.request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                
                return response;
            });
        })
    );
});
