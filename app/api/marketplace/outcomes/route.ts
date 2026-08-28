import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { dealerRoleCan } from '../../../../lib/dealer-app-access';
import {
  getServerSession,
  isAdminSupportSession,
  isDealerAppSession,
  isOwnerAppSession,
} from '../../../../lib/auth-session';
import {
  closeMarketplaceListingWithOutcome,
  type MarketplaceOutcomeReason,
  type MarketplaceOutcomeSource,
} from '../../../../lib/marketplace-outcomes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OutcomeRequestBody = {
  assetId?: unknown;
  outcomeReason?: unknown;
  aim4priceHelped?: unknown;
  finalSalePriceExVat?: unknown;
  outcomeNote?: unknown;
  sourceSurface?: unknown;
};

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : '';

  if (code === 'ASSET_NOT_FOUND') {
    return NextResponse.json(
      { ok: false, error: 'This Marketplace advert could not be found.' },
      { status: 404 },
    );
  }
  if (
    code === 'MARKETPLACE_LISTING_NOT_LIVE' ||
    code === 'MARKETPLACE_OUTCOME_ALREADY_RECORDED'
  ) {
    return NextResponse.json(
      { ok: false, error: 'This advert has already been removed from Marketplace.' },
      { status: 409 },
    );
  }
  if (code === 'MARKETPLACE_OUTCOME_HELP_RESPONSE_REQUIRED') {
    return NextResponse.json(
      { ok: false, error: 'Please tell us whether Aim4price helped with this outcome.' },
      { status: 400 },
    );
  }
  if (code === 'MARKETPLACE_OUTCOME_FINAL_PRICE_NOT_APPLICABLE') {
    return NextResponse.json(
      { ok: false, error: 'A final price can only be recorded for sold or traded equipment.' },
      { status: 400 },
    );
  }
  if (code === 'MARKETPLACE_OUTCOME_FINAL_PRICE_INVALID') {
    return NextResponse.json(
      { ok: false, error: 'Enter a valid final price, or leave it blank.' },
      { status: 400 },
    );
  }
  if (code === 'MARKETPLACE_OUTCOME_NOTE_TOO_LONG') {
    return NextResponse.json(
      { ok: false, error: 'Keep the outcome note below 500 characters.' },
      { status: 400 },
    );
  }
  if (code === 'MARKETPLACE_OUTCOME_NOTE_REQUIRED') {
    return NextResponse.json(
      { ok: false, error: 'Please briefly explain what happened to this advert.' },
      { status: 400 },
    );
  }
  if (code.startsWith('MARKETPLACE_OUTCOME_')) {
    return NextResponse.json(
      { ok: false, error: 'Complete the advert outcome before removing it.' },
      { status: 400 },
    );
  }

  console.error('marketplace outcome save failed', error);
  return NextResponse.json(
    { ok: false, error: 'The advert could not be removed. Please try again.' },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }
  if (isDealerAppSession(session) && !dealerRoleCan(session.dealerApp.role, 'marketplace')) {
    return NextResponse.json(
      { ok: false, error: 'Your Dealer App role cannot manage Marketplace adverts.' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as OutcomeRequestBody | null;
  if (!body) {
    return NextResponse.json(
      { ok: false, error: 'Complete the advert outcome before removing it.' },
      { status: 400 },
    );
  }

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    if (
      (profile.accountType !== 'owner' && profile.accountType !== 'dealer') ||
      profile.accountStatus !== 'active'
    ) {
      return NextResponse.json(
        { ok: false, error: 'Marketplace advert management is not available for this account.' },
        { status: 403 },
      );
    }

    const actorType = isAdminSupportSession(session)
      ? 'admin_support'
      : isDealerAppSession(session)
        ? 'dealer_staff'
        : isOwnerAppSession(session)
          ? 'owner_app'
          : 'account';
    const actorId = isAdminSupportSession(session)
      ? session.adminSupport.adminUserId
      : isDealerAppSession(session)
        ? session.dealerApp.staffId
        : isOwnerAppSession(session)
          ? session.ownerApp.ownerAppUserId
          : session.user.id;

    const outcome = await closeMarketplaceListingWithOutcome({
      sellerUserId: session.user.id,
      assetId: String(body.assetId ?? '').trim(),
      outcomeReason: String(body.outcomeReason ?? '').trim() as MarketplaceOutcomeReason,
      aim4priceHelped: body.aim4priceHelped as boolean,
      finalSalePriceExVat:
        body.finalSalePriceExVat === null
        || body.finalSalePriceExVat === ''
        || typeof body.finalSalePriceExVat === 'undefined'
          ? null
          : Number(body.finalSalePriceExVat),
      outcomeNote: String(body.outcomeNote ?? '').trim(),
      sourceSurface: String(body.sourceSurface ?? '').trim() as MarketplaceOutcomeSource,
      actorType,
      actorId,
    });

    return NextResponse.json(
      {
        ok: true,
        outcome,
        assetId: outcome.assetId,
        marketplaceStatus: outcome.marketplaceStatus,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
