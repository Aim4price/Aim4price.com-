/** Reuse the owner-authenticated report routes, scoped to the selected assets only. */
export const SHARE_REPORT_TYPES = [
  { key: 'maintenance', label: 'Maintenance', description: 'Services, repairs and check-ups' },
  { key: 'fuel', label: 'Fuel ledger', description: 'Fuel usage and consumption' },
  { key: 'depreciation', label: 'Depreciation log', description: 'Usage and value history' },
  { key: 'ownership', label: 'Cost of ownership', description: 'Recorded costs and VAT' },
] as const;
export type ShareReportKind = typeof SHARE_REPORT_TYPES[number]['key'];
export type ShareReportChoice = { kind: ShareReportKind; year: string; month: string; maintenanceType: string };
export function shareReportLabel(choice: ShareReportChoice) {
  const name = SHARE_REPORT_TYPES.find(type => type.key === choice.kind)?.label || 'Report';
  const period = choice.year === 'all' ? 'All time' : choice.month === 'all' ? choice.year : `${choice.year}-${choice.month.padStart(2, '0')}`;
  const type = choice.kind === 'maintenance' && choice.maintenanceType !== 'all' ? ` · ${choice.maintenanceType}` : '';
  return `${name} · ${period}${type}`;
}
export function shareReportUrl(assetId: string, choice: ShareReportChoice) {
  if (!/^[0-9a-f-]{36}$/i.test(assetId) || !SHARE_REPORT_TYPES.some(type => type.key === choice.kind)) throw Error('Choose a valid asset and report.');
  if (choice.year !== 'all' && !/^(20\d{2}|21\d{2}|2200)$/.test(choice.year)) throw Error('Choose a valid report year.');
  if (choice.month !== 'all' && !/^(?:[1-9]|1[012])$/.test(choice.month)) throw Error('Choose a valid report month.');
  if (!['all', 'checked', 'serviced', 'repaired'].includes(choice.maintenanceType)) throw Error('Choose a valid maintenance report type.');
  const params = new URLSearchParams({ assetId, format: 'pdf' });
  if (choice.year !== 'all') {
    params.set('year', choice.year);
    if (choice.month !== 'all') params.set('month', choice.month);
  }
  if (choice.kind !== 'ownership') params.set('report', choice.kind);
  if (choice.kind === 'maintenance') params.set('maintenanceType', choice.maintenanceType);
  return `${choice.kind === 'ownership' ? '/api/my-invoices/report' : '/api/asset-register/scan-report'}?${params}`;
}
export async function prepareShareReports(assetIds: string[], choices: ShareReportChoice[], signal?: AbortSignal): Promise<File[]> {
  if (!assetIds.length || !choices.length || choices.length > SHARE_REPORT_TYPES.length || new Set(choices.map(choice => choice.kind)).size !== choices.length) throw Error('Choose assets and at least one report.');
  const { PDFDocument } = await import('pdf-lib');
  const files: File[] = [];
  let total = 0;
  for (const choice of choices) {
    const combined = await PDFDocument.create();
    let sourceBytes = 0;
    for (const assetId of assetIds) {
      const response = await fetch(shareReportUrl(assetId, choice), { credentials: 'include', cache: 'no-store', signal });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
        const error = response.headers.get('content-type')?.includes('application/json') ? await response.json().catch(() => null) : null;
        throw Error(`Unable to prepare ${shareReportLabel(choice)}. ${typeof error?.error === 'string' ? error.error : 'Please try again or adjust your selection.'}`);
      }
      const bytes = await response.arrayBuffer();
      sourceBytes += bytes.byteLength;
      if (sourceBytes > 30 * 1024 * 1024) throw Error('Choose fewer assets or a shorter report timeline.');
      const pdf = await PDFDocument.load(bytes);
      for (const page of await combined.copyPages(pdf, pdf.getPageIndices())) combined.addPage(page);
    }
    const bytes = await combined.save();
    total += bytes.byteLength;
    if (bytes.byteLength > 8 * 1024 * 1024 || total > 30 * 1024 * 1024) throw Error('Choose fewer assets or a shorter report timeline. Reports must be under 8 MB each and 30 MB in total.');
    files.push(new File([bytes as BlobPart], `${shareReportLabel(choice).replace(/ · /g, ' - ')}.pdf`, { type: 'application/pdf' }));
  }
  return files;
}
