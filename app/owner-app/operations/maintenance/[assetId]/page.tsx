import { notFound, redirect } from 'next/navigation';
import ScanClient from '../../../../scan/[publicAssetCode]/scan-client';
import { ownerAppCan, ownerAppCanAccessAsset, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import { getScanAssetAccessContextByAssetId } from '../../../../../lib/scan-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: { assetId: string };
  searchParams?: {
    maintenanceId?: string | string[];
    maintenanceType?: string | string[];
    returnTo?: string | string[];
  };
};

function firstQueryValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value ?? '').trim();
}

export default async function OwnerMaintenanceWorkPage({ params, searchParams }: PageProps) {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'operate')) redirect('/owner-app');
  if (!ownerAppCanAccessAsset(access, params.assetId)) notFound();
  const context = await getScanAssetAccessContextByAssetId(params.assetId, {
    expectedOwnerUserId: access.ownerUserId,
  }).catch(() => null);

  if (!context?.asset?.publicAssetCode) notFound();

  const maintenanceId = firstQueryValue(searchParams?.maintenanceId);
  const maintenanceTypeValue = firstQueryValue(searchParams?.maintenanceType).toLowerCase();
  const maintenanceType = maintenanceTypeValue === 'service' || maintenanceTypeValue === 'checkup'
    ? maintenanceTypeValue
    : null;
  const returnTo = firstQueryValue(searchParams?.returnTo);

  return (
    <ScanClient
      publicAssetCode={context.asset.publicAssetCode}
      ownerAppMode
      ownerAppAssetId={context.asset.id}
      ownerAppOperatorName={access.displayName}
      ownerAppScheduledMaintenanceId={maintenanceId || null}
      ownerAppScheduledMaintenanceType={maintenanceType}
      ownerAppReturnTo={returnTo || '/owner-app/operations/maintenance'}
    />
  );
}
