import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { createOrUpdateDealerAssetCorrection } from '../../../../lib/dealer-asset-corrections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RenewalBody = { sourceId?: unknown; value?: unknown };

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Licence expert sign-in is required.' }, { status: 401 });
  }

  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'licensing' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Licence expert access is required.' }, { status: 403 });
  }

  let body: RenewalBody;
  try {
    body = await request.json() as RenewalBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send valid renewal details.' }, { status: 400 });
  }

  const sourceId = String(body.sourceId ?? '').trim();
  if (!sourceId) {
    return NextResponse.json({ ok: false, error: 'Choose a shared licence renewal lead.' }, { status: 400 });
  }

  try {
    const partnerName = profile.businessName || profile.displayName || profile.name || 'Licence renewal expert';
    const correction = await createOrUpdateDealerAssetCorrection({
      dealerUserId: session.user.id,
      dealerName: partnerName,
      actorName: profile.displayName || profile.name || partnerName,
      sourceType: 'lead',
      sourceId,
      field: 'licenseRenewalDate',
      value: body.value,
    });
    return NextResponse.json({ ok: true, correction });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'CORRECTION_FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'This licence renewal lead is not shared with you.' }, { status: 403 });
    }
    if (message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'The shared asset is no longer available.' }, { status: 404 });
    }
    if (message === 'LICENSE_RENEWAL_DATE_INVALID') {
      return NextResponse.json({ ok: false, error: 'Choose a valid new renewal date.' }, { status: 400 });
    }
    if (message === 'CORRECTION_NO_CHANGES') {
      return NextResponse.json({ ok: false, error: 'The new renewal date must differ from the current date.' }, { status: 400 });
    }
    if (message.startsWith('CORRECTION_') && message.endsWith('_PENDING')) {
      return NextResponse.json({
        ok: false,
        error: 'An asset update is already waiting for owner approval.',
      }, { status: 409 });
    }

    console.error('Licence renewal update POST failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to send the renewal date to the owner.' }, { status: 500 });
  }
}
