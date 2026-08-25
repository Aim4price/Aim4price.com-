/**
 * Opens a canonical HTML report while the user's click still owns the popup.
 * Opening a blank tab first avoids async popup blocking; the report route then
 * renders and invokes the browser's native Print / Save PDF flow.
 */
export function openCanonicalReportUrl(url: string): boolean {
  if (typeof window === 'undefined') return false;

  const reportWindow = window.open('', '_blank');
  if (!reportWindow) return false;

  reportWindow.opener = null;
  reportWindow.location.replace(url);
  return true;
}
