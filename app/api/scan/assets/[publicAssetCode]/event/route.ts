import { NextRequest, NextResponse } from 'next/server';
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
  fuelPercent?: unknown;
  note?: unknown;
  photoUrls?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHours(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function normalizeFuelPercent(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeCoordinates(value: unknown, maxAbsolute: number): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > maxAbsolute) return null;
  return parsed;
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
  fuelPercent: number | null;
  note: string;
  photoUrls: string[];
}): boolean {
  return Boolean(body.hours !== null || body.fuelPercent !== null || body.note || body.photoUrls.length);
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

  const payload = {
    hours: normalizeHours(body.hours),
    fuelPercent: normalizeFuelPercent(body.fuelPercent),
    note: asText(body.note),
    photoUrls: normalizePhotoUrls(body.photoUrls),
    latitude: normalizeCoordinates(body.latitude, 90),
    longitude: normalizeCoordinates(body.longitude, 180),
  };

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
      operatorName: null,
      hours: payload.hours,
      fuelPercent: payload.fuelPercent,
      condition: null,
      note: payload.note || null,
      photoUrls: payload.photoUrls,
      latitude: payload.latitude,
      longitude: payload.longitude,
      locationText,
    });

    const recentEvents = await listRecentScanEvents(saved.asset.id, 8);

    return NextResponse.json({
      ok: true,
      asset: saved.asset,
      event: recentEvents[0] ?? saved.event,
      recentEvents,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USAGE_READING_CANNOT_DECREASE') {
      return NextResponse.json(
        { ok: false, error: 'The new usage reading cannot be lower than the reading already saved on this asset.' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to save scan update.' },
      { status: 500 },
    );
  }
}
