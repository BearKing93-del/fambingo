// FamBingo Service Worker v1.0
const CACHE_NAME = 'fambingo-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap'
];

// ── Install: cache core assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(['/index.html', '/manifest.json']);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fallback to network ──
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Cache successful GET responses for our own pages
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// ── Push: receive push notification from server (future) ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🎱 FamBingo — New Ball!';
  const options = {
    body: data.body || 'A new ball has been called!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'bingo-ball',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: open/focus the app ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// ── Background Sync: draw ball when connectivity returns ──
self.addEventListener('sync', event => {
  if (event.tag === 'draw-ball') {
    event.waitUntil(notifyClients('DRAW_BALL'));
  }
});

// ── Message relay to clients ──
async function notifyClients(type) {
  const clientList = await clients.matchAll({ type: 'window' });
  clientList.forEach(client => client.postMessage({ type }));
}

// ── Periodic background check ──
// When the app sends us a scheduled alarm via postMessage,
// we fire the notification at the right time.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { ball, delayMs } = event.data;
    setTimeout(() => {
      self.registration.showNotification('🎱 FamBingo — New Ball!', {
        body: `${ball.letter}${ball.number} was just called! Check your card.`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'bingo-ball',
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: '/' }
      });
    }, delayMs);
  }
});
