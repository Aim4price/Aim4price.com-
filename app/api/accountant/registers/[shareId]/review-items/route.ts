import { NextRequest, NextResponse } from 'next/server';
import {
  buildAccountantFinancialSummary,
  saveAccountingReviewDecision,
} from '../../../../../../lib/accounting-collaboration';
import { accountantWorkspaceError } from '../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string } };

export async function POST(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    await saveAccountingReviewDecision({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      issueKey: body.issueKey,
      issueStatus: body.issueStatus,
      severity: body.severity,
      assetId: body.assetId,
      agreementId: body.agreementId,
      note: body.note,
      deferredUntil: body.deferredUntil,
    });
    const data = await buildAccountantFinancialSummary({ accountantUserId: session.user.id, shareId: context.params.shareId });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error('accounting review item POST failed', error);
    if (error instanceof Error && error.message === 'ACCOUNTING_REVIEW_KEY_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Choose a valid review item.' }, { status: 400 });
    }
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
