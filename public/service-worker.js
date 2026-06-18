// service-worker.js
const CACHE_NAME = 'nails-by-sally-v1';
const urlsToCache = [
  '/appointments.html',
  '/AdminLogin.html',
  '/sffsfs.png',
  // Add other static assets here
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request).then(fetchResponse => {
          // Don't cache API calls
          if (event.request.url.includes('/api/')) {
            return fetchResponse;
          }
          
          // Cache other responses
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
      .catch(() => {
        // Return offline page if available
        if (event.request.mode === 'navigate') {
          return caches.match('/appointments.html');
        }
      })
  );
});

// Push notification event
self.addEventListener('push', event => {
  console.log('[SW] Push notification received', event);
  
  let data = {
    title: '💅 Nails By Sally',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'default-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: '/appointments.html',
      timestamp: Date.now()
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = {
        title: pushData.title || data.title,
        body: pushData.body || data.body,
        icon: pushData.icon || data.icon,
        badge: pushData.badge || data.badge,
        tag: pushData.tag || data.tag,
        requireInteraction: pushData.requireInteraction !== undefined ? pushData.requireInteraction : data.requireInteraction,
        vibrate: pushData.vibrate || data.vibrate,
        data: {
          ...data.data,
          ...pushData.data,
          type: pushData.data?.type || 'default',
          appointmentId: pushData.data?.appointmentId
        }
      };
      
      console.log('[SW] Parsed notification:', {
        title: data.title,
        type: data.data.type,
        appointmentId: data.data.appointmentId
      });
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }

  const promiseChain = self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    requireInteraction: data.requireInteraction,
    vibrate: data.vibrate,
    data: data.data
  });

  event.waitUntil(promiseChain);
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/appointments.html';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if there's already a window open
      for (let client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync event (optional - for offline appointment creation)
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event);
  
  if (event.tag === 'sync-appointments') {
    event.waitUntil(
      // Sync logic here if needed
      Promise.resolve()
    );
  }
});

// Message event - communicate with clients
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});