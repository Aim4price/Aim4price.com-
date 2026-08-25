import { NextRequest, NextResponse } from 'next/server';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { recordAdminUsageEventSafely } from '../../../../lib/admin-usage-events';
import { getServerSession, isAdminSupportSession } from '../../../../lib/auth-session';
import { attachOpenPartnerNotesToAssets } from '../../../../lib/partner-access';
import { attachLatestMaintenanceStatusToAssets } from '../../../../lib/scan-assets';
import { updateAssetRegisterItemLocation } from '../../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

async function requireAssetRegisterAccount(session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Asset Register locations are available to active Owner accounts and authorised Dealer inventory staff.',
      },
      { status: 403 },
    );
  }

  return null;
}

function getUsageUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user?.id || isAdminSupportSession(session)) {
    return null;
  }

  return session.user.id;
}

function normalizeRequiredNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeGpsAccuracy(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === null || typeof value === 'undefined' || value === '') {
    return { ok: true, value: null };
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { ok: false };
  }

  return { ok: true, value: numeric };
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLocationText(value: unknown): string {
  return asText(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 180)
    .trim();
}

function normalizeLocationSource(value: unknown): 'manual' | 'device' {
  const normalized = asText(value).toLowerCase();

  return normalized === 'manual' ? 'manual' : 'device';
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  const body = (await request.json().catch(() => null)) as {
    assetId?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    gpsAccuracyMeters?: unknown;
    clientCapturedAt?: unknown;
    locationText?: unknown;
    source?: unknown;
    mode?: unknown;
  } | null;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Valid GPS update data is required.' }, { status: 400 });
  }

  const assetId = asText(body.assetId);
  const latitude = normalizeRequiredNumber(body.latitude);
  const longitude = normalizeRequiredNumber(body.longitude);
  const gpsAccuracy = normalizeGpsAccuracy(body.gpsAccuracyMeters);
  const locationText = normalizeLocationText(body.locationText);
  const source = normalizeLocationSource(body.source ?? body.mode);

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  if (latitude === null || latitude < -90 || latitude > 90) {
    return NextResponse.json({ ok: false, error: 'Latitude must be a finite number between -90 and 90.' }, { status: 400 });
  }

  if (longitude === null || longitude < -180 || longitude > 180) {
    return NextResponse.json({ ok: false, error: 'Longitude must be a finite number between -180 and 180.' }, { status: 400 });
  }

  if (!gpsAccuracy.ok) {
    return NextResponse.json({ ok: false, error: 'GPS accuracy must be a valid non-negative number.' }, { status: 400 });
  }

  try {
    const item = await updateAssetRegisterItemLocation(session.user.id, {
      assetId,
      latitude,
      longitude,
      gpsAccuracyMeters: gpsAccuracy.value,
      clientCapturedAt: asText(body.clientCapturedAt) || null,
      locationText: locationText || null,
      source,
    });

    const [itemWithPartnerNote] = await attachOpenPartnerNotesToAssets(session.user.id, [item]);
    const [itemWithMaintenanceStatus] = await attachLatestMaintenanceStatusToAssets(itemWithPartnerNote ? [itemWithPartnerNote] : [item]);

    const usageUserId = getUsageUserId(session);
    if (usageUserId) {
      await recordAdminUsageEventSafely({
        userId: usageUserId,
        eventType: 'asset_updated',
        eventSource: 'asset-register-location',
        metadata: {
          assetId: item.id,
          hasGpsAccuracy: gpsAccuracy.value !== null,
          source,
        },
      });
    }

    return NextResponse.json({ ok: true, item: itemWithMaintenanceStatus ?? itemWithPartnerNote ?? item });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'INVALID_GPS_COORDINATES') {
      return NextResponse.json({ ok: false, error: 'Valid GPS coordinates are required.' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'INVALID_GPS_ACCURACY') {
      return NextResponse.json({ ok: false, error: 'GPS accuracy must be a valid non-negative number.' }, { status: 400 });
    }

    console.error('asset register location update failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to update asset GPS position.' }, { status: 500 });
  }
}
