import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { deleteDeclinedAssetLead, normalizeLeadStatus, updateAssetLeadStatus } from '../../../../lib/partner-access';

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
  const session = await getServerSession({ allowDealerApp: true });

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

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    await deleteDeclinedAssetLead({
      currentUserId: session.user.id,
      leadId: context.params.leadId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'LEAD_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Lead not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'LEAD_FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'You cannot delete this lead.' }, { status: 403 });
    }

    if (error instanceof Error && error.message === 'LEAD_DELETE_REQUIRES_DECLINED') {
      return NextResponse.json({ ok: false, error: 'Only declined leads can be deleted.' }, { status: 400 });
    }

    console.error('asset lead DELETE failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to delete lead.' }, { status: 500 });
  }
}
