import { NextRequest, NextResponse } from 'next/server';
import { authorizeFuelStorageScanAccess, getFuelScanPayload, getFuelStoragePublicPreview } from '../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    publicFuelStorageCode: string;
  };
};

function normalizeFuelCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export async function GET(request: NextRequest, context: RouteContext) {
  const publicFuelStorageCode = normalizeFuelCode(context.params.publicFuelStorageCode);
  const isPreviewRequest = request.nextUrl.searchParams.get('preview') === '1';
  const isFieldManagerHint = request.nextUrl.searchParams.get('fieldManager') === '1';
  const isOwnerAppHint = request.nextUrl.searchParams.get('ownerApp') === '1';

  if (isPreviewRequest) {
    const preview = await getFuelStoragePublicPreview(publicFuelStorageCode);

    if (!preview) {
      return NextResponse.json(
        { ok: false, error: 'Fuel storage not found.', pinRequired: false },
        { status: 404 },
      );
    }

    if (preview.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: 'This fuel storage QR code is archived.', pinRequired: false },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, preview: true, storage: preview, pinRequired: preview.pinRequired });
  }

  const access = await authorizeFuelStorageScanAccess(request, publicFuelStorageCode, {
    fieldManagerHint: isFieldManagerHint,
    ownerAppHint: isOwnerAppHint,
  });

  if (!access.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: access.error,
        pinRequired: access.pinRequired,
      },
      { status: access.status },
    );
  }

  try {
    const payload = await getFuelScanPayload(access.ownerUserId, access.storage.id);

    return NextResponse.json({
      ok: true,
      ...payload,
      accessMode: access.accessMode,
      fieldManagerDisplayName: access.fieldManagerDisplayName ?? null,
      ownerAppDisplayName: access.ownerAppDisplayName ?? null,
    });
  } catch (error) {
    console.error('[fuel-scan] Failed to load fuel scan payload', {
      publicFuelStorageCode,
      storageId: access.storage.id,
      accessMode: access.accessMode,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Failed to load fuel update details.', pinRequired: false },
      { status: 500 },
    );
  }
}
