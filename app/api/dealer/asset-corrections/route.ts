import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession, isDealerAppSession } from '../../../../lib/auth-session';
import {
  createOrUpdateDealerAssetCorrection,
  type DealerAssetCorrectionField,
  type DealerAssetCorrectionSource,
} from '../../../../lib/dealer-asset-corrections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CorrectionBody = {
  sourceType?: unknown;
  sourceId?: unknown;
  field?: unknown;
  value?: unknown;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Dealer access is required.' }, { status: 403 });
  }

  let body: CorrectionBody;
  try {
    body = (await request.json()) as CorrectionBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send valid correction details.' }, { status: 400 });
  }

  const sourceType = asText(body.sourceType) as DealerAssetCorrectionSource;
  const field = asText(body.field) as DealerAssetCorrectionField;
  const sourceId = asText(body.sourceId);
  if ((sourceType !== 'lead' && sourceType !== 'maintenance') || !sourceId) {
    return NextResponse.json({ ok: false, error: 'A valid dealer lead or Maintenance Tracker asset is required.' }, { status: 400 });
  }
  if (field !== 'serialNumber' && field !== 'replacementPriceExVat') {
    return NextResponse.json({ ok: false, error: 'Choose the serial number or replacement price.' }, { status: 400 });
  }

  const dealerName = profile.businessName || profile.displayName || profile.name || 'Dealer';
  const actorName = isDealerAppSession(session)
    ? session.dealerApp.displayName
    : profile.displayName || profile.name || dealerName;

  try {
    const correction = await createOrUpdateDealerAssetCorrection({
      dealerUserId: session.user.id,
      dealerName,
      actorName,
      sourceType,
      sourceId,
      field,
      value: body.value,
    });
    return NextResponse.json({ ok: true, correction });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'CORRECTION_FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'This asset is not shared with your dealership.' }, { status: 403 });
    }
    if (message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'The shared asset is no longer available.' }, { status: 404 });
    }
    if (message === 'SERIAL_NUMBER_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Enter the corrected serial number.' }, { status: 400 });
    }
    if (message === 'REPLACEMENT_PRICE_INVALID') {
      return NextResponse.json({ ok: false, error: 'Enter a valid VAT-exclusive replacement price greater than zero.' }, { status: 400 });
    }
    if (message === 'CORRECTION_NO_CHANGES') {
      return NextResponse.json({ ok: false, error: 'The corrected value must differ from the owner’s current value.' }, { status: 400 });
    }
    if (message === 'CORRECTION_SERIAL_PENDING') {
      return NextResponse.json(
        {
          ok: false,
          error: 'A serial number update is already waiting for owner approval. It must be accepted or declined before another asset detail can be updated.',
        },
        { status: 409 },
      );
    }
    if (message === 'CORRECTION_REPLACEMENT_PENDING') {
      return NextResponse.json(
        {
          ok: false,
          error: 'A replacement price update is already waiting for owner approval. It must be accepted or declined before another asset detail can be updated.',
        },
        { status: 409 },
      );
    }

    console.error('Dealer asset correction POST failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to send the asset correction to the owner.' }, { status: 500 });
  }
}
