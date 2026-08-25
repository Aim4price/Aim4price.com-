import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import {
  markAssetLicenseRenewalAlertNoted,
  parseAssetLicenseDateKey,
} from '../../../../lib/asset-license-renewal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LicenseAlertRequestBody = {
  assetId?: unknown;
  renewalDate?: unknown;
  status?: unknown;
};

export async function PATCH(request: NextRequest) {
  const session = await getServerSession({ requireActive: true, allowDealerApp: true });

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: 'You must be signed in to note license renewal alerts.' },
      { status: 401 },
    );
  }

  if (!await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json({ ok: false, error: 'You do not have permission to update this Asset Register.' }, { status: 403 });
  }

  const rawBody = (await request.json().catch(() => null)) as unknown;
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? rawBody as LicenseAlertRequestBody
    : null;

  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const assetId = String(body.assetId ?? '').trim();
  const renewalDate = parseAssetLicenseDateKey(body.renewalDate)?.key ?? '';
  const nextStatus = String(body.status ?? 'noted').trim().toLowerCase();

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Asset id is required.' }, { status: 400 });
  }

  if (!renewalDate) {
    return NextResponse.json({ ok: false, error: 'A valid license renewal date is required.' }, { status: 400 });
  }

  if (nextStatus !== 'noted') {
    return NextResponse.json({ ok: false, error: 'Only noted status is supported.' }, { status: 400 });
  }

  try {
    const alert = await markAssetLicenseRenewalAlertNoted(session.user.id, assetId, renewalDate);
    return NextResponse.json({ ok: true, alert });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'LICENSE_RENEWAL_ALERT_NOT_FOUND') {
      return NextResponse.json(
        { ok: false, error: 'The license renewal alert is no longer open.' },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === 'LICENSE_RENEWAL_ALERT_CHANGED') {
      return NextResponse.json(
        { ok: false, error: 'The license renewal date changed. Refresh the register before noting this alert.' },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === 'LICENSE_RENEWAL_DATE_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'A valid license renewal date is required.' }, { status: 400 });
    }

    console.error('asset license renewal alert PATCH failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to mark the license renewal alert as noted.' }, { status: 500 });
  }
}
