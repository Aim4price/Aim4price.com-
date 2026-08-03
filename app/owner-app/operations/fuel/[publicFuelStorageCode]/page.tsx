import FuelScanClient from '../../../../fuel-scan/[publicFuelStorageCode]/fuel-scan-client';
import { requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerFuelActionPage({ params }: { params: { publicFuelStorageCode: string } }) {
  const access = await requireOwnerAppPageAccess();
  return (
    <FuelScanClient
      publicFuelStorageCode={params.publicFuelStorageCode ?? ''}
      ownerAppMode
      ownerAppOperatorName={access.displayName}
      ownerAppReturnTo="/owner-app/operations/fuel"
    />
  );
}
