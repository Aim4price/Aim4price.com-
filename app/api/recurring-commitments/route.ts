import { NextRequest, NextResponse } from 'next/server';
import {
  listRecurringCommitments,
  saveRecurringCommitment,
} from '../../../lib/accounting-collaboration';
import {
  getWorkspaceAssetIds,
  resolveOwnerWorkspaceContext,
} from '../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'RECURRING_COMMITMENT_REQUIRED') return 'Add a description, amount, start date and at least one linked asset.';
  if (code === 'RECURRING_COMMITMENT_ASSET_INVALID') return 'One or more selected assets are outside this Asset Register.';
  if (code === 'RECURRING_COMMITMENT_NOT_SAVED') return 'The recurring commitment could not be saved.';
  return code || 'The recurring commitment request could not be completed.';
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;
  try {
    const assetIds = await getWorkspaceAssetIds(resolved.context);
    const commitments = await listRecurringCommitments(resolved.context.ownerUserId, assetIds);
    return NextResponse.json({ ok: true, commitments });
  } catch (error) {
    console.error('recurring commitments GET failed', error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    await saveRecurringCommitment({
      ownerUserId: resolved.context.ownerUserId,
      actorUserId: resolved.context.actorUserId,
      registerId: resolved.context.accountantAccess ? resolved.context.accountantRegisterId : null,
      body,
    });
    const assetIds = await getWorkspaceAssetIds(resolved.context);
    const commitments = await listRecurringCommitments(resolved.context.ownerUserId, assetIds);
    return NextResponse.json({ ok: true, commitments });
  } catch (error) {
    console.error('recurring commitments POST failed', error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}
