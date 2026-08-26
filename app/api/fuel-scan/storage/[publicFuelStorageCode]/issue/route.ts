import { NextRequest, NextResponse } from 'next/server';
import { fieldManagerCan } from '../../../../../../lib/field-manager';
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
  assetUsageMetric?: unknown;
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
  const message = error instanceof Error && error.message ? error.message : fallback;

  if (/missing FROM-clause|syntax error|relation .* does not exist|column .* does not exist|violates .* constraint|SQLSTATE|Postgres|PostgreSQL/i.test(message)) {
    console.error('[fuel-scan] Failed to save fuel issue', { error: message });
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
    return NextResponse.json(
      {
        ok: false,
        error: access.error,
        pinRequired: access.pinRequired,
      },
      { status: access.status },
    );
  }

  if (access.accessMode === 'field_manager' && (!access.fieldManagerId || !(await fieldManagerCan(access.fieldManagerId, 'record_fuel')))) {
    return NextResponse.json({ ok: false, error: 'This Field Manager login cannot record fuel issues.' }, { status: 403 });
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
    const operatorName = access.accessMode === 'field_manager'
      ? access.fieldManagerDisplayName ?? 'Field Manager'
      : access.accessMode === 'owner_session'
        ? access.ownerAppDisplayName ?? 'Owner'
        : body.operatorName;

    const saved = await recordFuelAssetIssue({
      userId: access.ownerUserId,
      storageId: access.storage.id,
      assetId,
      litres: body.litres,
      assetFuelPercentBefore: body.assetFuelPercentBefore,
      assetFuelPercentAfter: body.assetFuelPercentAfter,
      assetUsageReading: body.assetUsageReading,
      assetUsageMetric: body.assetUsageMetric,
      operatorName,
      activityText: body.activityText,
      workAreaText: body.workAreaText,
      note: body.note,
      latitude: body.latitude,
      longitude: body.longitude,
      locationText: body.locationText,
      clientEventId: body.clientEventId,
      clientCapturedAt: body.clientCapturedAt,
      gpsAccuracyMeters: body.gpsAccuracyMeters,
      actorType: access.accessMode,
      fieldManagerId: access.fieldManagerId ?? null,
      fieldManagerDisplayName: access.fieldManagerDisplayName ?? null,
      fieldManagerSessionId: access.fieldManagerSessionId ?? null,
    });

    const recentEvents = await listFuelEventsForReport(access.ownerUserId, {
      storageId: access.storage.id,
      limit: 20,
    });

    return NextResponse.json({
      ok: true,
      storage: saved.storage,
      event: saved.event,
      assets: saved.assets,
      recentEvents,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to save fuel issue.') },
      { status: 400 },
    );
  }
}
