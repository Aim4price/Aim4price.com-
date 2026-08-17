import { NextResponse } from 'next/server';
import { listFuelLedger, setFuelAssetWorkUseExclusion } from '../../../../../lib/fuel-ledger';
import {
  assertWorkspaceAssetAccess,
  filterFuelLedgerForWorkspace,
  resolveOwnerWorkspaceContext,
} from '../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { assetId: string } };

export async function PUT(request: Request, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;
  const assetId = String(context.params.assetId ?? '').trim();
  if (!assetId) return NextResponse.json({ ok: false, error: 'Asset ID is required.' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid exclusion details.' }, { status: 400 });
  }

  try {
    await assertWorkspaceAssetAccess(workspace, assetId);
    const asset = await setFuelAssetWorkUseExclusion(workspace.ownerUserId, assetId, {
      excluded: body.excluded,
      reason: body.reason,
      actor: {
        userId: workspace.actorUserId,
        name: workspace.actorName,
        email: workspace.actorEmail,
      },
    });
    const ledger = await filterFuelLedgerForWorkspace(
      workspace,
      await listFuelLedger(workspace.ownerUserId),
    );
    return NextResponse.json({
      ok: true,
      asset,
      message: asset.workUseExcluded
        ? `${asset.title} is excluded from work-use fuel totals.`
        : `${asset.title} is included in work-use fuel totals.`,
      ...ledger,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'The exclusion could not be updated.' },
      { status: 400 },
    );
  }
}
