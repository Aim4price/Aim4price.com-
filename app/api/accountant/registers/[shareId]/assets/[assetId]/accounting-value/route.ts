import { NextRequest, NextResponse } from 'next/server';
import { accountantWorkspaceError, saveAccountantCarryingValue } from '../../../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string; assetId: string } };

export async function PUT(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const accountingValue = await saveAccountantCarryingValue({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      assetId: context.params.assetId,
      carryingValue: body.carryingValue,
      asAtDate: body.asAtDate,
      sourceReference: body.sourceReference,
    });
    return NextResponse.json({ ok: true, accountingValue });
  } catch (error) {
    console.error('accountant carrying value PUT failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
