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
  operatorName?: unknown;
  hours?: unknown;
  fuelPercent?: unknown;
  condition?: unknown;
  note?: unknown;
  photoUrls?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  locationText?: unknown;
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

function normalizeCondition(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'good') return 'good';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'requires attention' || normalized === 'requires serious attention') {
    return 'serious';
  }
  return null;
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
  condition: string | null;
  note: string;
  photoUrls: string[];
  latitude: number | null;
  longitude: number | null;
  locationText: string;
}): boolean {
  return Boolean(
    body.hours !== null ||
      body.fuelPercent !== null ||
      body.condition ||
      body.note ||
      body.photoUrls.length ||
      body.latitude !== null ||
      body.longitude !== null ||
      body.locationText,
  );
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
    operatorName: asText(body.operatorName),
    hours: normalizeHours(body.hours),
    fuelPercent: normalizeFuelPercent(body.fuelPercent),
    condition: normalizeCondition(body.condition),
    note: asText(body.note),
    photoUrls: normalizePhotoUrls(body.photoUrls),
    latitude: normalizeCoordinates(body.latitude, 90),
    longitude: normalizeCoordinates(body.longitude, 180),
    locationText: asText(body.locationText),
  };

  if (!hasMeaningfulUpdate(payload)) {
    return NextResponse.json({ ok: false, error: 'Add at least one update before saving.' }, { status: 400 });
  }

  try {
    const saved = await saveScanAssetEvent({
      publicAssetCode,
      actorType: access.accessMode,
      operatorName: payload.operatorName || null,
      hours: payload.hours,
      fuelPercent: payload.fuelPercent,
      condition: payload.condition,
      note: payload.note || null,
      photoUrls: payload.photoUrls,
      latitude: payload.latitude,
      longitude: payload.longitude,
      locationText: payload.locationText || null,
    });

    const recentEvents = await listRecentScanEvents(saved.asset.id, 8);

    return NextResponse.json({
      ok: true,
      asset: saved.asset,
      event: recentEvents[0] ?? saved.event,
      recentEvents,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to save scan update.' },
      { status: 500 },
    );
  }
}
