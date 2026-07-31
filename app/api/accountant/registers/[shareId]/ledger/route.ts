import { NextRequest, NextResponse } from 'next/server';
import { accountantWorkspaceError, getAccountantLedger } from '../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string } };

export async function GET(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  const kind = new URL(request.url).searchParams.get('kind') === 'fuel' ? 'fuel' : 'cost';
  try {
    return NextResponse.json({ ok: true, ...(await getAccountantLedger({ accountantUserId: session.user.id, shareId: context.params.shareId, kind })) });
  } catch (error) {
    console.error('accountant ledger GET failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
