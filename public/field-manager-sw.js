self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => { await self.clients.claim(); for (const client of await self.clients.matchAll({type:'window'})) if (new URL(client.url).pathname.startsWith('/field-manager')) client.navigate('/owner-app/login'); await self.registration.unregister(); })()));
