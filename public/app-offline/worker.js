/* Only public shell assets are cached. App data lives in the PIN-encrypted vault. */
const ROOT = ({ owner: '/owner-app', field: '/field-manager', dealer: '/dealer', middleman: '/middleman' })[OFFLINE_APP];
const SHELL_CACHE = 'aim4price-' + OFFLINE_APP + '-offline-shell-v5';
const SHELL_URL = ROOT + '/offline.html';
const SHELL_FILES = [SHELL_URL, '/app-theme.css', '/app-offline/offline.css', '/field-manager/montserrat-latin.woff', '/app-offline/offline.mjs', '/app-offline/store.mjs', '/app-offline/config.mjs'];
self.addEventListener('install', event => event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if ((key.startsWith('aim4price-' + OFFLINE_APP + '-offline-shell-') || (OFFLINE_APP === 'field' && key.startsWith('aim4price-field-offline-shell-'))) && key !== SHELL_CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (SHELL_FILES.includes(url.pathname)) event.respondWith(caches.match(url.pathname, { cacheName: SHELL_CACHE }).then(cached => cached || fetch(event.request)));
  else if (event.request.mode === 'navigate' && (url.pathname === ROOT || url.pathname.startsWith(ROOT + '/'))) event.respondWith(fetch(event.request).catch(async () => (await caches.match(SHELL_URL, { cacheName: SHELL_CACHE })) || new Response('Connect once to prepare offline work.', { status: 503 })));
});
