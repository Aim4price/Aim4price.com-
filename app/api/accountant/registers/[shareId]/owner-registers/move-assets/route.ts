import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../../lib/auth-session';
import { moveAccountantAssetToRegister } from '../../../../../../../lib/accountant-workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string } };

export async function PUT(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { assetId?: unknown; targetRegisterId?: unknown };
    const result = await moveAccountantAssetToRegister({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      assetId: String(body.assetId ?? '').trim(),
      targetRegisterId: String(body.targetRegisterId ?? '').trim(),
    });
    return NextResponse.json({ ok: true, movedCount: 1, item: result.item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move asset.';
    const status = message.includes('NOT_FOUND') ? 404 : message.includes('SAME') || message.includes('LAST_SHARED') ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
