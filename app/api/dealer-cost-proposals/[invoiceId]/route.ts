import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import {
  getOwnerDealerCostDecision,
  resolveDealerCostDeletionDecision,
  resolveDealerCostOwnerDecision,
  type DealerCostOwnerAction,
  type DealerCostOwnerDecision,
} from '../../../../lib/dealer-costs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    invoiceId: string;
  };
};

async function getOwnerUserId(): Promise<string | null> {
  const session = await getServerSession({ allowOwnerApp: true });
  if (!session?.user?.id) return null;

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') return null;

  return session.user.id;
}

function normalizeDecision(
  action: DealerCostOwnerAction,
  value: unknown,
): DealerCostOwnerDecision | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (action === 'delete') {
    if (normalized === 'keep' || normalized === 'retain') return 'keep';
    if (normalized === 'delete' || normalized === 'remove') return 'delete';
    return null;
  }
  if (normalized === 'approve' || normalized === 'accept' || normalized === 'yes') return 'approve';
  if (normalized === 'decline' || normalized === 'reject' || normalized === 'no') return 'decline';
  return null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const ownerUserId = await getOwnerUserId();
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  }

  try {
    const pendingDecision = await getOwnerDealerCostDecision(
      ownerUserId,
      String(context.params.invoiceId ?? '').trim(),
    );
    if (!pendingDecision) {
      return NextResponse.json(
        { ok: false, error: 'This dealer cost request was not found or has already been decided.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        action: pendingDecision.action,
        invoice: pendingDecision.invoice,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Owner dealer cost proposal GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load the dealer cost.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const ownerUserId = await getOwnerUserId();
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  }

  try {
    const invoiceId = String(context.params.invoiceId ?? '').trim();
    const pendingDecision = await getOwnerDealerCostDecision(ownerUserId, invoiceId);
    if (!pendingDecision) {
      return NextResponse.json(
        { ok: false, error: 'This dealer cost request was not found or has already been decided.' },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => null) as { decision?: unknown } | null;
    const decision = normalizeDecision(pendingDecision.action, body?.decision);
    if (!decision) {
      return NextResponse.json(
        {
          ok: false,
          error: pendingDecision.action === 'delete'
            ? 'Choose whether to keep this cost or delete it permanently.'
            : 'Choose whether this cost must be stored in your Cost Ledger.',
        },
        { status: 400 },
      );
    }

    if (pendingDecision.action === 'delete') {
      const deletionDecision = decision as 'keep' | 'delete';
      const dealerDeletionStatus = await resolveDealerCostDeletionDecision({
        ownerUserId,
        invoiceId,
        decision: deletionDecision,
      });
      return NextResponse.json({
        ok: true,
        action: 'delete',
        dealerDeletionStatus,
        message: deletionDecision === 'keep'
          ? 'The cost was kept in your Cost Ledger. It is no longer available to the dealer.'
          : 'The cost was permanently deleted from your Cost Ledger.',
      });
    }

    const storageDecision = decision as 'approve' | 'decline';
    const ownerStorageStatus = await resolveDealerCostOwnerDecision({
      ownerUserId,
      invoiceId,
      decision: storageDecision,
    });
    return NextResponse.json({
      ok: true,
      action: 'store',
      ownerStorageStatus,
      message: storageDecision === 'approve'
        ? 'This dealer cost is now in your Cost Ledger and will be included in owner cost reports.'
        : 'The cost will remain visible to the dealer only.',
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'DEALER_COST_DECISION_NOT_FOUND' || code === 'DEALER_COST_DELETION_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'This dealer cost request was not found.' }, { status: 404 });
    }
    if (
      code === 'DEALER_COST_DECISION_ALREADY_RESOLVED'
      || code === 'DEALER_COST_DELETION_ALREADY_RESOLVED'
    ) {
      return NextResponse.json({ ok: false, error: 'This dealer cost has already been decided.' }, { status: 409 });
    }
    console.error('Owner dealer cost proposal PATCH failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to save the dealer cost decision.' }, { status: 500 });
  }
}
