import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAppOfflineAccess, offlineError, offlineHeaders } from '../../../../../lib/app-offline-access';
import { ownerAppCanAccessAsset } from '../../../../../lib/owner-app-access';
import { getFieldManagerAssetForOpen } from '../../../../../lib/field-manager';
import { saveOfflineNote } from '../../../../../lib/app-offline-notes';
import { saveFuelSlipTransaction } from '../../../../../lib/fuel-ledger';
import { getDealerTrackedAsset } from '../../../../../lib/dealer-maintenance-tracker';
import { completeAssetMaintenanceRecord } from '../../../../../lib/asset-maintenance';
import { POST as scan } from '../../../scan/assets/[publicAssetCode]/event/route';
import { POST as issue } from '../../../fuel-scan/storage/[publicFuelStorageCode]/issue/route';
import { POST as refill } from '../../../fuel-scan/storage/[publicFuelStorageCode]/refill/route';
import { POST as dipstick } from '../../../fuel-scan/storage/[publicFuelStorageCode]/dipstick/route';
async function confirmedResponse(pending: Promise<Response>): Promise<Response> {
  const response = await pending;
  const data = await response.clone().json().catch(() => null);
  if (response.ok && data?.ok) return NextResponse.json({ ok: true, asset: data.asset ? { id: data.asset.id } : undefined, scheduledMaintenanceCompletion: data.scheduledMaintenanceCompletion ? { completed: data.scheduledMaintenanceCompletion.completed } : undefined }, { headers: offlineHeaders });
  if (response.ok) return offlineError('The server has not confirmed this save. Retry the saved update.', 503);
  if (response.status >= 500 || /failed|could not|database|timeout/i.test(String(data?.error || ''))) return offlineError('The server could not confirm this save. Retry the saved update without changing it.', 503);
  return response;
}
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, { params }: { params: { app: string } }) {
  const auth = await requireAppOfflineAccess(request, params.app);
  if (!auth.ok) return auth.response;
  const a = auth.access;
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 64000) return offlineError('Saved update is too large.', 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
  } catch { return offlineError('Invalid saved update.'); }
  const payload = body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return offlineError('A saved payload is required.');
  const p = payload as Record<string, unknown>;
  if (!/^[a-zA-Z0-9:_-]{12,160}$/.test(String(p.clientEventId || ''))) return offlineError('A stable saved update ID is required.');
  // Bind retries to the original app and actor, even when several apps use one asset.
  const eventId = createHash('sha256').update(a.identity + ':' + p.clientEventId).digest('hex');
  const assetId = String(body.assetId || '');
  const code = String(body.code || '');
  const forward = (path: string, payload: unknown) => {
    const url = new URL(path, request.url);
    url.searchParams.set(a.app === 'owner' ? 'ownerApp' : 'fieldManager', '1');
    url.searchParams.set('assetId', assetId);
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    return new NextRequest(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  };
  try {
    if (body.kind === 'private-note' && (a.app === 'dealer' || a.app === 'middleman')) {
      await saveOfflineNote(a, p);
      return NextResponse.json({ ok: true }, { headers: offlineHeaders });
    }
    if (body.kind === 'dealer-maintenance' && a.app === 'dealer' && a.canWork) {
      const asset = await getDealerTrackedAsset(a.userId, assetId);
      if (!asset) return offlineError('This tracked asset is no longer available.', 403);
      const task = asset.maintenanceRecords.find(t => t.id === p.maintenanceId);
      if (!task || p.confirmedComplete !== true) return offlineError('Choose and confirm the completed maintenance task.');
      await completeAssetMaintenanceRecord(asset.ownerUserId, task.id, {
        completedAt: p.clientCapturedAt, completedUsage: p.hours, completedNotes: p.note,
        maintenanceWork: p.maintenanceWork, completedBy: a.displayName, offlineEventId: eventId,
      }, { assetId: asset.assetId });
      return NextResponse.json({ ok: true }, { headers: offlineHeaders });
    }
    if (a.app !== 'owner' && a.app !== 'field') return offlineError('This action is not available in this app.', 403);
    if (a.owner && ['work', 'fuel-issue', 'fuel-slip'].includes(String(body.kind)) && !ownerAppCanAccessAsset(a.owner, assetId)) return offlineError('This asset is no longer available to this login.', 403);
    if (body.kind === 'work' && a.canWork) return confirmedResponse(scan(forward('/api/scan/assets/' + encodeURIComponent(code) + '/event', { ...p, clientEventId: a.app === 'field' && String(p.clientEventId).startsWith('field-offline:') ? p.clientEventId : eventId }), { params: { publicAssetCode: code } }));
    if (body.kind === 'fuel-issue' && a.canFuel) return confirmedResponse(issue(forward('/api/fuel-scan/storage/' + encodeURIComponent(code) + '/issue', { ...p, assetId, clientEventId: eventId }), { params: { publicFuelStorageCode: code } }));
    if (body.kind === 'fuel-refill' && a.canRefill) return confirmedResponse(refill(forward('/api/fuel-scan/storage/' + encodeURIComponent(code) + '/refill', { ...p, clientEventId: eventId }), { params: { publicFuelStorageCode: code } }));
    if (body.kind === 'fuel-dipstick' && a.canRefill) return confirmedResponse(dipstick(forward('/api/fuel-scan/storage/' + encodeURIComponent(code) + '/dipstick', { ...p, clientEventId: eventId }), { params: { publicFuelStorageCode: code } }));
    if (body.kind === 'fuel-slip' && a.canFuel) {
      if (a.owner && !ownerAppCanAccessAsset(a.owner, assetId)) return offlineError('This asset is no longer available.', 403);
      if (a.managerId && !await getFieldManagerAssetForOpen({ ownerUserId: a.userId, managerId: a.managerId, assetId })) return offlineError('This asset is no longer available.', 403);
      const result = await saveFuelSlipTransaction(a.userId, {
        mode: 'manual', targetType: 'asset', assetId, offlineEventId: eventId,
        supplierName: p.supplierName, slipNumber: p.slipNumber, documentDate: p.documentDate,
        fuelType: p.fuelType, litres: p.litres, totalAmount: p.totalAmount, pricePerLitre: p.pricePerLitre,
        hourMeterReading: p.hourMeterReading, odometerReading: p.odometerReading, usageNotApplicable: p.usageNotApplicable,
        activityText: p.activityText, workAreaText: p.workAreaText, note: p.note,
        assetFuelPercentBefore: p.assetFuelPercentBefore, assetFuelPercentAfter: p.assetFuelPercentAfter,
        latitude: p.latitude, longitude: p.longitude, gpsAccuracyMeters: p.gpsAccuracyMeters, clientCapturedAt: p.clientCapturedAt,
        uploadId: p.uploadId, documentFileUrl: p.documentFileUrl, originalFilename: p.originalFilename, contentType: p.contentType, byteSize: p.byteSize,
        operatorName: a.displayName, auditActorUserId: a.actorId, auditActorName: a.displayName,
      });
      return NextResponse.json({ ok: true, pendingReview: result.pendingReview, message: result.message }, { headers: offlineHeaders });
    }
    return offlineError('Your current permissions do not allow this action.', 403);
  } catch (error) {
    console.error('Offline sync failed', error);
    const message = error instanceof Error ? error.message : '';
    if (/COMPLETION_|MAINTENANCE_/.test(message)) return offlineError('This maintenance update needs review. Check the reading, task, work details and service provider online, then edit the saved update.', 409);
    // Validation failures can be corrected; infrastructure failures must remain retryable.
    if (/^(Choose |Enter |This asset |.*is excluded from fuel entry|.*not eligible to receive fuel|.*reading.*lower)/i.test(message)) return offlineError(message, 409);
    return offlineError('Sync was interrupted. Your saved work is still on this phone. Retry when connected.', 503);
  }
}
