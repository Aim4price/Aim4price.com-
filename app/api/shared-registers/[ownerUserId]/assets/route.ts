import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { listSharedRegisterAssets } from '../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    ownerUserId: string;
  };
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const assets = await listSharedRegisterAssets({
      currentUserId: session.user.id,
      ownerUserId: context.params.ownerUserId,
    });

    return NextResponse.json({
      ok: true,
      assets,
      summary: {
        count: assets.length,
        totalValue: assets.reduce((sum, asset) => sum + Number(asset.value || 0), 0),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'SHARED_REGISTER_FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'You do not have access to this register.' }, { status: 403 });
    }

    console.error('shared register assets GET failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to load shared register assets.' }, { status: 500 });
  }
}
