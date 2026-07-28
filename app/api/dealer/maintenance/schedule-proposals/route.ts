import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  createDealerMaintenanceScheduleProposal,
  listDealerMaintenanceScheduleProposals,
  type DealerMaintenanceScheduleProposalInput,
} from '../../../../../lib/dealer-maintenance-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function activeDealerUserId(): Promise<string> {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) return '';
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  return profile.accountType === 'dealer' && profile.accountStatus === 'active'
    ? session.user.id
    : '';
}

function proposalError(error: unknown): { message: string; status: number } {
  const code = error instanceof Error ? error.message : '';
  if (code === 'TRACKING_ACCESS_NOT_FOUND') {
    return { message: 'This Maintenance Tracker share is no longer active.', status: 404 };
  }
  if (code === 'MAINTENANCE_SCHEDULE_PERMISSION_REQUIRED') {
    return { message: 'The asset owner has not enabled dealer-created maintenance schedules.', status: 403 };
  }
  if (code === 'LEAD_NOT_FOUND') {
    return { message: 'This shared lead is no longer available.', status: 404 };
  }
  if (code === 'ASSET_NOT_FOUND') {
    return { message: 'The tracked asset is no longer available.', status: 404 };
  }
  if (code === 'DUE_DATE_REQUIRED') {
    return { message: 'Choose a valid due date.', status: 400 };
  }
  if (code === 'DUE_USAGE_REQUIRED') {
    return { message: 'Enter a valid usage target.', status: 400 };
  }
  if (code === 'RECURRING_INTERVAL_REQUIRED') {
    return { message: 'Enter a recurring interval.', status: 400 };
  }
  return { message: 'The maintenance schedule could not be sent to the owner.', status: 500 };
}

export async function GET(request: NextRequest) {
  const dealerUserId = await activeDealerUserId();
  if (!dealerUserId) {
    return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  }
  const accessId = String(request.nextUrl.searchParams.get('accessId') ?? '').trim();
  if (!accessId) {
    return NextResponse.json({ ok: false, error: 'Choose a tracked asset.' }, { status: 400 });
  }
  try {
    const proposals = await listDealerMaintenanceScheduleProposals({ dealerUserId, accessId });
    return NextResponse.json({ ok: true, proposals });
  } catch (error) {
    console.error('Dealer maintenance schedule proposals GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load maintenance schedule proposals.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const dealerUserId = await activeDealerUserId();
  if (!dealerUserId) {
    return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  }
  let draft: DealerMaintenanceScheduleProposalInput;
  try {
    draft = (await request.json()) as DealerMaintenanceScheduleProposalInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid maintenance schedule.' }, { status: 400 });
  }
  try {
    const proposal = await createDealerMaintenanceScheduleProposal({ dealerUserId, draft });
    const proposals = await listDealerMaintenanceScheduleProposals({
      dealerUserId,
      accessId: proposal.accessId,
    });
    return NextResponse.json({ ok: true, proposal, proposals });
  } catch (error) {
    const outcome = proposalError(error);
    if (outcome.status === 500) {
      console.error('Dealer maintenance schedule proposal POST failed.', error);
    }
    return NextResponse.json({ ok: false, error: outcome.message }, { status: outcome.status });
  }
}
