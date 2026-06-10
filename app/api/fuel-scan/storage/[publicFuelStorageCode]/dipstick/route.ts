import { NextRequest, NextResponse } from 'next/server';
import { authorizeFuelStorageScanAccess, getFuelScanPayload, saveFuelStorageDipstickNote } from '../../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { publicFuelStorageCode: string } };
type DipstickNoteRequest = { dipstickNote?: unknown };

function normalizeFuelCode(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const publicFuelStorageCode = normalizeFuelCode(context.params.publicFuelStorageCode);
  const access = await authorizeFuelStorageScanAccess(request, publicFuelStorageCode);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, pinRequired: access.pinRequired }, { status: access.status });
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

  try {
    await saveFuelStorageDipstickNote(access.ownerUserId, access.storage.id, { dipstickNote });
    const payload = await getFuelScanPayload(access.ownerUserId, access.storage.id);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Failed to save dipstick note.') }, { status: 400 });
  }
}
