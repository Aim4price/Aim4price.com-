import { NextRequest, NextResponse } from 'next/server';
import { applyFuelStorageSessionCookie, verifyFuelStoragePin } from '../../../../lib/fuel-ledger';
import { normalizeScanPin } from '../../../../lib/scan-pin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FuelScanAuthRequest = {
  publicFuelStorageCode?: unknown;
  pin?: unknown;
};

function asFuelCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export async function POST(request: NextRequest) {
  let body: FuelScanAuthRequest;

  try {
    body = (await request.json()) as FuelScanAuthRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter a valid fuel storage code and PIN.' }, { status: 400 });
  }

  const publicFuelStorageCode = asFuelCode(body.publicFuelStorageCode);
  const pin = normalizeScanPin(body.pin);

  if (!publicFuelStorageCode) {
    return NextResponse.json({ ok: false, error: 'Fuel storage code is required.' }, { status: 400 });
  }

  if (!pin) {
    return NextResponse.json({ ok: false, error: 'Enter the fuel storage PIN.' }, { status: 400 });
  }

  const verified = await verifyFuelStoragePin(publicFuelStorageCode, pin);

  if (verified.ok !== true) {
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
    storage: {
      name: verified.storage.name,
      fuelType: verified.storage.fuelType,
      publicFuelStorageCode: verified.storage.publicFuelStorageCode,
    },
  });

  applyFuelStorageSessionCookie(response, {
    ownerUserId: verified.ownerUserId,
    storageId: verified.storage.id,
    publicFuelStorageCode: verified.storage.publicFuelStorageCode,
    pinUpdatedAtIso: verified.pinUpdatedAtIso,
  });

  return response;
}
