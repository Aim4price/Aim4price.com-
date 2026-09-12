import { NextRequest, NextResponse } from 'next/server';
import { listFieldManagerAssets, fieldManagerCan } from '../../../../lib/field-manager';
import { listAssetMaintenanceRecords } from '../../../../lib/asset-maintenance';
import { requireOfflineIdentity, offlineHeaders } from '../../../../lib/field-manager-offline-access';
import { getMaintenanceCatalogue } from '../../../../lib/maintenance-catalogue-db';
import { resolveMaintenanceChecklist } from '../../../../lib/maintenance-catalogue';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const access = await requireOfflineIdentity(request);
  if (!access.ok) return access.response;
  if (request.nextUrl.searchParams.get('identityOnly') === '1') {
    return NextResponse.json({ ok: true, identity: access.identity }, { headers: offlineHeaders });
  }
  try {
    const [assets, records, canRecordWork, catalogue] = await Promise.all([
      listFieldManagerAssets(access.session.ownerUserId, access.session.managerId),
      listAssetMaintenanceRecords(access.session.ownerUserId),
      fieldManagerCan(access.session.managerId, 'record_work'),
      getMaintenanceCatalogue(),
    ]);
    const ids = new Set(assets.map(asset => asset.id));
    // Send only the operational fields needed offline, never owner valuations or other managers' tasks.
    return NextResponse.json({ ok: true, identity: access.identity, displayName: access.session.displayName,
      savedAt: new Date().toISOString(), canRecordWork,
      assets: assets.map(a => ({ id: a.id, publicAssetCode: a.publicAssetCode, title: a.title,
        checklist: resolveMaintenanceChecklist(a, catalogue),
        registrationNumber: a.registrationNumber, serialNumber: a.serialNumber, note: a.note,
        usageReading: a.usageReading, usageLabel: a.usageLabel, usageMetric: a.usageMetric, updatedAt: a.updatedAtIso })),
      tasks: records.filter(r => ids.has(r.assetId) && r.status === 'upcoming'
        && (!r.assignedFieldManagerId || r.assignedFieldManagerId === access.session.managerId))
        .map(r => ({ id: r.id, assetId: r.assetId, title: r.title, notes: r.notes, maintenanceType: r.maintenanceType,
          dueDate: r.dueDate, dueUsage: r.dueUsage, usageMetric: r.usageMetric, status: r.computedStatusLabel })),
    }, { headers: offlineHeaders });
  } catch (error) {
    console.error('Field Manager offline snapshot failed', error);
    return NextResponse.json({ ok: false, error: 'Could not refresh offline work. Your saved copy is unchanged.' }, { status: 503, headers: offlineHeaders });
  }
}
