import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { calculateFuturePriceForAsset } from '../../../../lib/asset-register-projection';
import { canViewOwnerRegister } from '../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as Partial<{
    assetId: string;
    ownerUserId: string;
    targetYear: number;
    inflationRatePct: number;
    extraHours: number;
  }>;

  const assetId = String(body.assetId ?? '').trim();
  const ownerUserId = String(body.ownerUserId ?? session.user.id).trim() || session.user.id;
  const targetYear = Math.round(Number(body.targetYear));
  const inflationRatePct = Number(body.inflationRatePct);
  const extraHours = Number(body.extraHours ?? 0);

  if (!assetId) {
    return badRequest('A valid asset id is required.');
  }

  if (!Number.isFinite(targetYear) || targetYear < 1970) {
    return badRequest('A valid target year is required.');
  }

  if (!Number.isFinite(inflationRatePct)) {
    return badRequest('A valid inflation percentage is required.');
  }

  if (!Number.isFinite(extraHours) || extraHours < 0) {
    return badRequest('Extra hours must be zero or greater.');
  }

  if (ownerUserId !== session.user.id) {
    const canView = await canViewOwnerRegister(session.user.id, ownerUserId);
    if (!canView) {
      return NextResponse.json({ ok: false, error: 'You do not have access to this register.' }, { status: 403 });
    }
  }

  try {
    const projection = await calculateFuturePriceForAsset({
      userId: ownerUserId,
      assetId,
      targetYear,
      inflationRatePct,
      extraHours,
    });

    return NextResponse.json({ ok: true, projection });
  } catch (error) {
    if (!(error instanceof Error)) {
      console.error('asset register future price failed', error);
      return NextResponse.json({ ok: false, error: 'Failed to calculate future price.' }, { status: 500 });
    }

    if (error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (error.message === 'FUTURE_PRICE_UNAVAILABLE') {
      return badRequest('Future price is only available for saved tractor valuations with the required machine data.');
    }

    if (error.message === 'VALUATION_RUN_NOT_FOUND') {
      return badRequest('The valuation data for this asset could not be found.');
    }

    if (error.message === 'REPLACEMENT_PRICE_NOT_AVAILABLE') {
      return badRequest('Replacement price data is not available for this asset.');
    }

    console.error('asset register future price failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to calculate future price.' }, { status: 500 });
  }
}
