import { notFound } from 'next/navigation';
import ScanClient from '../../../../scan/[publicAssetCode]/scan-client';
import { requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import { getScanAssetAccessContextByAssetId } from '../../../../../lib/scan-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerMaintenanceWorkPage({ params }: { params: { assetId: string } }) {
  const access = await requireOwnerAppPageAccess();
  const context = await getScanAssetAccessContextByAssetId(params.assetId, {
    expectedOwnerUserId: access.ownerUserId,
  }).catch(() => null);

  if (!context?.asset?.publicAssetCode) notFound();

  return (
    <ScanClient
      publicAssetCode={context.asset.publicAssetCode}
      ownerAppMode
      ownerAppAssetId={context.asset.id}
      ownerAppOperatorName={access.displayName}
      ownerAppReturnTo="/owner-app/operations/maintenance"
    />
  );
}
