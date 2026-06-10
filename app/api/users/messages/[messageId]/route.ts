import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { markUserMessageRead } from '../../../../../lib/user-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    messageId: string;
  };
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

export async function PATCH(_request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const message = await markUserMessageRead(session.user.id, context.params.messageId);
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    if (error instanceof Error && error.message === 'MESSAGE_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Message not found.' }, { status: 404 });
    }

    console.error('user message PATCH failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to update message.' }, { status: 500 });
  }
}
