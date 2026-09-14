import { appRealmForPath } from './app-realm.ts';

function reportUrl(value: string): URL {
  const url = new URL(value, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
    throw new Error('This report link is not available.');
  }
  return url;
}

async function fetchReport(url: URL): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(url.href, {
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
      headers: { 'x-aim4price-client-realm': appRealmForPath(window.location.pathname) ?? 'website' },
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Your session has expired. Sign in again in the original tab, then retry.');
      if (response.status === 403) throw new Error('This account does not have permission to open this report.');
      if (response.status === 404) throw new Error('This report or asset is no longer available.');
      throw new Error('Unable to prepare the report. Please try again.');
    }
    return response;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The report took too long to prepare. Please try again.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function showReportStatus(reportWindow: Window, message: string, retry?: () => void): void {
  if (reportWindow.closed) return;
  const doc = reportWindow.document;
  doc.title = retry ? 'Report unavailable' : 'Preparing report';
  doc.body.replaceChildren();
  doc.body.style.cssText = 'margin:0;padding:48px 24px;background:#edf4f0;color:#103f35;font:16px/1.5 "Segoe UI",sans-serif';
  const panel = doc.createElement('main');
  panel.style.cssText = 'max-width:640px;margin:auto;padding:28px;background:white;border:1px solid #b9d0c5;border-radius:10px';
  const heading = doc.createElement('h1');
  heading.style.cssText = 'margin:0 0 12px;font-size:24px';
  heading.textContent = retry ? 'Report unavailable' : 'Preparing your report';
  const text = doc.createElement('p');
  text.setAttribute('role', retry ? 'alert' : 'status');
  text.textContent = message;
  panel.append(heading, text);
  const addButton = (label: string, action: () => void) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = 'margin:8px 8px 0 0;padding:12px 20px;border:1px solid #b9d0c5;border-radius:24px;background:#103f35;color:#fff;cursor:pointer;font:inherit';
    button.onclick = action;
    panel.append(button);
  };
  if (retry) addButton('Retry', retry);
  addButton('Close', () => reportWindow.close());
  doc.body.append(panel);
}

/**
 * Claim the tab during the click, then fetch from the originating website/app.
 * A blank-tab navigation loses the realm header and can cause middleware to
 * strip ambiguous cookies. Never change server authentication to work around it.
 * The boolean reports popup availability; loading failures stay in the tab.
 */
export function openCanonicalReportUrl(url: string, preparedWindow?: Window): boolean {
  if (typeof window === 'undefined') return false;
  const target = reportUrl(url);
  const reportWindow = preparedWindow ?? window.open('', '_blank');
  if (!reportWindow) return false;
  reportWindow.opener = null;

  const prepare = async () => {
    showReportStatus(reportWindow, 'This may take a moment.');
    try {
      const response = await fetchReport(target);
      if (!response.headers.get('content-type')?.includes('text/html')) {
        throw new Error('The report could not be prepared. Please try again.');
      }
      const html = await response.text();
      if (reportWindow.closed) return;
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
      // Embedded Excel links must retain the originating session as well.
      reportWindow.document.addEventListener('click', (event) => {
        const anchor = (event.target as Element | null)?.closest?.('a');
        if (!anchor) return;
        const href = new URL(anchor.href, window.location.href);
        if (href.origin !== window.location.origin || !href.pathname.startsWith('/api/') || href.searchParams.get('format') !== 'xlsx') return;
        event.preventDefault();
        void downloadCanonicalReportFile(href.href).catch((error) => {
          reportWindow.alert(error instanceof Error ? error.message : 'Unable to download the spreadsheet.');
        });
      });
    } catch (error) {
      showReportStatus(reportWindow, error instanceof Error ? error.message : 'Unable to open the report.', () => { void prepare(); });
    }
  };
  void prepare();
  return true;
}

/** Download Excel through the same originating session, including Owner App. */
export async function downloadCanonicalReportFile(url: string): Promise<void> {
  const response = await fetchReport(reportUrl(url));
  if (!response.headers.get('content-type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    throw new Error('The spreadsheet could not be prepared. Please try again.');
  }
  const blobUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  const disposition = response.headers.get('content-disposition') ?? '';
  link.href = blobUrl;
  link.download = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'aim4price-report.xlsx';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
