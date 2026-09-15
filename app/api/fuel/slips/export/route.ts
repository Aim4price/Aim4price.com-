import { NextResponse } from 'next/server';
import { listFuelLedger } from '../../../../../lib/fuel-ledger';
import { filterFuelLedgerForWorkspace, resolveOwnerWorkspaceContext } from '../../../../../lib/owner-workspace-access';
import { buildFuelSlipReportHtml, buildFuelSlipWorkbook } from '../../../../../lib/fuel-slip-export';
import { renderReportHtmlToPdf } from '../../../../../lib/report-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  let payload: { format?: unknown; ids?: unknown };
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid export request.' }, { status: 400 });
  }
  if (!payload || !['pdf', 'xlsx'].includes(String(payload.format)) || !Array.isArray(payload.ids) || !payload.ids.length || payload.ids.length > 10000 || payload.ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'Choose a format and fuel slips to export.' }, { status: 400 });
  }
  try {
    const workspace = resolved.context;
    const ledger = await filterFuelLedgerForWorkspace(workspace, await listFuelLedger(workspace.ownerUserId));
    const ids = new Set(payload.ids);
    const slips = ledger.recentFuelSlips.filter((slip) => ids.has(slip.id));
    // Never trust client records or silently export a partial/stale selection.
    if (slips.length !== ids.size) return NextResponse.json({ error: 'Some selected slips are no longer available. Refresh and try again.' }, { status: 409 });
    const data = payload.format === 'xlsx' ? buildFuelSlipWorkbook(slips) : await renderReportHtmlToPdf(buildFuelSlipReportHtml(slips));
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
