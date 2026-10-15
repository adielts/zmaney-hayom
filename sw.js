/**
 * Service Worker for Zmaney HaYom PWA
 * Enables offline functionality and caching
 */

const CACHE_NAME = 'zmaney-hayom-v6';
const STATIC_CACHE = 'static-v6';

// Files to cache for offline use
const STATIC_FILES = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/api.js',
    '/js/location.js',
    '/js/geocoding.js',
    '/js/settings.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[ServiceWorker] Caching static files');
                // `reload` bypasses the browser HTTP cache so a new worker never
                // pre-caches the files of the previous version
                return cache.addAll(
                    STATIC_FILES.map((file) => new Request(file, { cache: 'reload' }))
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Install complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[ServiceWorker] Install failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
                            console.log('[ServiceWorker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Activate complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // For API requests (Hebcal), use network-first strategy
    if (url.hostname === 'www.hebcal.com' || url.hostname === 'nominatim.openstreetmap.org') {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // The app shell (page, styles, scripts, manifest) is served network-first so
    // a new deployment shows up on the very next launch instead of being pinned
    // to whatever was cached first; the cache is only the offline fallback
    if (url.origin === self.location.origin && isAppShell(request, url)) {
        event.respondWith(shellNetworkFirst(request));
        return;
    }
    
    // For other static assets (icons, images, fonts), use cache-first strategy
    event.respondWith(cacheFirst(request));
});

/**
 * Is this request part of the app shell (markup, styles, scripts, manifest)?
 * @param {Request} request
 * @param {URL} url
 * @returns {boolean}
 */
function isAppShell(request, url) {
    return request.mode === 'navigate' ||
        /\.(?:html|css|js|json)$/.test(url.pathname) ||
        url.pathname === '/';
}

/**
 * Network-first strategy for the app shell
 * Fresh copy when online, cached copy (or the cached page) when offline
 */
async function shellNetworkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[ServiceWorker] Network failed, serving shell from cache:', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const offlineResponse = await caches.match('/index.html');
        if (offlineResponse) {
            return offlineResponse;
        }
        
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Cache-first strategy
 * Try cache, fallback to network
 */
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[ServiceWorker] Cache-first failed:', error);
        
        // Return offline page if available
        const offlineResponse = await caches.match('/index.html');
        if (offlineResponse) {
            return offlineResponse;
        }
        
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Network-first strategy
 * Try network, fallback to cache
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[ServiceWorker] Network failed, trying cache:', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
