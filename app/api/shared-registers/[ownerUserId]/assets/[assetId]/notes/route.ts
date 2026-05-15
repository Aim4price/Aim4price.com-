import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../../lib/auth-session';
import { createSharedAssetNote } from '../../../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    ownerUserId: string;
    assetId: string;
  };
};

type CreateNoteBody = {
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

  let body: CreateNoteBody;

  try {
    body = (await request.json()) as CreateNoteBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid note.' }, { status: 400 });
  }

  try {
    const note = await createSharedAssetNote({
      currentUserId: session.user.id,
      ownerUserId: context.params.ownerUserId,
      assetId: context.params.assetId,
      noteText: body.noteText ?? body.note,
    });

    return NextResponse.json({ ok: true, note });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOTE_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Write a note before sending.' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (
      error instanceof Error &&
      (error.message === 'PARTNER_NOTE_FORBIDDEN' || error.message === 'SHARED_REGISTER_FORBIDDEN')
    ) {
      return NextResponse.json({ ok: false, error: 'You cannot leave notes on this asset.' }, { status: 403 });
    }

    console.error('shared asset note POST failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to save note.' }, { status: 500 });
  }
}
