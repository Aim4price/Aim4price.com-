/** Keep website report requests unambiguous when app sessions also exist. */
export async function downloadAssetMapReport(href: string, format: 'pdf' | 'xlsx'): Promise<void> {
  // Claim the print tab during the click, before awaiting the authenticated fetch.
  const reportWindow = format === 'pdf' ? window.open('', '_blank') : null;
  if (format === 'pdf' && !reportWindow) {
    throw new Error('Please allow pop-ups to open the report.');
  }
  if (reportWindow) {
    reportWindow.opener = null;
    reportWindow.document.title = 'Preparing Asset Map report…';
    reportWindow.document.body.textContent = 'Preparing your report…';
  }

  try {
    const response = await fetch(href, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'x-aim4price-client-realm': 'website' },
    });
    if (!response.ok) {
      throw new Error(response.status === 401
        ? 'Your session has expired. Please sign in again, then download the report.'
        : 'Unable to prepare the report. Please try again.');
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (format === 'pdf') {
      if (!contentType.includes('text/html')) throw new Error('The report could not be prepared. Please try again.');
      const html = await response.text();
      if (!reportWindow || reportWindow.closed) return;
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
    } else {
      if (!contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        throw new Error('The spreadsheet could not be prepared. Please try again.');
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      const disposition = response.headers.get('content-disposition') ?? '';
      link.href = blobUrl;
      link.download = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'asset-map.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    }
  } catch (error) {
    reportWindow?.close();
    throw error;
  }
}
