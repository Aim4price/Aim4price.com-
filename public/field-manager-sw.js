/* Cache only the public offline shell. Private account data is encrypted in IndexedDB by the unlocked app. */
const SHELL_CACHE = 'aim4price-field-offline-shell-v2';
const SHELL_URL = '/field-manager/offline.html';
const SHELL_FILES = [SHELL_URL, '/field-manager/offline.css', '/field-manager/montserrat-latin.woff', '/field-manager/offline.mjs', '/field-manager/offline-store.mjs'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('aim4price-field-offline-shell-') && key !== SHELL_CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(url.pathname, { cacheName: SHELL_CACHE });
      return cached || fetch(event.request);
    })());
  } else if (event.request.mode === 'navigate' && (url.pathname === '/field-manager' || url.pathname.startsWith('/field-manager/'))) {
    event.respondWith(fetch(event.request).catch(async () => {
      const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
      return cached || new Response('Connect once to prepare offline work.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }));
  }
});

const PUSH_APP = 'field';
importScripts('/app-push-worker.js');
