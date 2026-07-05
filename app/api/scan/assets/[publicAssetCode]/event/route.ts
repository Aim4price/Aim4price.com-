import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventsSafely, type AdminUsageEventInput } from '../../../../../../lib/admin-usage-events';
import { authorizeScanAccess } from '../../../../../../lib/scan-auth';
import { listRecentScanEvents, normalizePublicAssetCode, saveScanAssetEvent } from '../../../../../../lib/scan-assets';
import { MAX_ASSET_REGISTER_PHOTOS } from '../../../../../../lib/asset-register-uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    publicAssetCode: string;
  };
};

type ScanEventRequest = {
  hours?: unknown;
  lifeWorkedPercent?: unknown;
  note?: unknown;
  operatorName?: unknown;
  photoUrls?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  clientEventId?: unknown;
  clientCapturedAt?: unknown;
  gpsAccuracyMeters?: unknown;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasSubmittedValue(value: unknown): boolean {
  return !(value === null || typeof value === 'undefined' || value === '');
}

function normalizeHours(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function normalizeCoordinates(value: unknown, maxAbsolute: number): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > maxAbsolute) return null;
  return parsed;
}

function normalizeClientEventId(value: unknown): string | null {
  const normalized = asText(value)
    .replace(/[^a-zA-Z0-9:._-]/g, '')
    .slice(0, 140);
  return normalized || null;
}

function normalizeClientCapturedAt(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeGpsAccuracyMeters(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50000) return null;
  return Math.round(parsed * 100) / 100;
}

function normalizePhotoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .map((entry) => asText(entry))
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    })
    .slice(0, MAX_ASSET_REGISTER_PHOTOS);
}

function hasMeaningfulUpdate(body: {
  hours: number | null;
  lifeWorkedPercent: number | null;
  note: string;
  photoUrls: string[];
}): boolean {
  return Boolean(body.hours !== null || body.lifeWorkedPercent !== null || body.note || body.photoUrls.length);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(context.params?.publicAssetCode);
  const access = await authorizeScanAccess(request, publicAssetCode);

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

  let body: ScanEventRequest;
  try {
    body = (await request.json()) as ScanEventRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter a valid scan update.' }, { status: 400 });
  }

  const triedLifeWorkedPercentUpdate = hasSubmittedValue(body.lifeWorkedPercent);

  const operatorName = access.accessMode === 'field_manager'
    ? access.fieldManagerDisplayName ?? ''
    : asText(body.operatorName);

  const payload = {
    hours: normalizeHours(body.hours),
    lifeWorkedPercent: null,
    note: asText(body.note),
    operatorName: operatorName.slice(0, 80),
    photoUrls: normalizePhotoUrls(body.photoUrls),
    latitude: normalizeCoordinates(body.latitude, 90),
    longitude: normalizeCoordinates(body.longitude, 180),
    clientEventId: normalizeClientEventId(body.clientEventId),
    clientCapturedAt: normalizeClientCapturedAt(body.clientCapturedAt),
    gpsAccuracyMeters: normalizeGpsAccuracyMeters(body.gpsAccuracyMeters),
  };

  if (payload.operatorName.length < 2) {
    return NextResponse.json({ ok: false, error: 'Enter the name of the person updating this asset.' }, { status: 400 });
  }

  if (triedLifeWorkedPercentUpdate && !hasMeaningfulUpdate(payload)) {
    return NextResponse.json(
      { ok: false, error: 'The QR scanner cannot update percentage worked. Update percentage worked from the main Aim4price asset workflow.' },
      { status: 400 },
    );
  }

  if (!hasMeaningfulUpdate(payload)) {
    return NextResponse.json({ ok: false, error: 'Add at least one QR update before saving.' }, { status: 400 });
  }

  if (payload.latitude === null || payload.longitude === null) {
    return NextResponse.json(
      { ok: false, error: 'Location is required. Allow GPS access to save this QR update.' },
      { status: 400 },
    );
  }

  const locationText = `GPS ${payload.latitude.toFixed(6)}, ${payload.longitude.toFixed(6)}`;

  try {
    const saved = await saveScanAssetEvent({
      publicAssetCode,
      actorType: access.accessMode,
      operatorName: payload.operatorName,
      ownerUserId: access.ownerUserId,
      hours: payload.hours,
      lifeWorkedPercent: payload.lifeWorkedPercent,
      condition: null,
      note: payload.note || null,
      photoUrls: payload.photoUrls,
      latitude: payload.latitude,
      longitude: payload.longitude,
      locationText,
      clientEventId: payload.clientEventId,
      clientCapturedAt: payload.clientCapturedAt,
      gpsAccuracyMeters: payload.gpsAccuracyMeters,
      fieldManagerId: access.fieldManagerId ?? null,
      fieldManagerDisplayName: access.fieldManagerDisplayName ?? null,
      fieldManagerSessionId: access.fieldManagerSessionId ?? null,
    });

    const recentEvents = await listRecentScanEvents(saved.asset.id, 8);
    const metadata = {
      assetId: saved.asset.id,
      eventId: saved.event.id,
      actorType: access.accessMode,
      publicAssetCode,
      fieldManagerId: access.fieldManagerId ?? null,
      fieldManagerDisplayName: access.fieldManagerDisplayName ?? null,
      hasNote: Boolean(payload.note),
      photoCount: payload.photoUrls.length,
    };
    const usageEvents: AdminUsageEventInput[] = [
      {
        userId: access.ownerUserId,
        eventType: access.accessMode === 'field_manager' ? 'field_manager_asset_updated' : 'qr_asset_updated',
        eventSource: 'scan-asset-event',
        metadata,
      },
    ];

    if (payload.note) {
      usageEvents.push({
        userId: access.ownerUserId,
        eventType: 'maintenance_note_left',
        eventSource: 'scan-asset-event',
        metadata,
      });
    }

    await recordAdminUsageEventsSafely(usageEvents);

    return NextResponse.json({
      ok: true,
      asset: saved.asset,
      event: recentEvents[0] ?? saved.event,
      recentEvents,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USAGE_MODE_PERCENT_CANNOT_ACCEPT_HOURS') {
      return NextResponse.json(
        { ok: false, error: 'This asset is valued by lifetime worked percentage, so the QR page cannot update it with hours.' },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'USAGE_MODE_HOURS_CANNOT_ACCEPT_PERCENT') {
      return NextResponse.json(
        { ok: false, error: 'This asset is valued by hours or kilometres, so the QR page cannot update it with a lifetime worked percentage.' },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'USAGE_READING_CANNOT_DECREASE') {
      return NextResponse.json(
        { ok: false, error: 'The new usage reading cannot be lower than the reading already saved on this asset.' },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'LIFE_WORKED_PERCENT_CANNOT_DECREASE') {
      return NextResponse.json(
        { ok: false, error: 'The new lifetime worked percentage cannot be lower than the percentage already saved on this asset.' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to save scan update.' },
      { status: 500 },
    );
  }
}
