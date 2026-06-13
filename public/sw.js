// BEEP AI Service Worker
const CACHE = 'beepai-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Push notification handler
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch { data = { title: '⚡ BEEP AI', body: e.data?.text() || 'התראה חדשה' }; }
  e.waitUntil(
    self.registration.showNotification(
      data.title || '⚡ BEEP AI',
      {
        body:    data.body || 'התראה חדשה',
        icon:    '/icon-192.png',
        badge:   '/icon-192.png',
        tag:     data.tag || 'beepai',
        vibrate: [400, 150, 400, 150, 600],
        data:    { url: data.data?.url || '/' },
        requireInteraction: true,
      }
    ).catch(err => console.error('[SW] showNotification failed:', err))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});
