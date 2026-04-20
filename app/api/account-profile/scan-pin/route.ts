import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import {
  disableAccountScanPin,
  getAccountScanPinStatus,
  saveAccountScanPin,
} from '../../../../lib/account-profile';
import { hashScanPin, normalizeScanPin, validateScanPin } from '../../../../lib/scan-pin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SetScanPinRequest = {
  pin?: unknown;
  confirmPin?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const scanPin = await getAccountScanPinStatus(session.user.id);
    return NextResponse.json({ ok: true, scanPin });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to load scan PIN settings.') },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: SetScanPinRequest;

  try {
    body = (await request.json()) as SetScanPinRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter a valid scan PIN.' }, { status: 400 });
  }

  const rawPin = normalizeScanPin(body.pin);
  const rawConfirmPin = normalizeScanPin(body.confirmPin);

  if (!rawPin) {
    return NextResponse.json({ ok: false, error: 'Enter a scan PIN.' }, { status: 400 });
  }

  if (!rawConfirmPin) {
    return NextResponse.json({ ok: false, error: 'Confirm the scan PIN.' }, { status: 400 });
  }

  if (rawPin !== rawConfirmPin) {
    return NextResponse.json({ ok: false, error: 'Scan PINs do not match.' }, { status: 400 });
  }

  try {
    const validatedPin = validateScanPin(rawPin);
    const scanPinHash = await hashScanPin(validatedPin);
    const scanPin = await saveAccountScanPin(session.user.id, scanPinHash);

    return NextResponse.json({ ok: true, scanPin });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to save scan PIN.') },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const scanPin = await disableAccountScanPin(session.user.id);
    return NextResponse.json({ ok: true, scanPin });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to disable scan PIN.') },
      { status: 500 },
    );
  }
}
