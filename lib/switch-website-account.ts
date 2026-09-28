import { clearCachedHeaderSession } from './header-session-cache';

/** Close only the website session before displaying another account's login form. */
export async function switchWebsiteAccount(): Promise<void> {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST', credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!response.ok) throw new Error('Could not sign out. Please try again.');

  // /api/me hides blocked accounts, so it cannot verify that their session ended.
  const check = await fetch('/api/auth/get-session', { credentials: 'include', cache: 'no-store' });
  if (!check.ok) throw new Error('Could not confirm sign-out. Please try again.');
  const session: unknown = await check.json();
  if (session !== null) throw new Error('Your session is still open. Please try again.');
  clearCachedHeaderSession();
  window.location.replace('/auth#login');
}
