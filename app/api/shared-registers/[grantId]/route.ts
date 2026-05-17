import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { deleteSharedAccessGrantForPartner, revokeSharedAccessGrant } from '../../../../lib/partner-access';

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
  } catch (ownerError) {
    if (!(ownerError instanceof Error) || ownerError.message !== 'ACCESS_GRANT_NOT_FOUND') {
      console.error('shared access revoke failed', ownerError);
      return NextResponse.json({ ok: false, error: 'Failed to revoke access.' }, { status: 500 });
    }

    try {
      const grant = await deleteSharedAccessGrantForPartner(session.user.id, grantId);
      return NextResponse.json({ ok: true, grant });
    } catch (partnerError) {
      if (partnerError instanceof Error && partnerError.message === 'ACCESS_GRANT_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Access request not found.' }, { status: 404 });
      }

      console.error('shared access partner delete failed', partnerError);
      return NextResponse.json({ ok: false, error: 'Failed to delete shared access.' }, { status: 500 });
    }
  }
}
