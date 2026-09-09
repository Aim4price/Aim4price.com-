// Runs in the document head before hydration, including effects in shared clients.
// Derive the context on every request so navigation never leaves a stale app identity.
export const APP_REQUEST_CONTEXT_SCRIPT = String.raw`(() => {
  if (window.__aim4priceRequestContext) return;
  window.__aim4priceRequestContext = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input, init);
    const path = window.location.pathname;
    const roots = { dealer: '/dealer', middleman: '/middleman', owner: '/owner-app', field: '/field-manager' };
    const realm = Object.keys(roots).find(key => path === roots[key] || path.startsWith(roots[key] + '/')) || 'website';
    const headers = new Headers(init && init.headers !== undefined ? init.headers : input instanceof Request ? input.headers : undefined);
    headers.set('x-aim4price-client-realm', realm);
    return originalFetch(input, Object.assign({}, init, { headers, cache: 'no-store' }));
  };
})();`;
