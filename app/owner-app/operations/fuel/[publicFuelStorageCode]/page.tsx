import { redirect } from 'next/navigation';
import FuelScanClient from '../../../../fuel-scan/[publicFuelStorageCode]/fuel-scan-client';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerFuelActionPage({ params }: { params: { publicFuelStorageCode: string } }) {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'operate')) redirect('/owner-app');
  return (
    <FuelScanClient
      publicFuelStorageCode={params.publicFuelStorageCode ?? ''}
      ownerAppMode
      ownerAppOperatorName={access.displayName}
      ownerAppReturnTo="/owner-app/operations/fuel/storage"
    />
  );
}
