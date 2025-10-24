// Service Worker for GlowWorm Application
// Version 1.0.0

const CACHE_NAME = 'glowworm-v1.0.0';
const STATIC_CACHE = 'glowworm-static-v1.0.0';
const DYNAMIC_CACHE = 'glowworm-dynamic-v1.0.0';
const IMAGE_CACHE = 'glowworm-images-v1.0.0';

// Assets to precache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/css/main.css',
  '/static/js/main.js',
  '/static/js/vendor.js',
  '/static/media/logo.svg',
  '/static/media/favicon.ico',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Static assets - cache first
  static: {
    test: /\.(js|css|woff2?|ttf|eot|svg)$/,
    strategy: 'cacheFirst',
    maxAge: 31536000, // 1 year
  },
  // Images - cache first with fallback
  images: {
    test: /\.(jpg|jpeg|png|gif|webp|avif)$/,
    strategy: 'cacheFirst',
    maxAge: 2592000, // 30 days
  },
  // API responses - network first with cache fallback
  api: {
    test: /\/api\//,
    strategy: 'networkFirst',
    maxAge: 300, // 5 minutes
  },
  // HTML pages - network first
  html: {
    test: /\.html$/,
    strategy: 'networkFirst',
    maxAge: 3600, // 1 hour
  },
};

// Install event - precache critical assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Precaching static assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('glowworm-') && 
                     cacheName !== CACHE_NAME &&
                     cacheName !== STATIC_CACHE &&
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName !== IMAGE_CACHE;
            })
            .map((cacheName) => {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Determine cache strategy based on request type
  const strategy = getCacheStrategy(request);
  
  event.respondWith(
    handleRequest(request, strategy)
  );
});

// Get cache strategy for request
function getCacheStrategy(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // API requests
  if (pathname.startsWith('/api/')) {
    return CACHE_STRATEGIES.api;
  }
  
  // HTML pages
  if (pathname.endsWith('.html') || pathname === '/') {
    return CACHE_STRATEGIES.html;
  }
  
  // Images
  if (CACHE_STRATEGIES.images.test.test(pathname)) {
    return CACHE_STRATEGIES.images;
  }
  
  // Static assets
  if (CACHE_STRATEGIES.static.test.test(pathname)) {
    return CACHE_STRATEGIES.static;
  }
  
  // Default to network first
  return {
    strategy: 'networkFirst',
    maxAge: 3600,
  };
}

// Handle request with appropriate strategy
async function handleRequest(request, strategy) {
  const cacheName = getCacheName(strategy);
  
  try {
    switch (strategy.strategy) {
      case 'cacheFirst':
        return await cacheFirst(request, cacheName, strategy.maxAge);
      case 'networkFirst':
        return await networkFirst(request, cacheName, strategy.maxAge);
      case 'networkOnly':
        return await fetch(request);
      case 'cacheOnly':
        return await caches.match(request);
      default:
        return await networkFirst(request, cacheName, strategy.maxAge);
    }
  } catch (error) {
    console.error('Service Worker: Request failed', error);
    
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || 
             new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
    
    // Return error response for other requests
    return new Response('Network Error', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Cache first strategy
async function cacheFirst(request, cacheName, maxAge) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Check if cache is still valid
    if (isCacheValid(cachedResponse, maxAge)) {
      return cachedResponse;
    }
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return cached response if available, even if stale
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Network first strategy
async function networkFirst(request, cacheName, maxAge) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Get cache name for strategy
function getCacheName(strategy) {
  if (strategy.test && strategy.test.test('image')) {
    return IMAGE_CACHE;
  }
  
  if (strategy.test && strategy.test.test('static')) {
    return STATIC_CACHE;
  }
  
  return DYNAMIC_CACHE;
}

// Check if cache is still valid
function isCacheValid(response, maxAge) {
  const cacheDate = response.headers.get('sw-cache-date');
  if (!cacheDate) return false;
  
  const age = Date.now() - parseInt(cacheDate);
  return age < maxAge;
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Handle background sync
async function doBackgroundSync() {
  try {
    // Sync offline actions when connection is restored
    console.log('Service Worker: Performing background sync');
    
    // This would typically sync offline uploads, form submissions, etc.
    // Implementation depends on specific offline functionality
    
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from GlowWorm',
    icon: '/static/media/icon-192x192.png',
    badge: '/static/media/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/static/media/checkmark.png',
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/static/media/xmark.png',
      },
    ],
  };
  
  event.waitUntil(
    self.registration.showNotification('GlowWorm', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
