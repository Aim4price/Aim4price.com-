import { NextRequest, NextResponse } from 'next/server';
import { listFuelLedger, saveFuelStorageDipstickNote } from '../../../../../../lib/fuel-ledger';
import { filterFuelLedgerForWorkspace, resolveOwnerWorkspaceContext } from '../../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { storageId: string } };

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;

  try {
    const storage = await saveFuelStorageDipstickNote(resolved.context.ownerUserId, context.params.storageId, { dipstickNote: '' });
    const ledger = await filterFuelLedgerForWorkspace(
      resolved.context,
      await listFuelLedger(resolved.context.ownerUserId),
    );
    return NextResponse.json({ ok: true, storage, ...ledger });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Failed to clear dipstick note.') }, { status: 400 });
  }
}
