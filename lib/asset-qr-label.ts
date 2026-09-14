import { appRealmForPath } from './app-realm';

/** Fetch in the active session before displaying the printable label. */
export async function openAssetQrLabel(url: string): Promise<void> {
  const labelWindow = window.open('', '_blank');
  if (!labelWindow) throw new Error('Please allow pop-ups to open the QR label.');
  labelWindow.opener = null;
  labelWindow.document.title = 'Preparing QR label…';
  labelWindow.document.body.textContent = 'Preparing your QR label…';
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'x-aim4price-client-realm': appRealmForPath(window.location.pathname) ?? 'website' },
    });
    if (!response.ok) {
      let message = response.status === 401
        ? 'Your session has expired. Please sign in again to open the QR label.'
        : 'Unable to prepare the QR label. Please try again.';
      if (response.status !== 401) {
        const data = await response.json().catch(() => null);
        if (typeof data?.error === 'string') message = data.error;
      }
      throw new Error(message);
    }
    if (!response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('The QR label could not be prepared. Please try again.');
    }
    const html = await response.text();
    if (labelWindow.closed) return;
    labelWindow.document.open();
    labelWindow.document.write(html);
    labelWindow.document.close();
  } catch (error) {
    labelWindow.close();
    throw error;
  }
}
