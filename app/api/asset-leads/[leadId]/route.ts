import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { normalizeLeadStatus, updateAssetLeadStatus } from '../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    leadId: string;
  };
};

type UpdateLeadBody = {
  status?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: UpdateLeadBody;

  try {
    body = (await request.json()) as UpdateLeadBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid lead status.' }, { status: 400 });
  }

  const status = normalizeLeadStatus(body.status);

  if (!status) {
    return NextResponse.json({ ok: false, error: 'Choose a valid lead status.' }, { status: 400 });
  }

  try {
    const lead = await updateAssetLeadStatus({
      currentUserId: session.user.id,
      leadId: context.params.leadId,
      status,
    });

    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    if (error instanceof Error && error.message === 'LEAD_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Lead not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'LEAD_FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'You cannot update this lead.' }, { status: 403 });
    }

    console.error('asset lead PATCH failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to update lead.' }, { status: 500 });
  }
}
