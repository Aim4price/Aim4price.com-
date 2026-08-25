import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { calculateFuturePriceForAsset } from '../../../../lib/asset-register-projection';
import type { ConditionKey } from '../../../../lib/tractor-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONDITION_KEYS: readonly ConditionKey[] = ['excellent', 'good', 'fair', 'used', 'serious'];

function isConditionKey(value: string): value is ConditionKey {
  return CONDITION_KEYS.includes(value as ConditionKey);
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  if (!await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json({ ok: false, error: 'You do not have permission to use this Asset Register.' }, { status: 403 });
  }

  const body = (await request.json()) as Partial<{
    assetId: string;
    targetYear: number;
    inflationRatePct: number;
    extraHours: number;
    extraUsage: number;
    targetLifeWorkedPercent: number;
    targetCondition: string;
  }>;

  const assetId = String(body.assetId ?? '').trim();
  const targetYear = Math.round(Number(body.targetYear));
  const inflationRatePct = Number(body.inflationRatePct);
  const extraUsage = Number(body.extraUsage ?? body.extraHours ?? 0);
  const hasTargetLifeWorkedPercent = body.targetLifeWorkedPercent !== null &&
    typeof body.targetLifeWorkedPercent !== 'undefined' &&
    String(body.targetLifeWorkedPercent).trim() !== '';
  const targetLifeWorkedPercent = hasTargetLifeWorkedPercent ? Number(body.targetLifeWorkedPercent) : null;
  const targetConditionInput = String(body.targetCondition ?? '').trim().toLowerCase();
  const targetCondition = targetConditionInput && isConditionKey(targetConditionInput) ? targetConditionInput : null;

  if (!assetId) {
    return badRequest('A valid asset id is required.');
  }

  if (!Number.isFinite(targetYear) || targetYear < 1970) {
    return badRequest('A valid target year is required.');
  }

  if (!Number.isFinite(inflationRatePct)) {
    return badRequest('A valid inflation percentage is required.');
  }

  if (targetConditionInput && !targetCondition) {
    return badRequest('Choose a valid future condition.');
  }

  if (!Number.isFinite(extraUsage) || extraUsage < 0) {
    return badRequest('Extra usage must be zero or greater.');
  }

  if (targetLifeWorkedPercent !== null && (!Number.isFinite(targetLifeWorkedPercent) || targetLifeWorkedPercent < 0 || targetLifeWorkedPercent > 100)) {
    return badRequest('New Expected % must be between 0% and 100%.');
  }

  try {
    const projection = await calculateFuturePriceForAsset({
      userId: session.user.id,
      assetId,
      targetYear,
      inflationRatePct,
      extraHours: extraUsage,
      targetLifeWorkedPercent,
      targetCondition,
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
      return badRequest('Future price is only available for saved tractor, motor vehicle, and percentage-worked valuations with the required asset data.');
    }

    if (error.message === 'TARGET_PERCENT_INVALID') {
      return badRequest('New Expected % must be between 0% and 100%.');
    }

    if (error.message === 'TARGET_PERCENT_BELOW_CURRENT') {
      return badRequest('New Expected % cannot be lower than the current worked percentage.');
    }

    if (error.message === 'TARGET_PERCENT_UNSUPPORTED') {
      return badRequest('New Expected % can only be used for percentage-worked assets.');
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
