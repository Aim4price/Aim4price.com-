import { redirectAdminToAdmin } from '../../../lib/account-access';
import FuelScanClient from './fuel-scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FuelScanPageProps = {
  searchParams?: { assetId?: string };
  params: {
    publicFuelStorageCode: string;
  };
};

export default async function FuelScanPage({ params, searchParams }: FuelScanPageProps) {
  await redirectAdminToAdmin();

  return <FuelScanClient publicFuelStorageCode={params.publicFuelStorageCode} initialAssetId={typeof searchParams?.assetId === 'string' ? searchParams.assetId : ''} />;
}
