import { NextRequest, NextResponse } from 'next/server';
import {
  accountantWorkspaceError,
  createAccountantAssetNote,
} from '../../../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string; assetId: string } };

export async function POST(request: NextRequest, context: Context) {
  const session = await getServerSession({ requireActive: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { note?: unknown; noteText?: unknown };
    const note = await createAccountantAssetNote({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      assetId: context.params.assetId,
      noteText: body.noteText ?? body.note,
    });
    return NextResponse.json({ ok: true, note });
  } catch (error) {
    console.error('accountant asset note POST failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
