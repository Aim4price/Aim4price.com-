import { requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import FieldManagerMaintenanceClient from '../../../../field-manager/assets/[publicAssetCode]/maintenance/field-manager-maintenance-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerMaintenancePage({ params }: {
  params: { assetId: string };
}) {
  await requireOwnerAppPageAccess();
  const assetId = String(params.assetId ?? '').trim();

  return (
    <FieldManagerMaintenanceClient
      mode="owner"
      assetId={assetId}
      assetHref={`/owner-app/assets/${encodeURIComponent(assetId)}`}
    />
  );
}
