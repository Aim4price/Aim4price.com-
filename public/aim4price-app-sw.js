/* Aim4price owner app service worker.
 *
 * Owner pages contain private account information. The first app version is
 * intentionally online-first and does not persist authenticated pages or API
 * responses. This worker gives the owner app its own installable scope while
 * avoiding stale or shared-device data exposure.
 */

const OWNER_APP_SCOPE_PREFIX = '/app';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  const isOwnerAppRequest =
    requestUrl.pathname === OWNER_APP_SCOPE_PREFIX ||
    requestUrl.pathname.startsWith(`${OWNER_APP_SCOPE_PREFIX}/`);
  if (!isOwnerAppRequest) return;

  event.respondWith(fetch(event.request));
});
