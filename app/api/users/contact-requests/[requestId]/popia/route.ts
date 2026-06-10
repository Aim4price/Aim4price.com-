import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../lib/auth-session';
import { acknowledgeContactDetailsPopia } from '../../../../../../lib/contact-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    requestId: string;
  };
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function PATCH(_request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const owner = await acknowledgeContactDetailsPopia({
      requesterUserId: session.user.id,
      requestId: context.params.requestId,
    });

    return NextResponse.json({ ok: true, owner });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTACT_REQUEST_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Unlocked contact request not found.' }, { status: 404 });
    }

    console.error('POPIA acknowledgement failed', error);
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to acknowledge POPIA notice.') },
      { status: 500 },
    );
  }
}
