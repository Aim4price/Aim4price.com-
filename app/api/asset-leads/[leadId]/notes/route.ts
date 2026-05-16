import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { createAssetLeadNote } from '../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    leadId: string;
  };
};

type CreateLeadNoteBody = {
  note?: unknown;
  noteText?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: CreateLeadNoteBody;

  try {
    body = (await request.json()) as CreateLeadNoteBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid note.' }, { status: 400 });
  }

  try {
    const note = await createAssetLeadNote({
      currentUserId: session.user.id,
      leadId: context.params.leadId,
      noteText: body.noteText ?? body.note,
    });

    return NextResponse.json({ ok: true, note });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOTE_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Write a note before saving it.' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'LEAD_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Lead not found.' }, { status: 404 });
    }

    if (error instanceof Error && (error.message === 'LEAD_FORBIDDEN' || error.message === 'PARTNER_NOTE_FORBIDDEN')) {
      return NextResponse.json({ ok: false, error: 'You cannot leave a note on this lead.' }, { status: 403 });
    }

    console.error('asset lead note POST failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to save note.' }, { status: 500 });
  }
}
