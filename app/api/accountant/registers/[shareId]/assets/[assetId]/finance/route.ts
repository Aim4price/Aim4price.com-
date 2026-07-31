import { NextRequest, NextResponse } from 'next/server';
import { accountantWorkspaceError, updateAccountantFinance } from '../../../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string; assetId: string } };

export async function PUT(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const item = await updateAccountantFinance({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      assetId: context.params.assetId,
      body,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error('accountant finance PUT failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
