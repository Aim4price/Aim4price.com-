import { redirectAdminToAdmin } from '../../../lib/account-access';
import FuelScanClient from './fuel-scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FuelScanPageProps = {
  params: {
    publicFuelStorageCode: string;
  };
};

export default async function FuelScanPage({ params }: FuelScanPageProps) {
  await redirectAdminToAdmin();

  return <FuelScanClient publicFuelStorageCode={params.publicFuelStorageCode} />;
}
