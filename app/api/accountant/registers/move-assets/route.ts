import { NextRequest, NextResponse } from 'next/server';
import {
  accountantWorkspaceError,
  moveAccountantAssetBetweenRegisters,
} from '../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MoveBody = {
  assetId?: unknown;
  sourceShareId?: unknown;
  targetShareId?: unknown;
};

export async function PUT(request: NextRequest) {
  const session = await getServerSession({ requireActive: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as MoveBody;
    const assetId = String(body.assetId ?? '').trim();
    const sourceShareId = String(body.sourceShareId ?? '').trim();
    const targetShareId = String(body.targetShareId ?? '').trim();

    if (!assetId || !sourceShareId || !targetShareId) {
      return NextResponse.json({ ok: false, error: 'Choose an asset, source register and target register.' }, { status: 400 });
    }

    const result = await moveAccountantAssetBetweenRegisters({
      accountantUserId: session.user.id,
      sourceShareId,
      targetShareId,
      assetId,
    });

    return NextResponse.json({
      ok: true,
      item: result.item,
      sourceAccess: result.sourceAccess,
      targetAccess: result.targetAccess,
    });
  } catch (error) {
    console.error('accountant asset move PUT failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
