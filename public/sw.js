// BEEP AI Service Worker — push notifications only.
// IMPORTANT: no app-shell caching. Caching index.html/JS caused stale
// "white screen" after every deploy. The browser always goes to network now.
// Bump SW_BUILD on deploy to force every client's SW to re-activate and nuke
// any caches left by an older (caching) service-worker version.
const SW_BUILD = '2026-07-01-offir-v9';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Nuke any caches left by older service-worker versions
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// No 'fetch' handler on purpose → every request hits the network (always fresh).

// ── Push notification handler ──
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
