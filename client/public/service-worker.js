// Service Worker for ScoutBridge Analytics PWA
// Handles offline support, caching, and background sync

const CACHE_NAME = 'scoutbridge-v1';
const API_CACHE_NAME = 'scoutbridge-api-v1';
const STATIC_CACHE_NAME = 'scoutbridge-static-v1';
const IMAGE_CACHE_NAME = 'scoutbridge-images-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/auth/me',
  '/api/subscription',
  '/api/notifications/preferences',
];

/**
 * Service Worker Install - Cache essential assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((error) => {
          console.error('Failed to cache static assets:', error);
        });
      }),
      // Cache API responses
      caches.open(API_CACHE_NAME),
      // Cache images
      caches.open(IMAGE_CACHE_NAME),
    ]).then(() => {
      self.skipWaiting();
    })
  );
});

/**
 * Service Worker Activate - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== STATIC_CACHE_NAME &&
            cacheName !== API_CACHE_NAME &&
            cacheName !== IMAGE_CACHE_NAME
          ) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

/**
 * Fetch Event - Handle offline and caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different request types
  if (request.method === 'GET') {
    if (url.pathname.startsWith('/api/')) {
      // API requests: network-first, fallback to cache
      event.respondWith(networkFirstStrategy(request, API_CACHE_NAME));
    } else if (url.pathname.startsWith('/uploads/')) {
      // Images/media: cache-first, fallback to network
      event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE_NAME));
    } else {
      // Static assets: network-first, fallback to cache
      event.respondWith(networkFirstStrategy(request, STATIC_CACHE_NAME));
    }
  } else {
    // Non-GET requests (POST, PATCH, etc) - try network, don't cache
    event.respondWith(fetch(request).catch(() => offlineResponse()));
  }
});

/**
 * Network-first caching strategy
 * Try network first, fallback to cache if offline
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok && cacheName) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // No cache, return offline response
    return offlineResponse();
  }
}

/**
 * Cache-first caching strategy
 * Try cache first, fallback to network if not cached
 */
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok && cacheName) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    return offlineResponse();
  }
}

/**
 * Return offline page response
 */
function offlineResponse() {
  return new Response(
    `<html>
      <head>
        <title>Offline - ScoutBridge Analytics</title>
        <style>
          * { margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .offline-container {
            text-align: center;
            background: white;
            padding: 3rem;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          }
          .offline-container h1 {
            color: #333;
            margin-bottom: 1rem;
          }
          .offline-container p {
            color: #666;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <h1>⚠️ You're Offline</h1>
          <p>ScoutBridge Analytics requires an internet connection.</p>
          <p>Please check your connection and try again.</p>
        </div>
      </body>
    </html>`,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

/**
 * Background Sync - Queue failed requests for retry
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-videos') {
    event.waitUntil(syncPendingRequests());
  }
});

/**
 * Sync pending requests when back online
 */
async function syncPendingRequests() {
  try {
    const db = await openDB();
    const pendingRequests = await db.getAll('pendingRequests');
    
    for (const request of pendingRequests) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        
        if (response.ok) {
          // Request succeeded, remove from pending
          await db.delete('pendingRequests', request.id);
          
          // Notify clients
          self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                requestId: request.id,
              });
            });
          });
        }
      } catch (error) {
        console.error('Failed to sync request:', error);
      }
    }
  } catch (error) {
    console.error('Error during background sync:', error);
  }
}

/**
 * Push notifications
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.message,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'notification',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  const clientUrl = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if window already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === clientUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if not already open
      if (clients.openWindow) {
        return clients.openWindow(clientUrl);
      }
    })
  );
});

/**
 * Helper to open IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('scoutbridge', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingRequests')) {
        db.createObjectStore('pendingRequests', { keyPath: 'id' });
      }
    };
  });
}
