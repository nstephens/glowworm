/**
 * Service Worker for Glowworm - Content Caching and Offline Support
 * Version: 1.0.0
 */

const CACHE_NAME = 'glowworm-cache-v1';
const STATIC_CACHE_NAME = 'glowworm-static-v1';
const DYNAMIC_CACHE_NAME = 'glowworm-dynamic-v1';
const IMAGE_CACHE_NAME = 'glowworm-images-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  // Add other critical static assets
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/images/,
  /\/api\/albums/,
  /\/api\/playlists/,
  /\/api\/devices/,
  /\/api\/settings/,
];

// Image patterns to cache
const IMAGE_CACHE_PATTERNS = [
  /\.(jpg|jpeg|png|gif|webp|avif)$/i,
  /\/images\//,
  /\/thumbnails\//,
];

// Cache size limits
const CACHE_SIZE_LIMITS = {
  [STATIC_CACHE_NAME]: 50 * 1024 * 1024, // 50MB
  [DYNAMIC_CACHE_NAME]: 100 * 1024 * 1024, // 100MB
  [IMAGE_CACHE_NAME]: 500 * 1024 * 1024, // 500MB
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting(),
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!Object.values(CACHE_SIZE_LIMITS).includes(cacheName)) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim(),
    ])
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
  
  event.respondWith(handleRequest(request));
});

// Handle different types of requests with appropriate caching strategies
async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Static assets - Cache First strategy
    if (isStaticAsset(url)) {
      return await cacheFirst(request, STATIC_CACHE_NAME);
    }
    
    // Images - Cache First with fallback
    if (isImageRequest(url)) {
      return await cacheFirst(request, IMAGE_CACHE_NAME);
    }
    
    // API requests - Network First with cache fallback
    if (isApiRequest(url)) {
      return await networkFirst(request, DYNAMIC_CACHE_NAME);
    }
    
    // Other requests - Stale While Revalidate
    return await staleWhileRevalidate(request, DYNAMIC_CACHE_NAME);
    
  } catch (error) {
    console.error('Service Worker: Error handling request:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return await caches.match('/offline.html') || new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    }
    
    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Cache First strategy - check cache first, fallback to network
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

// Network First strategy - try network first, fallback to cache
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Stale While Revalidate strategy - return cache immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Update cache in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });
  
  // Return cached version immediately if available
  return cachedResponse || fetchPromise;
}

// Check if request is for static assets
function isStaticAsset(url) {
  return STATIC_ASSETS.includes(url.pathname) ||
         url.pathname.startsWith('/static/') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.woff2') ||
         url.pathname.endsWith('.woff') ||
         url.pathname.endsWith('.ttf');
}

// Check if request is for images
function isImageRequest(url) {
  return IMAGE_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// Check if request is for API
function isApiRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered');
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Handle background sync
async function doBackgroundSync() {
  try {
    // Get pending actions from IndexedDB
    const pendingActions = await getPendingActions();
    
    for (const action of pendingActions) {
      try {
        await processPendingAction(action);
        await removePendingAction(action.id);
      } catch (error) {
        console.error('Service Worker: Failed to process pending action:', error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/icon-192x192.png',
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192x192.png',
      },
    ],
  };
  
  event.waitUntil(
    self.registration.showNotification('Glowworm', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Cache management utilities
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const validCacheNames = Object.keys(CACHE_SIZE_LIMITS);
  
  const deletePromises = cacheNames
    .filter(cacheName => !validCacheNames.includes(cacheName))
    .map(cacheName => caches.delete(cacheName));
  
  await Promise.all(deletePromises);
}

// Monitor cache size and clean up if needed
async function monitorCacheSize() {
  for (const [cacheName, sizeLimit] of Object.entries(CACHE_SIZE_LIMITS)) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    // Simple size estimation (in practice, you'd want more accurate measurement)
    const estimatedSize = keys.length * 100 * 1024; // Rough estimate
    
    if (estimatedSize > sizeLimit) {
      console.log(`Service Worker: Cache ${cacheName} exceeds size limit, cleaning up...`);
      await cleanupCache(cacheName);
    }
  }
}

// Clean up cache by removing oldest entries
async function cleanupCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  // Remove oldest 25% of entries
  const keysToDelete = keys.slice(0, Math.floor(keys.length * 0.25));
  
  await Promise.all(
    keysToDelete.map(key => cache.delete(key))
  );
}

// Placeholder functions for IndexedDB operations
async function getPendingActions() {
  // This would interact with IndexedDB to get pending actions
  return [];
}

async function processPendingAction(action) {
  // This would process the pending action (e.g., upload image, create album)
  console.log('Processing pending action:', action);
}

async function removePendingAction(actionId) {
  // This would remove the processed action from IndexedDB
  console.log('Removing pending action:', actionId);
}

// Periodic cleanup
setInterval(monitorCacheSize, 5 * 60 * 1000); // Every 5 minutes







