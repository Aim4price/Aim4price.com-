import { NextRequest, NextResponse } from 'next/server';
import { authorizeFuelStorageScanAccess, listFuelEventsForReport, recordFuelAssetIssue } from '../../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    publicFuelStorageCode: string;
  };
};

type FuelIssueRequest = {
  assetId?: unknown;
  litres?: unknown;
  assetFuelPercentBefore?: unknown;
  assetFuelPercentAfter?: unknown;
  assetUsageReading?: unknown;
  operatorName?: unknown;
  activityText?: unknown;
  workAreaText?: unknown;
  note?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  locationText?: unknown;
  clientEventId?: unknown;
  clientCapturedAt?: unknown;
  gpsAccuracyMeters?: unknown;
};

function normalizeFuelCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
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
    return NextResponse.json(
      {
        ok: false,
        error: access.error,
        pinRequired: access.pinRequired,
      },
      { status: access.status },
    );
  }

  let body: FuelIssueRequest;
  try {
    body = (await request.json()) as FuelIssueRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid fuel issue details.' }, { status: 400 });
  }

  const assetId = asText(body.assetId);

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Choose the asset that received fuel.' }, { status: 400 });
  }

  try {
    const saved = await recordFuelAssetIssue({
      userId: access.ownerUserId,
      storageId: access.storage.id,
      assetId,
      litres: body.litres,
      assetFuelPercentBefore: body.assetFuelPercentBefore,
      assetFuelPercentAfter: body.assetFuelPercentAfter,
      assetUsageReading: body.assetUsageReading,
      operatorName: body.operatorName,
      activityText: body.activityText,
      workAreaText: body.workAreaText,
      note: body.note,
      latitude: body.latitude,
      longitude: body.longitude,
      locationText: body.locationText,
      clientEventId: body.clientEventId,
      clientCapturedAt: body.clientCapturedAt,
      gpsAccuracyMeters: body.gpsAccuracyMeters,
      actorType: 'scan_pin',
    });

    const recentEvents = await listFuelEventsForReport(access.ownerUserId, access.storage.id);

    return NextResponse.json({
      ok: true,
      storage: saved.storage,
      event: saved.event,
      assets: saved.assets,
      recentEvents: recentEvents.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to save fuel issue.') },
      { status: 400 },
    );
  }
}
