import { projectManagerFuelScan } from '../../../../../../lib/fuel-scan-assets';
import { getOwnerAppAccess, ownerAppCan } from '../../../../../../lib/owner-app-access';
import { fuelScanSelectableAssets } from '../../../../../../lib/fuel-scan-assets';
import { verifyOfflineReplayIdentity } from '../../../../../../lib/app-offline-access';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeFuelStorageScanAccess, listFuelAssetsForUser, listFuelEventsForReport, recordFuelAssetIssue } from '../../../../../../lib/fuel-ledger';

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
  const offlineDenied = await verifyOfflineReplayIdentity(request);
  if (offlineDenied) return offlineDenied;

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


  if (access.accessMode === 'owner_session') {
    const manager = await getOwnerAppAccess();
    if (!manager || !ownerAppCan(manager, 'recordFuelIssues')) return NextResponse.json({ ok: false, error: 'This fuel action is not allowed for this login.' }, { status: 403 });
  }

  let body: FuelIssueRequest;
  try {
    body = (await request.json()) as FuelIssueRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid fuel issue details.' }, { status: 400 });
  }

  if (access.accessMode === 'owner_session') {
    const manager = await getOwnerAppAccess();
    if (!manager) return NextResponse.json({ ok: false, error: 'Sign in again.' }, { status: 401 });
    if (!ownerAppCan(manager, 'updateUsage')) { body.assetUsageReading = undefined; body.assetUsageMetric = undefined; }
    if (!ownerAppCan(manager, 'updateLocation')) { body.latitude = undefined; body.longitude = undefined; body.locationText = undefined; }
  }
  const assetId = asText(body.assetId);

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Choose the asset that received fuel.' }, { status: 400 });
  }

  try {
    const availableAssets = await fuelScanSelectableAssets(access, await listFuelAssetsForUser(access.ownerUserId));
    if (!availableAssets.some(asset => asset.id === assetId)) {
      return NextResponse.json({ ok: false, error: 'This asset is no longer available for fuel entry. Refresh and choose an included asset.' }, { status: 403 });
    }
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
      ...await projectManagerFuelScan(access, { storage: saved.storage, event: saved.event, assets: saved.assets, recentEvents }),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to save fuel issue.') },
      { status: 400 },
    );
  }
}
