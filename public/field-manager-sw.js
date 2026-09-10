/* Aim4price Field Manager App service worker.
 *
 * Field Manager pages contain authenticated, account-specific data, so this
 * worker does not persist page or API responses. It provides a dedicated app
 * scope and leaves all requests network-first to avoid exposing stale session
 * data.
 */

const FIELD_MANAGER_SCOPE_PREFIX = '/field-manager';

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
  if (!requestUrl.pathname.startsWith(FIELD_MANAGER_SCOPE_PREFIX)) return;

  event.respondWith(fetch(event.request));
});

const PUSH_APP = 'field';
importScripts('/app-push-worker.js');
