import { getAssetRegisterReportLogoUrl } from '../../../../../lib/asset-registers';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { resolveReportLogoUrlForHtml } from '../../../../../lib/report-logo';
import { NextResponse } from 'next/server';
import { parseFuelSlipReportFilters, selectFuelSlipsForReport } from '../../../../../lib/fuel-slip-report-selection';
import { listFuelLedger, listFuelSlipsForReport } from '../../../../../lib/fuel-ledger';
import { filterFuelLedgerForWorkspace, resolveOwnerWorkspaceContext } from '../../../../../lib/owner-workspace-access';
import { buildFuelSlipReportHtml, buildFuelSlipWorkbook } from '../../../../../lib/fuel-slip-export';
import { renderReportHtmlToPdf } from '../../../../../lib/report-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  let payload: { format?: unknown; ids?: unknown; filters?: unknown };
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid export request.' }, { status: 400 });
  }
  const filters = parseFuelSlipReportFilters(payload?.filters);
  const idsValid = Array.isArray(payload?.ids) && payload.ids.length > 0 && payload.ids.length <= 10000 && payload.ids.every(id=>typeof id === 'string');
  if (!payload || !['pdf', 'xlsx'].includes(String(payload.format)) || (payload.filters !== undefined ? !filters : !idsValid)) {
    return NextResponse.json({ error: 'Choose a valid report scope, timeline and format.' }, { status: 400 });
  }
  try {
    const workspace = resolved.context;
    const [baseLedger, allSlips] = await Promise.all([listFuelLedger(workspace.ownerUserId), listFuelSlipsForReport(workspace.ownerUserId)]);
    const ledger = await filterFuelLedgerForWorkspace(workspace, { ...baseLedger, recentFuelSlips: allSlips });
    if (filters?.assetId !== undefined && filters.assetId !== 'all' && !ledger.assets.some(asset=>asset.id === filters.assetId)) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
    }
    const ids = new Set(Array.isArray(payload.ids) ? payload.ids as string[] : []);
    const slips = filters ? selectFuelSlipsForReport(ledger.recentFuelSlips, filters) : ledger.recentFuelSlips.filter((slip) => ids.has(slip.id));
    // Never trust client records or silently export a partial/stale selection.
    if (!filters && slips.length !== ids.size) return NextResponse.json({ error: 'Some selected slips are no longer available. Refresh and try again.' }, { status: 409 });
    if (!slips.length) return NextResponse.json({ error: 'No fuel slips match this asset and timeline.' }, { status: 404 });
    const profile = payload.format === 'pdf' ? await getAccountProfile({ id: workspace.ownerUserId }) : null;
    const rawLogoUrl = profile
      ? profile.logoUrl || await getAssetRegisterReportLogoUrl(
        workspace.ownerUserId,
        workspace.accountantRegisterId,
        filters?.assetId === 'all' ? null : filters?.assetId,
      )
      : '';
    const context = profile ? {
      accountName: profile.businessName || profile.displayName || profile.name,
      logoUrl: await resolveReportLogoUrlForHtml(rawLogoUrl, request.url),
    } : {};
    const data = payload.format === 'xlsx' ? buildFuelSlipWorkbook(slips) : await renderReportHtmlToPdf(buildFuelSlipReportHtml(slips, context), {
      baseUrl: request.url,
      cookie: request.headers.get('cookie') ?? '',
    });
    return new NextResponse(new Uint8Array(data), { headers: {
      'Content-Type': payload.format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      'Content-Disposition': `attachment; filename="fuel-slips-${new Date().toISOString().slice(0, 10)}.${payload.format}"`,
      'Cache-Control': 'private, no-store',
    } });
  } catch (error) {
    console.error('Fuel slip export failed.', error);
    return NextResponse.json({ error: 'Fuel slips could not be exported. Please try again.' }, { status: 500 });
  }
}
