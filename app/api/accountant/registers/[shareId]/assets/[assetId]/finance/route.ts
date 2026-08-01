import { NextRequest, NextResponse } from 'next/server';
import { accountantWorkspaceError, updateAccountantFinance } from '../../../../../../../../lib/accountant-workspace';
import {
  listFinanceAgreementsForAccountant,
  saveFinanceAgreementForAccountant,
} from '../../../../../../../../lib/accounting-collaboration';
import { getServerSession } from '../../../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string; assetId: string } };

export async function GET(_request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  try {
    const data = await listFinanceAgreementsForAccountant({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      assetId: context.params.assetId,
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error('accountant finance GET failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}

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
    const financeStatus = String(body.financeStatus ?? '').trim();
    const shouldSaveAgreement = Boolean(String(body.agreementId ?? '').trim()) || ['yes', 'paid'].includes(financeStatus);
    const agreements = shouldSaveAgreement
      ? await saveFinanceAgreementForAccountant({
          accountantUserId: session.user.id,
          shareId: context.params.shareId,
          assetId: context.params.assetId,
          body,
        })
      : await listFinanceAgreementsForAccountant({
          accountantUserId: session.user.id,
          shareId: context.params.shareId,
          assetId: context.params.assetId,
        });
    return NextResponse.json({ ok: true, item, ...agreements });
  } catch (error) {
    console.error('accountant finance PUT failed', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'A Finance Agreement with this reference already exists for the client.' }, { status: 409 });
    }
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
