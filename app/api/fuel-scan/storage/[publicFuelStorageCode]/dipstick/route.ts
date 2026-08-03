import { NextRequest, NextResponse } from 'next/server';
import { fieldManagerCan } from '../../../../../../lib/field-manager';
import { authorizeFuelStorageScanAccess, getFuelScanPayload, saveFuelStorageDipstickNote } from '../../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { publicFuelStorageCode: string } };
type DipstickNoteRequest = {
  dipstickNote?: unknown;
  operatorName?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  locationText?: unknown;
  clientEventId?: unknown;
  clientCapturedAt?: unknown;
  gpsAccuracyMeters?: unknown;
};

function normalizeFuelCode(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asCoordinate(value: unknown, maxAbsolute: number): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > maxAbsolute) return null;
  return parsed;
}

function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error && error.message ? error.message : fallback;

  if (/missing FROM-clause|syntax error|relation .* does not exist|column .* does not exist|violates .* constraint|SQLSTATE|Postgres|PostgreSQL/i.test(message)) {
    console.error('[fuel-scan] Failed to save dipstick note', { error: message });
    return fallback;
  }

  return message;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const publicFuelStorageCode = normalizeFuelCode(context.params.publicFuelStorageCode);
  const isFieldManagerHint = request.nextUrl.searchParams.get('fieldManager') === '1';
  const isOwnerAppHint = request.nextUrl.searchParams.get('ownerApp') === '1';
  const access = await authorizeFuelStorageScanAccess(request, publicFuelStorageCode, {
    fieldManagerHint: isFieldManagerHint,
    ownerAppHint: isOwnerAppHint,
  });

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, pinRequired: access.pinRequired }, { status: access.status });
  }

  if (access.accessMode === 'field_manager' && (!access.fieldManagerId || !(await fieldManagerCan(access.fieldManagerId, 'record_fuel')))) {
    return NextResponse.json({ ok: false, error: 'This Field Manager login cannot add fuel tank notes.' }, { status: 403 });
  }

  let body: DipstickNoteRequest;
  try {
    body = (await request.json()) as DipstickNoteRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter a valid dipstick note.' }, { status: 400 });
  }

  const dipstickNote = asText(body.dipstickNote);
  if (dipstickNote.length < 2) {
    return NextResponse.json({ ok: false, error: 'Enter the dipstick note before saving.' }, { status: 400 });
  }

  const operatorName = access.accessMode === 'field_manager'
    ? access.fieldManagerDisplayName ?? 'Field Manager'
    : access.accessMode === 'owner_session'
      ? access.ownerAppDisplayName ?? 'Owner'
      : asText(body.operatorName);
  if (operatorName.length < 2) {
    return NextResponse.json({ ok: false, error: 'Enter your name before saving the dipstick note.' }, { status: 400 });
  }

  const latitude = asCoordinate(body.latitude, 90);
  const longitude = asCoordinate(body.longitude, 180);
  if (latitude === null || longitude === null) {
    return NextResponse.json({ ok: false, error: 'GPS location is required. Enable location and capture GPS again.' }, { status: 400 });
  }

  try {
    await saveFuelStorageDipstickNote(access.ownerUserId, access.storage.id, {
      dipstickNote,
      operatorName,
      latitude,
      longitude,
      locationText: asText(body.locationText) || `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      clientEventId: body.clientEventId,
      clientCapturedAt: body.clientCapturedAt,
      gpsAccuracyMeters: body.gpsAccuracyMeters,
      createEvent: true,
      fieldManagerId: access.fieldManagerId ?? null,
      fieldManagerDisplayName: access.fieldManagerDisplayName ?? null,
      fieldManagerSessionId: access.fieldManagerSessionId ?? null,
    });
    const payload = await getFuelScanPayload(access.ownerUserId, access.storage.id);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Failed to save dipstick note.') }, { status: 400 });
  }
}
