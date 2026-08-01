import { NextRequest, NextResponse } from 'next/server';
import {
  accountantWorkspaceError,
  updateAccountantAssetFlag,
} from '../../../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string; assetId: string } };

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'flagged'].includes(String(value ?? '').trim().toLowerCase());
}

export async function PATCH(request: NextRequest, context: Context) {
  const session = await getServerSession({ requireActive: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { isFlagged?: unknown; assetFlagged?: unknown };
    const isFlagged = Object.prototype.hasOwnProperty.call(body, 'isFlagged')
      ? booleanValue(body.isFlagged)
      : booleanValue(body.assetFlagged);
    const item = await updateAccountantAssetFlag({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      assetId: context.params.assetId,
      isFlagged,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error('accountant asset flag PATCH failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
