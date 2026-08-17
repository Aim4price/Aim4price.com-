import { NextResponse } from 'next/server';
import { getFuelSlipTransactionById, listFuelLedgerAuditEvents } from '../../../../lib/fuel-ledger';
import { assertWorkspaceAssetAccess, resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  const url = new URL(request.url);
  const recordType = String(url.searchParams.get('recordType') ?? '').trim();
  const recordId = String(url.searchParams.get('recordId') ?? '').trim();
  if (!recordType || !recordId) {
    return NextResponse.json({ ok: false, error: 'Choose a Fuel Ledger record to view its history.' }, { status: 400 });
  }

  try {
    if (recordType === 'fuel_slip') {
      const slip = await getFuelSlipTransactionById(resolved.context.ownerUserId, recordId);
      if (!slip) throw new Error('Fuel slip not found.');
      if (slip.assetId) await assertWorkspaceAssetAccess(resolved.context, slip.assetId);
    } else if (recordType === 'asset_exclusion') {
      await assertWorkspaceAssetAccess(resolved.context, recordId);
    } else {
      throw new Error('This change history type is not available here.');
    }
    const events = await listFuelLedgerAuditEvents(resolved.context.ownerUserId, {
      recordType,
      recordId,
      limit: Number(url.searchParams.get('limit') || 30),
    });
    return NextResponse.json({ ok: true, events });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Change history could not be loaded.' },
      { status: 400 },
    );
  }
}
