import { NextResponse } from 'next/server';
import { buildAccountantFinancialSummary } from '../../../../../../lib/accounting-collaboration';
import { accountantWorkspaceError } from '../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string } };

export async function GET(_request: Request, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  try {
    const data = await buildAccountantFinancialSummary({ accountantUserId: session.user.id, shareId: context.params.shareId });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error('accountant financial summary GET failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
