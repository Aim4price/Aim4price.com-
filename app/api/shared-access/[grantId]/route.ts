import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { revokeSharedAccessGrant } from '../../../../lib/partner-access';

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

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const grantId = String(context.params.grantId ?? '').trim();

  if (!grantId) {
    return NextResponse.json({ ok: false, error: 'Access request not found.' }, { status: 400 });
  }

  try {
    const grant = await revokeSharedAccessGrant(session.user.id, grantId);
    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    if (error instanceof Error && error.message === 'ACCESS_GRANT_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Access request not found.' }, { status: 404 });
    }

    console.error('shared access revoke failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to revoke access.' }, { status: 500 });
  }
}
