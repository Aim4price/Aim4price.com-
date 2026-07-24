import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import { retryDealerAssetCorrectionRevaluation } from '../../../../../lib/dealer-asset-corrections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    correctionId: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await getServerSession({ allowOwnerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Only the asset owner can retry this valuation.' }, { status: 403 });
  }

  try {
    const result = await retryDealerAssetCorrectionRevaluation({
      ownerUserId: session.user.id,
      correctionId: String(context.params.correctionId ?? '').trim(),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'CORRECTION_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'This dealer correction was not found.' }, { status: 404 });
    }
    if (message === 'CORRECTION_NOT_ACCEPTED') {
      return NextResponse.json({ ok: false, error: 'Only an accepted replacement-price correction can be retried.' }, { status: 409 });
    }
    if (message === 'CORRECTION_REVALUATION_NOT_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'This correction does not require a valuation retry.' }, { status: 409 });
    }

    console.error('Owner dealer asset correction retry failed.', error);
    return NextResponse.json({ ok: false, error: 'Aim4price could not retry this valuation.' }, { status: 500 });
  }
}
