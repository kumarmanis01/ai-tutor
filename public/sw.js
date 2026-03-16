/**
 * Spinzy PWA Service Worker
 * Strategy: NetworkFirst with 10s timeout, fallback to cache.
 * Offline fallback document: /offline
 *
 * Generated statically (next-pwa webpack plugin is incompatible with Next.js 16 Turbopack).
 */

const CACHE_NAME = 'spinzy-cache-v1';
const OFFLINE_URL = '/offline';
const MAX_ENTRIES = 200;
const MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours
const NETWORK_TIMEOUT_MS = 10000;

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL])
    )
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch — NetworkFirst ──────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) requests
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Skip Next.js internals and API routes (always go to network)
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) return;

  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  // Race network against timeout
  try {
    const networkResponse = await Promise.race([
      fetch(request.clone()),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)
      ),
    ]);

    if (networkResponse.ok) {
      // Store in cache (evict old entries by count)
      const cloned = networkResponse.clone();
      cache.put(request, cloned).then(() => evictOldEntries(cache));
    }
    return networkResponse;
  } catch {
    // Network failed — try cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // Navigation request — serve offline page
    if (request.mode === 'navigate') {
      const offline = await cache.match(OFFLINE_URL);
      if (offline) return offline;
    }

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function evictOldEntries(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  // Delete oldest entries beyond MAX_ENTRIES
  const toDelete = keys.slice(0, keys.length - MAX_ENTRIES);
  await Promise.all(toDelete.map((k) => cache.delete(k)));
}

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = JSON.parse(event.data.text());
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-72.png',
      tag: data.tag,
      requireInteraction: data.requireInteraction || false,
      data: { url: data.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(event.notification.data.url));
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
