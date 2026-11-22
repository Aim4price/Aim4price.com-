import { clearCachedHeaderSession } from './header-session-cache';

function clearLegacyPrototypeStorage() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem('aim4price-tractors-kit-register');
  window.localStorage.removeItem('aim4price-tractors-kit-marketplace');
}

export async function closeWebsiteSession() {
  await fetch('/api/admin/users', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'close_account' }),
  }).catch(() => null);

  let signOutResponse: Response | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    signOutResponse = await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }).catch(() => null);

    if (signOutResponse?.ok) break;
  }

  if (!signOutResponse?.ok) {
    throw new Error('The website session did not close.');
  }

  const verificationResponse = await fetch('/api/me?scope=website', {
    credentials: 'include',
    cache: 'no-store',
  });
  const verification = (await verificationResponse.json().catch(() => null)) as {
    signedIn?: boolean;
  } | null;

  if (!verificationResponse.ok || verification?.signedIn !== false) {
    throw new Error('The website session is still active.');
  }

  clearLegacyPrototypeStorage();
  clearCachedHeaderSession();
}
