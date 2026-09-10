/* Shared delivery only; each installed worker owns a separate scope and subscription. */
const PUSH_ROOTS = { owner: '/owner-app', dealer: '/dealer', middleman: '/middleman', field: '/field-manager' };
const PUSH_ICONS = { owner: '/owner-app-icon-192.png', dealer: '/dealer-icon-192-dark.png', middleman: '/middleman-icon-192.png', field: '/field-manager-icon.png' };
function scopedPushUrl(value) {
  const root = PUSH_ROOTS[PUSH_APP];
  const url = new URL(typeof value === 'string' ? value : root + '/notifications', self.location.origin);
  return url.origin === self.location.origin && (url.pathname === root || url.pathname.startsWith(root + '/'))
    ? url.href : self.location.origin + root + '/notifications';
}
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data.json(); } catch { return; }
    if (!payload || typeof payload.deviceId !== 'string') return;
    // Check live access and the device binding before showing private content.
    try {
      const response = await fetch('/api/app-notifications/delivery', { credentials: 'include', cache: 'no-store', headers: { 'x-aim4price-client-realm': PUSH_APP } });
      if (!response.ok) return;
      const state = await response.json();
      if (!state.enabled || state.deviceId !== payload.deviceId || state.app !== PUSH_APP) return;
      if (payload.category && (!state.categories.includes(payload.category) || !state.preferences[payload.category])) return;
    } catch { return; }
    await self.registration.showNotification(String(payload.title || 'Aim4price').slice(0,140), {
      body: String(payload.body || '').slice(0,500), icon: PUSH_ICONS[PUSH_APP],
      tag: String(payload.tag || PUSH_APP).slice(0,240), data: { href: scopedPushUrl(payload.href) },
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(scopedPushUrl(event.notification.data?.href)));
});
