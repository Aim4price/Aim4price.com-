import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { declineSharedAccessGrant } from '../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    grantId: string;
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
    const grant = await declineSharedAccessGrant(session.user.id, context.params.grantId);
    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    if (error instanceof Error && error.message === 'ACCESS_GRANT_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Access request not found.' }, { status: 404 });
    }

    console.error('shared access decline failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to decline access.' }, { status: 500 });
  }
}
