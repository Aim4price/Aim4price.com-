import { NextRequest, NextResponse } from 'next/server';
import { listFuelLedger, recordMissingFuelAssetIssue } from '../../../../../../lib/fuel-ledger';
import {
  assertWorkspaceAssetAccess,
  filterFuelLedgerForWorkspace,
  resolveOwnerWorkspaceContext,
} from '../../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { storageId: string } };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  let payload: Record<string, unknown> = {};
  let evidenceFile: File | null = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawPayload = formData.get('payload');
      if (typeof rawPayload !== 'string') throw new Error('Missing entry details were not supplied.');
      payload = JSON.parse(rawPayload) as Record<string, unknown>;
      const candidate = formData.get('evidence');
      evidenceFile = candidate instanceof File && candidate.size > 0 ? candidate : null;
    } else {
      const body = await request.json();
      payload = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Enter valid missing fuel entry details.') }, { status: 400 });
  }

  try {
    await assertWorkspaceAssetAccess(workspace, payload.assetId);
    const result = await recordMissingFuelAssetIssue({
      ...payload,
      userId: workspace.ownerUserId,
      addedByName: workspace.actorName,
      addedByEmail: workspace.actorEmail,
      storageId: context.params.storageId,
      evidenceFile,
    });
    const ledger = await filterFuelLedgerForWorkspace(
      workspace,
      await listFuelLedger(workspace.ownerUserId),
    );
    return NextResponse.json({ ok: true, ...result, ...ledger, message: 'Missing fuel entry saved' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Failed to save the missing fuel entry.') }, { status: 400 });
  }
}
