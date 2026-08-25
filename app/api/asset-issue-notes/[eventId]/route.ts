import { NextRequest, NextResponse } from 'next/server';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { markAssetIssueNoteStatusNoted } from '../../../../lib/asset-issue-notes';
import { getServerSession } from '../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    eventId: string;
  };
};

type UpdateIssueNoteStatusBody = {
  status?: unknown;
};

function mapIssueNoteError(error: unknown) {
  if (error instanceof Error && error.message === 'ISSUE_NOTE_STATUS_NOT_FOUND') {
    return NextResponse.json({ ok: false, error: 'Issue note was not found.' }, { status: 404 });
  }

  if (error instanceof Error && error.message === 'ISSUE_NOTE_STATUS_FORBIDDEN') {
    return NextResponse.json({ ok: false, error: 'You cannot update this issue note.' }, { status: 403 });
  }

  console.error('asset issue note status PATCH failed', error);
  return NextResponse.json({ ok: false, error: 'Failed to update issue note.' }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let body: UpdateIssueNoteStatusBody = {};

  try {
    body = (await request.json()) as UpdateIssueNoteStatusBody;
  } catch {
    body = {};
  }

  const nextStatus = String(body.status ?? 'noted').trim().toLowerCase();

  if (nextStatus !== 'noted') {
    return NextResponse.json({ ok: false, error: 'Only noted status is supported.' }, { status: 400 });
  }

  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }
  if (!await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json({ ok: false, error: 'You do not have permission to update this Asset Register.' }, { status: 403 });
  }

  try {
    const issueNoteStatus = await markAssetIssueNoteStatusNoted({
      currentUserId: session.user.id,
      issueNoteStatusId: context.params.eventId,
    });

    return NextResponse.json({ ok: true, issueNoteStatus });
  } catch (error) {
    return mapIssueNoteError(error);
  }
}
