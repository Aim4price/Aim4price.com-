import { notFound } from 'next/navigation';
import { ownerAppCanAccessAsset, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import FieldManagerMaintenanceClient from '../../../../field-manager/assets/[publicAssetCode]/maintenance/field-manager-maintenance-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerMaintenancePage({ params, searchParams }: {
  params: { assetId: string };
  searchParams?: { maintenanceId?: string | string[] };
}) {
  const access = await requireOwnerAppPageAccess();
  const assetId = String(params.assetId ?? '').trim();
  if (!ownerAppCanAccessAsset(access, assetId)) notFound();
  const maintenanceIdValue = searchParams?.maintenanceId;
  const maintenanceId = String(Array.isArray(maintenanceIdValue) ? maintenanceIdValue[0] : maintenanceIdValue ?? '').trim();

  return (
    <FieldManagerMaintenanceClient
      mode="owner"
      assetId={assetId}
      assetHref={`/owner-app/assets/${encodeURIComponent(assetId)}`}
      highlightMaintenanceId={maintenanceId}
    />
  );
}
