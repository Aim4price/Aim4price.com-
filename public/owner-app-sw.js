/* Network-only service worker for the isolated Aim4price Owner PWA. */
const OWNER_APP_ROOT = '/owner-app';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  const isOwnerAppPath = requestUrl.pathname === OWNER_APP_ROOT
    || requestUrl.pathname.startsWith(`${OWNER_APP_ROOT}/`);
  if (!isOwnerAppPath) return;
  event.respondWith(fetch(event.request));
});


const PUSH_APP = 'owner';
importScripts('/app-push-worker.js');
