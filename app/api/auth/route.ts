import { NextRequest, NextResponse } from 'next/server';
import { applyScanSessionCookie, verifyScanPinForAsset } from '../../../../lib/scan-auth';
import { normalizePublicAssetCode } from '../../../../lib/scan-assets';
import { normalizeScanPin } from '../../../../lib/scan-pin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanAuthRequest = {
  publicAssetCode?: unknown;
  pin?: unknown;
};

export async function POST(request: NextRequest) {
  let body: ScanAuthRequest;

  try {
    body = (await request.json()) as ScanAuthRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter a valid asset code and scan PIN.' }, { status: 400 });
  }

  const publicAssetCode = normalizePublicAssetCode(body.publicAssetCode);
  const pin = normalizeScanPin(body.pin);

  if (!publicAssetCode) {
    return NextResponse.json({ ok: false, error: 'Asset code is required.' }, { status: 400 });
  }

  if (!pin) {
    return NextResponse.json({ ok: false, error: 'Enter the farm scan PIN.' }, { status: 400 });
  }

  const verified = await verifyScanPinForAsset(publicAssetCode, pin);

  if (!verified.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: verified.error,
        pinRequired: verified.pinRequired,
      },
      { status: verified.status },
    );
  }

  const response = NextResponse.json({
    ok: true,
    asset: {
      title: verified.asset.title,
      plateLabel: verified.asset.plateLabel,
      publicAssetCode: verified.asset.publicAssetCode,
    },
  });

  applyScanSessionCookie(response, {
    ownerUserId: verified.ownerUserId,
    pinUpdatedAtIso: verified.pinUpdatedAtIso,
  });

  return response;
}
