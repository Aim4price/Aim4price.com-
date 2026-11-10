import { notFound } from 'next/navigation';
import { ownerAppCan, ownerAppCanAccessAsset, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import ManagerMaintenanceClient from '../../../../../components/manager/maintenance-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerMaintenancePage({ params, searchParams }: {
  params: { assetId: string };
  searchParams?: { maintenanceId?: string | string[] };
}) {
  const access = await requireOwnerAppPageAccess();
  const assetId = String(params.assetId ?? '').trim();
  if (!ownerAppCan(access, 'viewMaintenance') || !ownerAppCanAccessAsset(access, assetId)) notFound();
  const maintenanceIdValue = searchParams?.maintenanceId;
  const maintenanceId = String(Array.isArray(maintenanceIdValue) ? maintenanceIdValue[0] : maintenanceIdValue ?? '').trim();

  return (
    <ManagerMaintenanceClient
      mode="owner"
      canRecord={ownerAppCan(access, 'recordMaintenance') || ownerAppCan(access, 'completeMaintenance')}
      canSchedule={ownerAppCan(access, 'scheduleMaintenance')}
      assetId={assetId}
      assetHref={`/owner-app/assets/${encodeURIComponent(assetId)}`}
      highlightMaintenanceId={maintenanceId}
    />
  );
}
