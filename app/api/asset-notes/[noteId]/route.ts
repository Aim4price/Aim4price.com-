import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { markSharedAssetNoteNoted } from '../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    noteId: string;
  };
};

type UpdateNoteBody = {
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

  let body: UpdateNoteBody = {};

  try {
    body = (await request.json()) as UpdateNoteBody;
  } catch {
    body = {};
  }

  const nextStatus = String(body.status ?? 'noted').trim().toLowerCase();

  if (nextStatus !== 'noted') {
    return NextResponse.json({ ok: false, error: 'Only noted status is supported.' }, { status: 400 });
  }

  try {
    const note = await markSharedAssetNoteNoted({
      currentUserId: session.user.id,
      noteId: context.params.noteId,
    });

    return NextResponse.json({ ok: true, note });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOTE_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Note not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'ASSET_NOTE_FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'You cannot update this note.' }, { status: 403 });
    }

    console.error('asset note PATCH failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to update note.' }, { status: 500 });
  }
}
