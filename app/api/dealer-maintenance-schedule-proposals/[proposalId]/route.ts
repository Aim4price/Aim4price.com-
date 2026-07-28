import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { resolveDealerMaintenanceScheduleProposal } from '../../../../lib/dealer-maintenance-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    proposalId: string;
  };
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowOwnerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  }
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Only the asset owner can decide this schedule.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { decision?: unknown } | null;
  const rawDecision = String(body?.decision ?? '').trim().toLowerCase();
  const decision = rawDecision === 'approve' || rawDecision === 'accept'
    ? 'approve'
    : rawDecision === 'decline' || rawDecision === 'reject'
      ? 'decline'
      : null;
  if (!decision) {
    return NextResponse.json({ ok: false, error: 'Choose whether to approve or disapprove this schedule.' }, { status: 400 });
  }
  try {
    const proposal = await resolveDealerMaintenanceScheduleProposal({
      ownerUserId: session.user.id,
      proposalId: String(context.params.proposalId ?? '').trim(),
      decision,
    });
    return NextResponse.json({
      ok: true,
      proposal,
      message: decision === 'approve'
        ? 'Maintenance schedule approved and added to the Asset Register.'
        : 'Maintenance schedule disapproved. It is no longer visible on the owner side.',
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'MAINTENANCE_PROPOSAL_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'This maintenance schedule proposal was not found.' }, { status: 404 });
    }
    if (code === 'MAINTENANCE_PROPOSAL_ALREADY_RESOLVED') {
      return NextResponse.json({ ok: false, error: 'This maintenance schedule has already been decided.' }, { status: 409 });
    }
    console.error('Owner maintenance schedule proposal PATCH failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to save the maintenance schedule decision.' }, { status: 500 });
  }
}
